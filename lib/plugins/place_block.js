const { onceWithCleanup } = require('../promise_utils')

module.exports = inject

function inject (bot) {
  // Replies have no request id; serialize placements to the same destination.
  const inFlight = new Map()

  function placeBlockWithOptions (referenceBlock, faceVector, options) {
    const key = referenceBlock.position.plus(faceVector).toString()
    const previous = inFlight.get(key) ?? Promise.resolve()
    const placement = previous.catch(() => {}).then(() => performPlacement(referenceBlock, faceVector, options))
    inFlight.set(key, placement)
    const cleanup = () => {
      if (inFlight.get(key) === placement) inFlight.delete(key)
    }
    placement.then(cleanup, cleanup)
    return placement
  }

  async function performPlacement (referenceBlock, faceVector, options) {
    const dest = referenceBlock.position.plus(faceVector)
    const oldBlock = bot.blockAt(dest)
    if (!oldBlock) throw new Error(`Cannot place a block at unloaded destination ${dest}`)

    await bot._genericPlace(referenceBlock, faceVector, options)

    // Whether or not it placed anything, the server answers block_place with a
    // block update for the reference block, then one for the block across the
    // face. Updates for dest that arrive before the reference one are stale
    // (sent before the server saw our packet) and say nothing about the result.
    let acked = false
    const onAck = () => { acked = true }
    bot.on(`blockUpdate:${referenceBlock.position}`, onAck)
    const [, newBlock] = await onceWithCleanup(bot, `blockUpdate:${dest}`, {
      timeout: 5000,
      // oldBlock and newBlock are both null when the world unloads
      checkCondition: (oldBlock, newBlock) => !oldBlock || !newBlock || acked
    }).catch((err) => {
      throw acked ? err : new Error(`Server did not answer the placement at ${dest}: ${err.message}`)
    }).finally(() => {
      bot.removeListener(`blockUpdate:${referenceBlock.position}`, onAck)
    })

    if (!newBlock) return
    if (newBlock.type === oldBlock.type) {
      throw new Error(`Server refused to place ${bot.heldItem?.name ?? 'block'} at ${dest}: the block is still ${newBlock.name}`)
    }
    bot.emit('blockPlaced', oldBlock, newBlock)
  }

  async function placeBlock (referenceBlock, faceVector) {
    await placeBlockWithOptions(referenceBlock, faceVector, { swingArm: 'right' })
  }

  bot.placeBlock = placeBlock
  bot._placeBlockWithOptions = placeBlockWithOptions
}
