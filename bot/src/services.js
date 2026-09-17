'use strict'

const { Vec3 } = require('vec3')

const woodNames = new Set(['oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log', 'mangrove_log', 'cherry_log', 'crimson_stem', 'warped_stem'])

function asVec3 (position) { return new Vec3(position.x, position.y, position.z) }
function isWood (item) { return woodNames.has(item.name) }

function findBlock (bot, resource, radius) {
  const block = bot.findBlock({ matching: candidate => candidate?.name === resource, maxDistance: radius })
  if (!block) throw new Error(`Keine Ressource ${resource} im Radius ${radius} gefunden.`)
  return block
}

async function goNear (bot, position, range = 2) {
  if (!bot.pathfinder) throw new Error('mineflayer-pathfinder ist nicht geladen.')
  const { goals } = require('mineflayer-pathfinder')
  await bot.pathfinder.goto(new goals.GoalNear(position.x, position.y, position.z, range))
}

async function depositWood (bot, chestPosition) {
  const block = bot.blockAt(asVec3(chestPosition))
  if (!block || !/chest|barrel/.test(block.name)) throw new Error('Die konfigurierte Lagerposition enthält keine Kiste oder kein Fass.')
  await goNear(bot, block.position)
  const chest = await bot.openContainer(block)
  try {
    const wood = bot.inventory.items().filter(isWood)
    if (!wood.length) return { deposited: 0, message: 'Kein Holz im Inventar.' }
    let deposited = 0
    for (const item of wood) {
      try { await chest.deposit(item.type, item.metadata, item.count); deposited += item.count } catch (error) {
        if (deposited === 0) throw new Error(`Lager ist voll oder nicht verfügbar: ${error.message}`)
        return { deposited, message: `Lager voll; ${deposited} Holz abgelegt.` }
      }
    }
    return { deposited, message: `${deposited} Holz abgelegt.` }
  } finally { chest.close() }
}

function patrolPoints (area) {
  if (!area?.pos1 || !area?.pos2) throw new Error('Bereich ist nicht vollständig gespeichert.')
  const minX = Math.min(area.pos1.x, area.pos2.x); const maxX = Math.max(area.pos1.x, area.pos2.x)
  const minZ = Math.min(area.pos1.z, area.pos2.z); const maxZ = Math.max(area.pos1.z, area.pos2.z)
  const y = Math.max(area.pos1.y, area.pos2.y)
  return [new Vec3(minX, y, minZ), new Vec3(maxX, y, minZ), new Vec3(maxX, y, maxZ), new Vec3(minX, y, maxZ)]
}

function insideArea (entity, area) {
  if (!entity?.position || !area?.pos1 || !area?.pos2) return false
  const { x, y, z } = entity.position
  return x >= Math.min(area.pos1.x, area.pos2.x) && x <= Math.max(area.pos1.x, area.pos2.x) && y >= Math.min(area.pos1.y, area.pos2.y) - 3 && y <= Math.max(area.pos1.y, area.pos2.y) + 6 && z >= Math.min(area.pos1.z, area.pos2.z) && z <= Math.max(area.pos1.z, area.pos2.z)
}

function shouldUseCreativeFlight (bot, target, flightActive) {
  if (!bot.abilities?.mayFly || !bot.creative) return false
  const verticalDistance = target.position.y - bot.entity.position.y
  return (verticalDistance > 2 && !target.onGround) || (flightActive && (!target.onGround || verticalDistance > 1))
}

module.exports = { woodNames, isWood, findBlock, goNear, depositWood, patrolPoints, insideArea, shouldUseCreativeFlight }
