'use strict'

const fs = require('fs')
const path = require('path')

function defaultConfig () {
  return {
    areas: {},
    chests: {},
    patrols: {},
    roles: {
      guard: { allowedMobs: ['zombie', 'skeleton', 'creeper', 'spider', 'drowned', 'husk', 'stray', 'phantom', 'witch'], attackRange: 3.5 },
      farmer: { resources: ['wheat', 'carrots', 'potatoes', 'beetroots'], tool: 'hoe', storage: null },
      forester: { resources: ['oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log', 'mangrove_log', 'cherry_log'], tool: 'axe', storage: null }
    }
  }
}

function loadConfig (filename) {
  if (!fs.existsSync(filename)) return defaultConfig()
  const parsed = JSON.parse(fs.readFileSync(filename, 'utf8'))
  return { ...defaultConfig(), ...parsed, areas: parsed.areas || {}, chests: parsed.chests || {}, patrols: parsed.patrols || {} }
}

function saveConfig (filename, config) {
  fs.mkdirSync(path.dirname(filename), { recursive: true })
  const temporary = `${filename}.tmp`
  fs.writeFileSync(temporary, `${JSON.stringify(config, null, 2)}\n`)
  fs.renameSync(temporary, filename)
}

module.exports = { defaultConfig, loadConfig, saveConfig }
