'use strict'

const path = require('path')
const mineflayer = require('../..')
const { loadConfig } = require('./config')
const { parseGatewayMessage } = require('./schema')
const { TaskQueue } = require('./queue')
const { patrolPoints, goNear, insideArea, shouldUseCreativeFlight, isWithinFollowRadius, pickVariant } = require('./services')
const { loadMessages, formatMessage } = require('./messages')
const { createCommandHandler } = require('./commands')

const configPath = path.resolve(process.env.WORKER_CONFIG || path.join(__dirname, '..', 'config.json'))
const bot = mineflayer.createBot({
  host: process.env.WORKER_HOST || '127.0.0.1',
  port: Number(process.env.WORKER_PORT || 25565),
  username: process.env.WORKER_USERNAME || 'WorkerBot',
  auth: process.env.WORKER_AUTH || 'offline',
  version: process.env.WORKER_VERSION || '26.3'
})

class Worker {
  constructor (bot, config, configPath) {
    this.bot = bot; this.config = config; this.configPath = configPath
    this.queue = new TaskQueue(); this.positions = {}; this.role = null; this.patrolIndex = 0
    this.patrolRunId = 0; this.patrolTimer = null; this.patrolBusy = false; this.followTimer = null
    this.followFlightActive = false; this.followFlightTask = null
    this.usesWaterMovements = false
    this.messages = loadMessages()
    this.handle = createCommandHandler(this)
  }

  reply (playerUuid, text) {
    const payload = Buffer.from(JSON.stringify({ playerUuid, text }), 'utf8')
    try { this.bot._client.write('custom_payload', { channel: 'worker:reply', data: payload }) } catch (error) { console.warn(`Antwort an Gateway fehlgeschlagen: ${error.message}`) }
  }

  whisper (playerName, text) {
    try { this.bot.chat(`/msg ${playerName} ${text}`) } catch (error) { console.warn(`Flüstern an ${playerName} fehlgeschlagen: ${error.message}`) }
  }

  status () {
    const task = this.queue.current?.name || 'keine'
    return `Worker online; Rolle: ${this.role?.type || 'keine'}; Aufgabe: ${task}.`
  }

  stop () {
    this.patrolRunId++
    clearTimeout(this.patrolTimer); this.patrolTimer = null; this.patrolBusy = false
    clearInterval(this.followTimer); this.followTimer = null
    this.stopFollowFlight()
    this.bot.pathfinder?.setGoal(null); this.queue.stop(); this.role = null
  }

  stopRole (type, areaName) {
    if (this.role?.type !== type) return false
    if (areaName && this.role.areaName !== areaName) return false
    this.stop()
    return true
  }

  startPatrol (areaName) {
    const area = this.config.areas[areaName]
    this.role = { type: 'patrol', areaName, area }; this.patrolIndex = 0; this.patrolRunId++
    this.queue.start({ name: 'patrol', priority: 10 }); this.advancePatrol(this.patrolRunId)
  }

  startGuard (areaName) {
    const area = this.config.areas[areaName]
    this.role = { type: 'guard', areaName, area }; this.patrolIndex = 0; this.patrolRunId++
    this.queue.start({ name: 'guard-patrol', priority: 20 }); this.advancePatrol(this.patrolRunId)
  }

  findPlayer (playerName) {
    const wanted = playerName.toLowerCase()
    return Object.values(this.bot.players).find(player => player.username?.toLowerCase() === wanted)?.entity
  }

  startFollow (playerName, notifyUuid, notifyName) {
    if (!this.bot.pathfinder) throw new Error('Pathfinder ist nicht geladen.')
    if (playerName.toLowerCase() === this.bot.username.toLowerCase()) throw new Error('WorkerBot kann sich nicht selbst folgen.')
    if (!this.findPlayer(playerName)) throw new Error(`Spieler ${playerName} ist nicht sichtbar oder nicht in derselben Welt.`)
    this.stop()
    this.role = { type: 'follow', playerName, notifyUuid, notifyName, waitingForPlayer: false }; this.queue.start({ name: 'follow', priority: 30 })
    this.refreshFollow()
    this.followTimer = setInterval(() => this.refreshFollow(), 1000)
  }

  refreshFollow () {
    if (this.role?.type !== 'follow') return
    const target = this.findPlayer(this.role.playerName)
    if (!target) { this.bot.pathfinder.setGoal(null); return }
    this.configureWaterNavigation(target)
    if (!isWithinFollowRadius(this.bot, target)) {
      this.stopFollowFlight()
      this.bot.pathfinder.setGoal(null)
      if (!this.role.waitingForPlayer) {
        this.role.waitingForPlayer = true
        const variants = this.messages.follow.tooFar.map(template => formatMessage(template, { name: this.role.notifyName }))
        this.role.lastDistanceMessage = pickVariant(variants, this.role.lastDistanceMessage)
        this.whisper(this.role.notifyName, this.role.lastDistanceMessage)
      }
      return
    }
    if (this.role.waitingForPlayer) {
      this.role.waitingForPlayer = false
      const variants = this.messages.follow.resumed.map(template => formatMessage(template, { name: this.role.notifyName }))
      this.role.lastResumeMessage = pickVariant(variants, this.role.lastResumeMessage)
      this.whisper(this.role.notifyName, this.role.lastResumeMessage)
    }
    this.bot.lookAt(target.position.offset(0, (target.height ?? 1.8) * 0.85, 0), true).catch(error => console.warn(`Folgen: Blickrichtung konnte nicht gesetzt werden (${error.message})`))
    if (this.shouldFlyToFollow(target)) {
      this.followByFlight(target)
      return
    }
    this.stopFollowFlight()
    const { goals } = require('mineflayer-pathfinder')
    this.bot.pathfinder.setGoal(new goals.GoalFollow(target, 3), true)
  }

  configureWaterNavigation (target) {
    const shouldDive = this.bot.entity.isInWater || target.isInWater || this.bot.blockAt(target.position)?.name === 'water'
    if (shouldDive === this.usesWaterMovements) return
    const { Movements } = require('mineflayer-pathfinder')
    const MovementType = shouldDive ? require('./water_movements') : Movements
    this.bot.pathfinder.setMovements(new MovementType(this.bot))
    this.usesWaterMovements = shouldDive
  }

  shouldFlyToFollow (target) {
    return shouldUseCreativeFlight(this.bot, target, this.followFlightActive)
  }

  followByFlight (target) {
    this.bot.pathfinder.setGoal(null)
    if (!this.followFlightActive) {
      this.bot._client.write('abilities', { flags: 0x02 })
      this.bot.creative.startFlying()
      this.followFlightActive = true
    }
    if (this.followFlightTask) return
    const offset = this.bot.entity.position.minus(target.position); offset.y = 0
    const length = Math.hypot(offset.x, offset.z) || 1
    const destination = target.position.offset((offset.x / length) * 3, 0, (offset.z / length) * 3)
    this.followFlightTask = this.bot.creative.flyTo(destination)
      .catch(error => console.warn(`Flugfolgen: ${error.message}`))
      .finally(() => { this.followFlightTask = null })
  }

  stopFollowFlight () {
    if (!this.followFlightActive) return
    this.bot._client.write('abilities', { flags: 0 })
    this.bot.creative?.stopFlying()
    this.followFlightActive = false
  }

  async advancePatrol (runId = this.patrolRunId) {
    if (!this.role || this.patrolBusy || runId !== this.patrolRunId || this.queue.current?.name === 'defend') return
    this.patrolBusy = true
    try {
      const points = patrolPoints(this.role.area)
      const pointIndex = this.patrolIndex++ % points.length
      await goNear(this.bot, points[pointIndex], 2)
    } catch (error) {
      // A single obstructed corner must not terminate the entire patrol.
      console.warn(`Patrouille: Wegpunkt nicht erreichbar (${error.message}); nächster Punkt folgt.`)
    } finally {
      this.patrolBusy = false
      if (this.role && runId === this.patrolRunId && this.queue.current?.name !== 'defend') {
        this.patrolTimer = setTimeout(() => this.advancePatrol(runId), 500)
      }
    }
  }

  async defend (entity) {
    if (!this.role || this.role.type !== 'guard' || this.queue.current?.name === 'defend') return
    const accepted = this.config.roles.guard.allowedMobs.includes(entity.name)
    if (!accepted || !insideArea(entity, this.role.area)) return
    const transition = this.queue.start({ name: 'defend', priority: 100 })
    if (transition.action !== 'interrupt') return
    try {
      await goNear(this.bot, entity.position, this.config.roles.guard.attackRange || 3.5)
      if (entity.isValid) this.bot.attack(entity)
    } catch (error) { console.warn(`Verteidigung: ${error.message}`) } finally {
      this.queue.complete()
      this.advancePatrol()
    }
  }
}

const worker = new Worker(bot, loadConfig(configPath), configPath)
bot.once('spawn', () => {
  try {
    const { pathfinder, Movements } = require('mineflayer-pathfinder')
    bot.loadPlugin(pathfinder)
    bot.pathfinder.setMovements(new Movements(bot))
  } catch (error) { console.warn(`Pathfinder nicht verfügbar: ${error.message}`) }
  try {
    bot._client.write('custom_payload', { channel: 'minecraft:register', data: Buffer.from('worker:command\u0000worker:reply', 'utf8') })
  } catch (error) { console.warn(`Worker-Gateway-Kanäle konnten nicht registriert werden: ${error.message}`) }
  console.log(`WorkerBot verbunden mit ${bot._client.socket.remoteAddress || 'Server'}.`)
})

bot._client.on('custom_payload', packet => {
  if (packet.channel !== 'worker:command') return
  let message
  try { message = parseGatewayMessage(packet.data) } catch (error) { console.warn(`Gateway-Befehl abgelehnt: ${error.message}`); return }
  Promise.resolve(worker.handle(message)).catch(error => {
    worker.reply(message.playerUuid, `Fehler: ${error.message}`)
    console.warn(`Gateway-Befehl abgelehnt: ${error.message}`)
  })
})
bot.on('entityMoved', entity => { worker.defend(entity).catch(error => console.warn(`Verteidigung: ${error.message}`)) })
bot.on('kicked', reason => console.error('Vom Server getrennt:', reason))
bot.on('error', error => console.error('Bot-Fehler:', error.message))

module.exports = { Worker }
