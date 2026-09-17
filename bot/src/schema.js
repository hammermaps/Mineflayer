'use strict'

function parseGatewayMessage (payload) {
  let message
  try { message = JSON.parse(Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload)) } catch { throw new Error('Gateway-Nachricht ist kein gültiges JSON.') }
  if (!message || typeof message !== 'object') throw new Error('Gateway-Nachricht fehlt.')
  for (const key of ['requestId', 'playerUuid', 'playerName', 'world', 'command']) {
    if (typeof message[key] !== 'string' || message[key].trim() === '') throw new Error(`Gateway-Feld ${key} fehlt.`)
  }
  if (!Array.isArray(message.args) || !message.args.every(arg => typeof arg === 'string')) throw new Error('Gateway-Feld args ist ungültig.')
  if (!message.position || !Number.isFinite(message.position.x) || !Number.isFinite(message.position.y) || !Number.isFinite(message.position.z)) throw new Error('Gateway-Position ist ungültig.')
  return message
}

module.exports = { parseGatewayMessage }
