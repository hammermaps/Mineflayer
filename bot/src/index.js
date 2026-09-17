'use strict'

const path = require('path')
const mineflayer = require('../..')
const { loadConfig } = require('./config')
const { parseGatewayMessage } = require('./schema')
const { TaskQueue } = require('./queue')
const { patrolPoints, goNear, insideArea } = require('./services')
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
    this.patrolRunId = 0; this.patrolTimer = null; this.patrolBusy = false
    this.handle = createCommandHandler(this)
  }

  reply (playerUuid, text) {
    const payload = Buffer.from(JSON.stringify({ playerUuid, text }), 'utf8')
    try { this.bot._client.write('custom_payload', { channel: 'worker:reply', data: payload }) } catch (error) { console.warn(`Antwort an Gateway fehlgeschlagen: ${error.message}`) }
  }

  status () {
    const task = this.queue.current?.name || 'keine'
    return `Worker online; Rolle: ${this.role?.type || 'keine'}; Aufgabe: ${task}.`
  }

  stop () {
    this.patrolRunId++
    clearTimeout(this.patrolTimer); this.patrolTimer = null; this.patrolBusy = false
    this.bot.pathfinder?.setGoal(null); this.queue.stop(); this.role = null
  }

  stopRole (type) { if (this.role?.type === type) this.stop() }

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
