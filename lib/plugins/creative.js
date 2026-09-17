const assert = require('assert')
const { Vec3 } = require('vec3')
const { sleep, onceWithCleanup } = require('../promise_utils')
const { once } = require('../promise_utils')

module.exports = inject

function inject (bot) {
  const Item = require('prismarine-item')(bot.registry)

  // these features only work when you are in creative mode.
  bot.creative = {
    setInventorySlot,
    flyTo,
    startFlying,
    stopFlying,
    clearSlot: slotNum => setInventorySlot(slotNum, null),
    clearInventory
  }

  const creativeSlotsUpdates = []

  // The server answers client_command stats requests in the order it received
  // them, so each statistics packet belongs to the oldest pending request.
  // Anything written before that request has been processed by then.
  const pendingStatsRequests = []
  let statsTimedOut = false

  bot._client.on('statistics', () => {
    // Statistics have no request IDs. After any timeout, late replies can no
    // longer be attributed safely, so use fixed waits for this connection.
    if (statsTimedOut) return
    const oldest = pendingStatsRequests.shift()
    if (oldest) oldest.answered()
  })

  function confirmServerProcessed (timeoutMs) {
    return new Promise((resolve) => {
      const request = {
        answered () {
          clearTimeout(timer)
          resolve()
        }
      }
      // Timing out resolves as success: a server that never answers stats
      // degrades to the previous fixed-wait behavior, never a hang.
      const timer = setTimeout(() => {
        statsTimedOut = true
        const i = pendingStatsRequests.indexOf(request)
        if (i !== -1) pendingStatsRequests.splice(i, 1)
        resolve()
      }, timeoutMs)
      if (!statsTimedOut) {
        pendingStatsRequests.push(request)
        bot._client.write('client_command', bot.supportFeature('respawnIsPayload') ? { payload: 1 } : { actionId: 1 })
      }
    })
  }

  // WARN: This method should not be called twice on the same slot before first promise succeeds
  async function setInventorySlot (slot, item, waitTimeout = 400) {
    assert(slot >= 0 && slot <= 44)

    if (Item.equal(bot.inventory.slots[slot], item, true)) return
    if (creativeSlotsUpdates[slot]) {
      throw new Error(`Setting slot ${slot} cancelled due to calling bot.creative.setInventorySlot(${slot}, ...) again`)
    }
    creativeSlotsUpdates[slot] = true
    let updateSlot
    try {
      bot._client.write('set_creative_slot', {
        slot,
        item: Item.toNotch(item)
      })

      if (bot.supportFeature('noAckOnCreateSetSlotPacket')) {
        bot._setSlot(slot, item)
        if (waitTimeout === 0) return
        // A correction can reject the optimistic update before the stats
        // round trip. After a timeout, confirmations degrade to fixed waits.
        await new Promise((resolve, reject) => {
          updateSlot = (oldItem, newItem) => {
            if (!Item.equal(newItem, item, true)) reject(Error('Server rejected'))
          }
          bot.inventory.on(`updateSlot:${slot}`, updateSlot)
          confirmServerProcessed(waitTimeout).then(resolve)
        })
        return
      }

      await onceWithCleanup(bot.inventory, `updateSlot:${slot}`, {
        timeout: 5000,
        checkCondition: (oldItem, newItem) => item === null ? newItem === null : newItem?.name === item.name && newItem?.count === item.count && newItem?.metadata === item.metadata
      })
    } finally {
      if (updateSlot) bot.inventory.off(`updateSlot:${slot}`, updateSlot)
      creativeSlotsUpdates[slot] = false
    }
  }

  async function clearInventory () {
    return Promise.all(bot.inventory.slots.filter(item => item).map(item => setInventorySlot(item.slot, null)))
  }

  let normalGravity = null
  const flyingSpeedPerUpdate = 0.5

  // straight line, so make sure there's a clear path.
  async function flyTo (destination) {
    // TODO: consider sending 0x13
    startFlying()

    let vector = destination.minus(bot.entity.position)
    let magnitude = vecMagnitude(vector)

    while (magnitude > flyingSpeedPerUpdate) {
      bot.physics.gravity = 0
      bot.entity.velocity = new Vec3(0, 0, 0)

      // small steps
      const normalizedVector = vector.scaled(1 / magnitude)
      bot.entity.position.add(normalizedVector.scaled(flyingSpeedPerUpdate))

      await sleep(50)

      vector = destination.minus(bot.entity.position)
      magnitude = vecMagnitude(vector)
    }

    // last step
    bot.entity.position = destination
    await once(bot, 'move', /* no timeout */ 0)
  }

  function startFlying () {
    if (normalGravity == null) normalGravity = bot.physics.gravity
    bot.physics.gravity = 0
  }

  function stopFlying () {
    bot.physics.gravity = normalGravity
  }
}

// this should be in the vector library
function vecMagnitude (vec) {
  return Math.sqrt(vec.x * vec.x + vec.y * vec.y + vec.z * vec.z)
}
