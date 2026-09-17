'use strict'

const Movements = require('mineflayer-pathfinder/lib/movements')
const Move = require('mineflayer-pathfinder/lib/move')

// mineflayer-pathfinder deliberately excludes vertical moves from liquid.
// These two neighbours retain the regular pathfinder costs and collision
// checks while allowing a route to ascend and descend through water columns.
class WaterMovements extends Movements {
  getMoveDown (node, neighbors) {
    const current = this.getBlock(node, 0, 0, 0)
    const destination = this.getBlock(node, 0, -1, 0)
    if (!current.liquid || !destination.liquid) return super.getMoveDown(node, neighbors)
    if (!destination.safe) return
    neighbors.push(new Move(destination.position.x, destination.position.y, destination.position.z, node.remainingBlocks, 1 + this.liquidCost))
  }

  getMoveUp (node, neighbors) {
    const current = this.getBlock(node, 0, 0, 0)
    const destination = this.getBlock(node, 0, 1, 0)
    if (!current.liquid || !destination.liquid) return super.getMoveUp(node, neighbors)
    const head = this.getBlock(node, 0, 2, 0)
    if (!destination.safe || !head.safe) return
    neighbors.push(new Move(destination.position.x, destination.position.y, destination.position.z, node.remainingBlocks, 1 + this.liquidCost))
  }
}

module.exports = WaterMovements
