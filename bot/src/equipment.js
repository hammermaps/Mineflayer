'use strict'

const materialScore = { netherite: 6, diamond: 5, iron: 4, chainmail: 3, golden: 2, gold: 2, leather: 1, stone: 2, wooden: 1 }
const armorSlots = ['head', 'torso', 'legs', 'feet']

function scoreItem (item, kind) {
  if (!item) return -Infinity
  const name = item.name || ''
  const material = Object.keys(materialScore).find(key => name.startsWith(key))
  let score = materialScore[material] || 0
  if (kind === 'weapon') score += /sword|axe/.test(name) ? 10 : 0
  if (item.nbt?.value?.Enchantments?.value?.value) score += Object.keys(item.nbt.value.Enchantments.value.value).length
  if (Number.isFinite(item.durabilityUsed) && Number.isFinite(item.maxDurability)) score += Math.max(0, 1 - item.durabilityUsed / item.maxDurability)
  return score
}

function bestEquipment (items) {
  const result = { weapon: null }
  for (const slot of armorSlots) result[slot] = null
  for (const item of items) {
    const slot = armorSlots.find(candidate => item.name.endsWith(`_${candidate === 'torso' ? 'chestplate' : candidate === 'head' ? 'helmet' : candidate === 'legs' ? 'leggings' : 'boots'}`))
    if (slot && scoreItem(item, 'armor') > scoreItem(result[slot], 'armor')) result[slot] = item
    if (/sword|axe/.test(item.name) && scoreItem(item, 'weapon') > scoreItem(result.weapon, 'weapon')) result.weapon = item
  }
  return result
}

async function equipBest (bot) {
  const best = bestEquipment(bot.inventory.items())
  for (const slot of armorSlots) if (best[slot]) await bot.equip(best[slot], slot)
  if (best.weapon) await bot.equip(best.weapon, 'hand')
  return best
}

module.exports = { scoreItem, bestEquipment, equipBest }
