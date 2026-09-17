// Test-only adapter: node --require ./tools/native-test-server.js <mocha> test/internalTest.js
// minecraft-protocol's server helper omits the 26.2 login success sessionId.
// Do not load this module in a production client or server.
const { randomUUID } = require('node:crypto')
const protocol = require('minecraft-protocol')
const createServer = protocol.createServer
protocol.createServer = function (options) {
  const beforeLogin = options.beforeLogin
  return createServer({
    ...options,
    host: '127.0.0.1',
    beforeLogin (client) {
      beforeLogin?.(client)
      if (!['26.2', '26.3'].includes(options.version)) return
      const write = client.write
      client.write = function (name, data) {
        if (name === 'success') {
          client.write = write
          return write.call(client, name, { ...data, sessionId: data.sessionId ?? randomUUID() })
        }
        return write.call(client, name, data)
      }
    }
  })
}
