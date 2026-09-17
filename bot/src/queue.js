'use strict'

class TaskQueue {
  constructor () { this.current = null; this.paused = []; this.pending = [] }

  start (task) {
    if (this.current && task.priority > this.current.priority) {
      this.paused.push(this.current)
      this.current = task
      return { action: 'interrupt', task }
    }
    if (!this.current) { this.current = task; return { action: 'start', task } }
    this.pending.push(task)
    this.pending.sort((a, b) => b.priority - a.priority)
    return { action: 'queue', task }
  }

  complete () {
    const finished = this.current
    this.current = this.paused.pop() || this.pending.shift() || null
    return { finished, next: this.current }
  }

  stop () { const stopped = this.current; this.current = null; this.paused = []; this.pending = []; return stopped }
}

module.exports = { TaskQueue }
