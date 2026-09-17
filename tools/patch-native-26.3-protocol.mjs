import { readFile, writeFile } from 'node:fs/promises'

const path = new URL('../vendor/minecraft-data/pc/26.3/protocol.json', import.meta.url)
const protocol = JSON.parse(await readFile(path, 'utf8'))

const container = fields => ['container', Object.entries(fields).map(([name, type]) => ({ name, type }))]
const array = (type, count) => ['array', { type, count }]

protocol.types.VecDeltaLinear = container({ dX: 'i16', dY: 'i16', dZ: 'i16' })
protocol.types.VecDeltaStep = container({ ticks: 'varint', dX: 'i16', dY: 'i16', dZ: 'i16' })
const fields = { 0: 'VecDeltaLinear', 1: 'VecDeltaLinear' }
for (let steps = 1; steps <= 8; steps++) {
  fields[steps * 2] = array('VecDeltaStep', steps)
  fields[steps * 2 + 1] = array('VecDeltaStep', steps)
}
const vecDelta = ['switch', { compareTo: 'properties', fields }]
const toClient = protocol.play.toClient.types
toClient.packet_rel_entity_move = container({ entityId: 'varint', properties: 'varint', delta: vecDelta })
toClient.packet_entity_move_look = container({ entityId: 'varint', properties: 'varint', delta: structuredClone(vecDelta), yaw: 'i8', pitch: 'i8' })
toClient.packet_entity_look = container({ entityId: 'varint', onGround: 'bool', yaw: 'i8', pitch: 'i8' })

await writeFile(path, `${JSON.stringify(protocol, null, 2)}\n`)
