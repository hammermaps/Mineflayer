const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { test } = require('node:test')
const { performance } = require('node:perf_hooks')
const { setImmediate: nextTurn } = require('node:timers/promises')
const nbt = require('prismarine-nbt')

function makeBot (version = '26.2') {
  const bot = new EventEmitter()
  bot.version = version
  bot.registry = require('minecraft-data')(version)
  bot.supportFeature = name => bot.registry.supportFeature(name)
  bot._client = new EventEmitter()
  bot._client.state = 'play'
  bot._client.write = () => {}
  return bot
}

for (const event of ['add_resource_pack', 'resource_pack_send']) {
  for (const decision of ['accept', 'deny', 'fallback']) {
    test(`${event}: stable arguments and one ${decision} response`, () => {
      const bot = makeBot()
      bot._client.state = 'configuration'
      const sent = []
      bot._client.write = (name, data) => sent.push(data)
      require('../lib/plugins/resource_pack')(bot)
      const uuid = '12345678-1234-4321-8765-123456789abc'
      const url = 'https://example.invalid/pack.zip'
      bot.on('resourcePack', (...args) => {
        assert.deepEqual(args, [url, uuid])
        if (decision === 'accept') bot.acceptResourcePack()
        if (decision === 'deny') bot.denyResourcePack()
      })
      bot._client.emit(event, { uuid, url })
      assert.deepEqual(sent.map(p => p.result), decision === 'deny' ? [1] : [3, 0])
      for (const packet of sent) assert.equal(packet.uuid, uuid)
    })
  }
}

test('legacy resource-pack denial carries its hash once', () => {
  const bot = makeBot('1.8.8')
  const sent = []
  bot._client.write = (name, data) => sent.push(data)
  require('../lib/plugins/resource_pack')(bot)
  bot.on('resourcePack', () => bot.denyResourcePack())
  bot._client.emit('resource_pack_send', { url: 'url', hash: 'hash' })
  assert.deepEqual(sent, [{ result: 1, hash: 'hash' }])
})

test('custom registry clocks interpolate without physics and clear on transfer', t => {
  let now = 0
  t.mock.method(performance, 'now', () => now)
  t.mock.timers.enable({ apis: ['setInterval'] })
  const bot = makeBot()
  bot.game = { dimension: 'overworld' }
  bot.physicsEnabled = false
  require('../lib/plugins/time')(bot)
  bot._client.emit('registry_data', { id: 'minecraft:world_clock', entries: [{ key: 'custom:other' }, { key: 'custom:day' }] })
  bot._client.emit('registry_data', { id: 'minecraft:dimension_type', entries: [{ key: 'minecraft:overworld', value: nbt.comp({ default_clock: nbt.string('custom:day') }) }] })
  bot._client.emit('update_time', { age: 1n, clockUpdates: [{ id: 1, totalTicks: 9007199254740993n, rate: 0.5 }] })
  const clocks = bot.time.clocks
  assert.equal(bot.time.bigTime, 9007199254740993n)
  assert.equal(clocks['custom:day'].partialTick, 0)
  now = 150
  t.mock.timers.tick(50)
  assert.equal(clocks['custom:day'].totalTicks, 9007199254740994n)
  assert.equal(clocks['custom:day'].partialTick, 0.5)
  bot.game.dimension = 'custom:unknown'
  bot._client.emit('update_time', { age: 2n, clockUpdates: [] })
  assert.equal(bot.time.bigTime, null)
  assert.equal(bot.time.clocks, clocks)
  bot._client.emit('start_configuration')
  assert.deepEqual(clocks, {})
  now = 1000
  t.mock.timers.tick(50)
  assert.deepEqual(clocks, {})
  bot.emit('end')
})

test('login callbacks see cleared team/scoreboard state and can populate it', () => {
  const bot = makeBot()
  bot._client.on('login', () => bot.emit('login'))
  require('../lib/plugins/team')(bot)
  require('../lib/plugins/scoreboard')(bot)
  bot.teams.old = {}
  bot.teamMap.old = {}
  bot.scoreboards.old = {}
  bot.scoreboard[1] = {}
  bot.on('login', () => {
    assert.deepEqual(Object.keys(bot.teams), [])
    assert.deepEqual(Object.keys(bot.teamMap), [])
    assert.deepEqual(Object.keys(bot.scoreboards), [])
    assert.deepEqual(Object.keys(bot.scoreboard), [])
    bot.teams.new = {}
  })
  bot._client.emit('login')
  assert.deepEqual(Object.keys(bot.teams), ['new'])
})

test('particleStatus option reaches the wire settings', () => {
  const bot = makeBot()
  const sent = []
  bot._client.write = (name, data) => sent.push(data)
  require('../lib/plugins/settings')(bot, { particleStatus: 'minimal' })
  bot._client.emit('login')
  assert.equal(sent[0].particleStatus, 'minimal')
})

test('abort preserves non-Error reasons and removes listeners', async () => {
  const { onceWithCleanup } = require('../lib/promise_utils')
  for (const reason of ['cancelled', null, { why: 'cancelled' }]) {
    const emitter = new EventEmitter()
    const controller = new AbortController()
    const promise = onceWithCleanup(emitter, 'result', { signal: controller.signal })
    controller.abort(reason)
    await assert.rejects(promise, err => err === reason)
    assert.equal(emitter.listenerCount('result'), 0)
  }
})

test('placement ignores type changes before acknowledgement and serializes refusals', async () => {
  const { Vec3 } = require('vec3')
  const bot = makeBot()
  const air = { type: 0, name: 'air' }
  const stone = { type: 1, name: 'stone' }
  const reference = { position: new Vec3(0, 0, 0) }
  const face = new Vec3(0, 1, 0)
  bot.blockAt = () => air
  let sends = 0
  bot._genericPlace = async () => { sends++ }
  require('../lib/plugins/place_block')(bot)
  const first = bot.placeBlock(reference, face)
  const second = bot.placeBlock(reference, face)
  const firstRejected = assert.rejects(first, /Server refused/)
  const secondRejected = assert.rejects(second, /Server refused/)
  await nextTurn()
  assert.equal(sends, 1)
  let settled = false
  first.then(() => { settled = true }, () => { settled = true })
  bot.emit('blockUpdate:(0, 1, 0)', air, stone)
  await nextTurn()
  assert.equal(settled, false)
  bot.emit('blockUpdate:(0, 0, 0)', stone, stone)
  bot.emit('blockUpdate:(0, 1, 0)', air, air)
  await firstRejected
  await nextTurn()
  assert.equal(sends, 2)
  bot.emit('blockUpdate:(0, 0, 0)', stone, stone)
  bot.emit('blockUpdate:(0, 1, 0)', air, air)
  await secondRejected
  assert.equal(bot.listenerCount('blockUpdate:(0, 0, 0)'), 0)
  assert.equal(bot.listenerCount('blockUpdate:(0, 1, 0)'), 0)
})

test('late creative statistics cannot confirm the next operation', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const bot = makeBot()
  require('../lib/plugins/inventory')(bot, { hideErrors: true })
  require('../lib/plugins/creative')(bot)
  const Item = require('prismarine-item')(bot.registry)
  const item = new Item(bot.registry.itemsByName.stone.id, 1)
  const commands = []
  bot._client.write = (name, data) => { if (name === 'client_command') commands.push(data) }
  const first = bot.creative.setInventorySlot(36, item, 100)
  t.mock.timers.tick(100)
  await first
  let settled = false
  const second = bot.creative.setInventorySlot(37, item, 100).then(() => { settled = true })
  bot._client.emit('statistics', {})
  await nextTurn()
  assert.equal(settled, false)
  assert.equal(commands.length, 1)
  t.mock.timers.tick(100)
  await second
  await bot.creative.setInventorySlot(38, item, 0)
  await bot.creative.setInventorySlot(38, null, 0)
  assert.equal(bot.inventory.slots[38], null)
})

test('creative empty-slot correction rejects and cleans listeners', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const bot = makeBot()
  require('../lib/plugins/inventory')(bot, { hideErrors: true })
  require('../lib/plugins/creative')(bot)
  const Item = require('prismarine-item')(bot.registry)
  const item = new Item(bot.registry.itemsByName.stone.id, 1)
  const pending = bot.creative.setInventorySlot(36, item)
  bot.inventory.updateSlot(36, null)
  await assert.rejects(pending, /Server rejected/)
  assert.equal(bot.inventory.listenerCount('updateSlot:36'), 0)
  t.mock.timers.tick(400)
  await bot.creative.setInventorySlot(36, item, 0)
})

for (const version of ['1.13.2', '1.16.5', '1.17', '1.17.1', '26.1', '26.2']) {
  test(`writeBook uses the real ${version} wire schema`, async () => {
    const bot = makeBot(version)
    require('../lib/plugins/inventory')(bot, { hideErrors: true })
    require('../lib/plugins/simple_inventory')(bot)
    require('../lib/plugins/book')(bot)
    const Item = require('prismarine-item')(bot.registry)
    bot.inventory.updateSlot(37, new Item(bot.registry.itemsByName.writable_book.id, 1))
    const protocol = require('minecraft-protocol')
    const serializer = protocol.createSerializer({ state: 'play', isServer: false, version })
    const parser = protocol.createDeserializer({ state: 'play', isServer: true, version })
    let decoded
    bot._client.write = (name, params) => {
      if (name !== 'edit_book') return
      decoded = parser.parsePacketBuffer(serializer.createPacketBuffer({ name, params })).data.params
      setImmediate(() => {
        const book = bot.inventory.slots[37]
        if (book.componentMap) book.componentMap.set('writable_book_content', { pages: [] })
        bot.inventory.updateSlot(37, book)
      })
    }
    await bot.writeBook(37, ['proof'])
    if (bot.supportFeature('editBookPacketUsesNbt')) {
      assert.equal(decoded.hand, 0)
      assert.equal(decoded.signing, false)
      assert.ok(decoded.new_book)
    } else {
      assert.equal(decoded.hand, 1)
      assert.deepEqual(decoded.pages, ['proof'])
    }
  })
}

test('duration workflow uses trusted PR number and only updates bot comments', async () => {
  const fs = require('node:fs')
  const vm = require('node:vm')
  const yaml = require('js-yaml')
  const workflow = yaml.load(fs.readFileSync('.github/workflows/duration-comment.yml', 'utf8'))
  const script = workflow.jobs.comment.steps[1].with.script
  const calls = []
  const fakeFs = {
    existsSync: () => true,
    readdirSync: () => ['pr', '0.txt'],
    readFileSync: file => {
      assert.notEqual(file, 'slower/pr')
      return 'slow test'
    }
  }
  await vm.runInNewContext(`(async () => { ${script} })()`, {
    require: () => fakeFs,
    context: { repo: { owner: 'hammermaps', repo: 'Mineflayer' }, payload: { workflow_run: { pull_requests: [{ number: 1 }] } } },
    github: {
      paginate: async () => [{ id: 99, user: { login: 'attacker' }, body: '<!-- slower-tests -->' }],
      rest: { issues: { listComments: {}, updateComment: args => calls.push(['update', args]), createComment: args => calls.push(['create', args]) } }
    }
  })
  assert.equal(calls[0][0], 'create')
  assert.equal(calls[0][1].issue_number, 1)
})
