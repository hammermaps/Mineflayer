'use strict'
/* global describe, it */

const assert = require('assert/strict')
const { parseGatewayMessage } = require('../src/schema')
const { TaskQueue } = require('../src/queue')
const { bestEquipment } = require('../src/equipment')
const { validateArea } = require('../src/commands')
const { isWood, shouldUseCreativeFlight, isWithinFollowRadius, pickVariant } = require('../src/services')
const { loadMessages, formatMessage } = require('../src/messages')
const WaterMovements = require('../src/water_movements')

describe('WorkerBot foundation', () => {
  const message = { requestId: 'id', playerUuid: 'uuid', playerName: 'Op', world: 'minecraft:overworld', position: { x: 1, y: 64, z: 1 }, command: 'status', args: [] }
  it('validates gateway messages', () => assert.deepEqual(parseGatewayMessage(Buffer.from(JSON.stringify(message))), message))
  it('rejects malformed gateway messages', () => assert.throws(() => parseGatewayMessage('{}'), /requestId/))
  it('requires a complete, non-flat saved area', () => {
    assert.throws(() => validateArea({}), /pos1/)
    assert.throws(() => validateArea({ pos1: { x: 1, z: 1, world: 'a' }, pos2: { x: 1, z: 2, world: 'a' } }), /Fläche/)
    assert.doesNotThrow(() => validateArea({ pos1: { x: 1, z: 1, world: 'a' }, pos2: { x: 2, z: 2, world: 'a' } }))
  })
  it('interrupts low priority work and resumes it', () => {
    const queue = new TaskQueue(); queue.start({ name: 'patrol', priority: 10 })
    assert.equal(queue.start({ name: 'defend', priority: 100 }).action, 'interrupt')
    assert.equal(queue.complete().next.name, 'patrol')
  })
  it('chooses stronger armor and a weapon', () => {
    const selection = bestEquipment([{ name: 'leather_helmet' }, { name: 'diamond_helmet' }, { name: 'iron_sword' }])
    assert.equal(selection.head.name, 'diamond_helmet'); assert.equal(selection.weapon.name, 'iron_sword')
  })
  it('recognizes only storable log wood', () => { assert.equal(isWood({ name: 'oak_log' }), true); assert.equal(isWood({ name: 'oak_planks' }), false) })
  it('uses creative flight only for an elevated airborne follow target', () => {
    const bot = { abilities: { mayFly: true }, creative: {}, entity: { position: { y: 64 } } }
    assert.equal(shouldUseCreativeFlight(bot, { position: { y: 67 }, onGround: false }, false), true)
    assert.equal(shouldUseCreativeFlight(bot, { position: { y: 65 }, onGround: true }, false), false)
    assert.equal(shouldUseCreativeFlight({ ...bot, abilities: { mayFly: false } }, { position: { y: 67 }, onGround: false }, false), false)
  })
  it('pauses follow targets beyond the configured radius', () => {
    const bot = { entity: { position: { distanceTo: target => target.x } } }
    assert.equal(isWithinFollowRadius(bot, { position: { x: 32 } }), true)
    assert.equal(isWithinFollowRadius(bot, { position: { x: 33 } }), false)
  })
  it('chooses a different message variant when possible', () => {
    const variants = ['eins', 'zwei', 'drei']
    assert.notEqual(pickVariant(variants, 'eins'), 'eins')
  })
  it('loads and formats translatable follow messages', () => {
    assert.equal(formatMessage(loadMessages('de').follow.resumed[0], { name: 'Alex' }), 'Ah, da bist du ja, Alex. Ich komme!')
  })
  it('provides a dedicated water movement type for diving routes', () => {
    assert.equal(typeof WaterMovements.prototype.getMoveDown, 'function')
    assert.equal(typeof WaterMovements.prototype.getMoveUp, 'function')
  })
})
