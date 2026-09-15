import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const protocol = require('minecraft-protocol')
const data = require('minecraft-data')('26.2')

test('26.2 outgoing tail matches Paper 26.2-92 GameProtocols registration', () => {
  const mapping = data.protocol.play.toServer.types.packet[1][0].type[1].mappings
  const names = ['spectator_action', 'arm_animation', 'teleport_to_entity', 'test_instance_block_action', 'block_place', 'use_item', 'custom_click_action']
  names.forEach((name, i) => assert.equal(mapping['0x' + (0x3e + i).toString(16)], name))
  assert.equal(new Set(Object.values(mapping)).size, Object.keys(mapping).length)
})

test('spectator optional entity and teleport UUID remain distinct wire packets', () => {
  const serializer = protocol.createSerializer({ state: 'play', isServer: false, version: '26.2' })
  const encode = (name, params) => serializer.createPacketBuffer({ name, params })
  // OPTIONAL_VAR_INT: zero means absent, positive values encode entity ID + 1.
  assert.deepEqual(encode('spectator_action', { entityId: 0 }), Buffer.from([0x3e, 0]))
  assert.deepEqual(encode('spectator_action', { entityId: 43 }), Buffer.from([0x3e, 43]))
  assert.deepEqual(encode('arm_animation', { hand: 1 }), Buffer.from([0x3f, 1]))
  assert.deepEqual(encode('teleport_to_entity', { target: '00000000-0000-0000-0000-000000000001' }), Buffer.from([0x40, ...Array(15).fill(0), 1]))
})
