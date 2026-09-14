const assert = require('node:assert/strict')
const { test } = require('node:test')
const { EventEmitter } = require('node:events')
const { readFileSync } = require('node:fs')
const vm = require('node:vm')
function makeBot (version) {
  const bot = new EventEmitter()
  bot.version = version
  bot.registry = require('minecraft-data')(version)
  bot.supportFeature = name => bot.registry.supportFeature(name)
  bot._client = new EventEmitter()
  bot._client.state = 'play'
  bot._client.write = () => {}
  return bot
}
for (const version of ['1.8.9', '1.21.11', '26.2']) {
  test(`login resets retain team and scoreboard identities ${version}`, () => {
    const bot = makeBot(version)
    require('../lib/plugins/team')(bot)
    require('../lib/plugins/scoreboard')(bot)
    const refs = [bot.teams, bot.teamMap, bot.scoreboards, bot.scoreboard]
    bot.teams.red = { name: 'red' }
    bot.teamMap.player = 'red'
    bot.scoreboards.points = { name: 'points' }
    bot.scoreboard[1] = bot.scoreboards.points
    assert.equal(bot.scoreboard.sidebar, bot.scoreboards.points)
    assert.equal(Object.values(bot.scoreboard).length, 1)
    bot._client.emit('login', {})
    for (const [i, obj] of [bot.teams, bot.teamMap, bot.scoreboards, bot.scoreboard].entries()) {
      assert.equal(obj, refs[i])
      assert.deepEqual(Object.keys(obj), [])
    }
    assert.equal(bot.scoreboard.sidebar, undefined)
  })
  test(`server held slot never echoes; local choice sends once ${version}`, () => {
    const bot = makeBot(version)
    require('../lib/plugins/inventory')(bot, { hideErrors: true })
    require('../lib/plugins/simple_inventory')(bot)
    const sent = []
    bot._client.write = (name, data) => sent.push({ name, data })
    bot._client.emit('held_item_slot', { slot: 4 })
    assert.equal(bot.quickBarSlot, 4)
    assert.equal(sent.length, 0)
    bot.setQuickBarSlot(5)
    bot.setQuickBarSlot(5)
    assert.deepEqual(sent, [{ name: 'held_item_slot', data: { slotId: 5 } }])
    for (const slot of [-1, 9, NaN, 1.5]) bot._client.emit('held_item_slot', { slot })
    assert.equal(bot.quickBarSlot, 5)
    bot._client.emit('login', {})
    bot._client.emit('held_item_slot', { slot: 4 })
    assert.equal(sent.length, 1)
  })
  test(`abilities follow actual wire flags ${version}`, () => {
    const bot = makeBot(version)
    bot.entity = {}
    require('../lib/plugins/abilities')(bot)
    const protocol = require('minecraft-protocol')
    const serializer = protocol.createSerializer({ state: 'play', isServer: true, version })
    const parser = protocol.createDeserializer({ state: 'play', isServer: false, version })
    for (const flags of [15, 0, 4]) {
      const packet = { flags, flyingSpeed: 0.05, walkingSpeed: 0.1 }
      const decoded = parser.parsePacketBuffer(serializer.createPacketBuffer({ name: 'abilities', params: packet })).data.params
      bot._client.emit('abilities', decoded)
      assert.equal(bot.abilities.flying, Boolean(flags & 2))
      assert.equal(bot.abilities.mayFly, Boolean(flags & 4))
      assert.equal(bot.abilities.invulnerable, Boolean(flags & 1))
      assert.equal(bot.entity.flying, Boolean(flags & 2))
      assert.ok(Math.abs(bot.entity.flyingSpeed - 0.05) < 1e-6)
    }
  })
  test(`window title normalized ${version}`, () => {
    const bot = makeBot(version)
    require('../lib/plugins/inventory')(bot, { hideErrors: true })
    const windowTitle = version === '1.8.9' ? '{"text":"Chest"}' : { type: 'string', value: 'Chest' }
    bot._client.emit('open_window', { windowId: 1, inventoryType: 'minecraft:chest', slotCount: 27, windowTitle })
    assert.equal(bot.currentWindow.title.toString(), 'Chest')
  })
}
test('physics accumulator drops capped backlog rather than replaying it', () => {
  const source = readFileSync(require.resolve('../lib/plugins/physics'), 'utf8')
  const body = source.slice(source.indexOf('  function doPhysics ()'), source.indexOf('  function tickPhysics ('))
  const context = { performance: { now: () => 1000 }, lastPhysicsFrameTime: 0, timeAccumulator: 0, catchupTicks: 0, PHYSICS_TIMESTEP: 0.05, PHYSICS_CATCHUP_TICKS: 4, ticks: 0 }
  context.tickPhysics = () => { context.ticks++ }
  vm.createContext(context)
  vm.runInContext(body + '\ndoPhysics()', context)
  assert.equal(context.ticks, 4)
  assert.ok(context.timeAccumulator < 0.05)
  vm.runInContext('doPhysics()', context)
  assert.equal(context.ticks, 4)
})
test('control states enumerate and pre-login chat explains the failure', () => {
  const bot = makeBot('26.2')
  require('../lib/plugins/physics')(bot, {})
  assert.deepEqual(Object.keys(bot.controlState).sort(), ['back', 'forward', 'jump', 'left', 'right', 'sneak', 'sprint'])
  require('../lib/plugins/chat')(bot, {})
  assert.throws(() => bot.chat('hello'), /before the client entered the play state/)
  bot._client.emit('end', 'test disconnect')
  assert.throws(() => bot.chat('hello'), /test disconnect/)
  bot.emit('end')
})
