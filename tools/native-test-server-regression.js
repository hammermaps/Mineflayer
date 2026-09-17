const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { runInNewContext } = require('node:vm')
for (const version of ['1.8.8', '26.2', '26.3']) {
  test(`test-server session adapter ${version}`, () => {
    const protocol = { createServer: options => options }
    runInNewContext(readFileSync(join(__dirname, 'native-test-server.js'), 'utf8'), {
      require: name => name === 'minecraft-protocol' ? protocol : require(name)
    })
    let before = 0
    const options = protocol.createServer({ version, beforeLogin: () => { before++ } })
    const packets = []
    const client = { write: (name, data) => packets.push({ name, data }) }
    const originalWrite = client.write
    options.beforeLogin(client)
    client.write('compress', { threshold: 256 })
    client.write('success', { username: 'Test' })
    assert.equal(before, 1)
    assert.equal(options.host, '127.0.0.1')
    assert.equal(packets[0].name, 'compress')
    assert.equal(client.write, originalWrite)
    if (['26.2', '26.3'].includes(version)) assert.match(packets[1].data.sessionId, /^[a-f0-9-]{36}$/)
    else assert.equal(packets[1].data.sessionId, undefined)
  })
}
