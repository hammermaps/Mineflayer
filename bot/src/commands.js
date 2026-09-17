'use strict'

const { saveConfig } = require('./config')
const { equipBest } = require('./equipment')
const { depositWood, findBlock } = require('./services')

const roles = new Set(['guard', 'farm', 'forest'])
function point (position) { return { x: Math.floor(position.x), y: Math.floor(position.y), z: Math.floor(position.z) } }

function validateArea (area) {
  if (!area?.pos1 || !area?.pos2) throw new Error('Setze zuerst /worker pos1 und /worker pos2.')
  if (area.pos1.world !== area.pos2.world) throw new Error('Die beiden Bereichspunkte müssen in derselben Welt liegen.')
  if (area.pos1.x === area.pos2.x || area.pos1.z === area.pos2.z) throw new Error('Der Bereich muss mindestens eine Fläche von 1x1 haben.')
}

function createCommandHandler (worker) {
  const persist = () => saveConfig(worker.configPath, worker.config)
  return async function handle (message) {
    const { command, args, playerUuid, position, world } = message
    const reply = text => worker.reply(playerUuid, text)
    const key = playerUuid
    if (command === 'status') return reply(worker.status())
    if (command === 'stop') { worker.stop(); return reply('Worker angehalten.') }
    if (command === 'equip') { const result = await equipBest(worker.bot); return reply(`Ausrüstung gewählt: ${Object.values(result).filter(Boolean).map(item => item.name).join(', ') || 'keine passende Ausrüstung'}.`) }
    if (command === 'pos1' || command === 'pos2') {
      worker.positions[key] ||= {}
      worker.positions[key][command] = { ...point(position), world }
      return reply(`${command} gespeichert: ${position.x}, ${position.y}, ${position.z}.`)
    }
    if (command === 'area') {
      const [subcommand, role, name] = args
      if (subcommand !== 'save' || !roles.has(role) || !name) throw new Error('Verwendung: /worker area save <guard|farm|forest> <name>')
      const selection = worker.positions[key]; validateArea(selection)
      worker.config.areas[name] = { ...selection, role }; persist()
      return reply(`Bereich ${name} für ${role} gespeichert.`)
    }
    if (command === 'chest') {
      const [subcommand, name] = args
      if (subcommand !== 'set' || !name) throw new Error('Verwendung: /worker chest set <name>')
      const block = worker.bot.blockAtCursor(6)
      if (!block || !/chest|barrel/.test(block.name)) throw new Error('Sieh eine Kiste oder ein Fass in höchstens 6 Blöcken Entfernung an.')
      worker.config.chests[name] = { ...point(block.position), world }; persist()
      return reply(`Lager ${name} gespeichert.`)
    }
    if (command === 'patrol') {
      const [subcommand, areaName] = args
      if (subcommand === 'stop') return reply(worker.stopRole('patrol', areaName) ? 'Patrouille angehalten.' : 'Keine passende Patrouille ist aktiv.')
      if (subcommand !== 'start' || !worker.config.areas[areaName]) throw new Error('Verwendung: /worker patrol start <area>')
      worker.startPatrol(areaName); return reply(`Patrouille in ${areaName} gestartet.`)
    }
    if (command === 'guard') {
      const [subcommand, areaName] = args
      if (subcommand === 'stop') return reply(worker.stopRole('guard', areaName) ? 'Wachdienst angehalten.' : 'Kein passender Wachdienst ist aktiv.')
      if (subcommand !== 'start' || !worker.config.areas[areaName]) throw new Error('Verwendung: /worker guard start <area>')
      worker.startGuard(areaName); return reply(`Wachdienst in ${areaName} gestartet.`)
    }
    if (command === 'follow') {
      const [playerName] = args
      if (playerName?.toLowerCase() === 'stop' && args.length === 1) return reply(worker.stopRole('follow') ? 'Folgen angehalten.' : 'Es ist kein Folgen aktiv.')
      if (args.length > 1) throw new Error('Verwendung: /worker follow [spieler]|stop')
      const target = playerName || message.playerName
      worker.startFollow(target, playerUuid, message.playerName); return reply(`Folgt ${target} mit 3 Blöcken Abstand und maximal 32 Blöcken Entfernung.`)
    }
    if (command === 'deposit') {
      const [kind, chestName] = args
      if (kind !== 'wood' || !worker.config.chests[chestName]) throw new Error('Verwendung: /worker deposit wood <chest>')
      const result = await depositWood(worker.bot, worker.config.chests[chestName]); return reply(result.message)
    }
    if (command === 'find') {
      const [resource, suppliedRadius] = args; const radius = Number(suppliedRadius || 32)
      if (!resource || !Number.isInteger(radius) || radius < 1 || radius > 128) throw new Error('Verwendung: /worker find <resource> [Radius 1-128]')
      const block = findBlock(worker.bot, resource, radius); return reply(`${resource}: ${block.position.x}, ${block.position.y}, ${block.position.z}.`)
    }
    throw new Error(`Unbekannter Worker-Befehl: ${command}.`)
  }
}

module.exports = { createCommandHandler, validateArea }
