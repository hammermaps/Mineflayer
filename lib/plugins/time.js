const nbt = require('prismarine-nbt')
const { performance } = require('node:perf_hooks')
module.exports = inject

function inject (bot) {
  const clockIds = new Map()
  const dimensionClocks = new Map()
  const clocks = new Map()
  let clockTimer
  const updatedAt = new Map()
  const qualified = name => name?.includes(':') ? name : `minecraft:${name}`
  bot._client.on('start_configuration', () => {
    clockIds.clear()
    dimensionClocks.clear()
    clocks.clear()
    updatedAt.clear()
    for (const name of Object.keys(bot.time.clocks)) delete bot.time.clocks[name]
    stopClocks()
  })
  bot._client.on('registry_data', packet => {
    if (packet.id === 'minecraft:world_clock') {
      clockIds.clear()
      clocks.clear()
      updatedAt.clear()
      for (const name of Object.keys(bot.time.clocks)) delete bot.time.clocks[name]
      packet.entries.forEach((entry, id) => clockIds.set(entry.key, id))
    } else if (packet.id === 'minecraft:dimension_type') {
      dimensionClocks.clear()
      for (const entry of packet.entries) {
        const dimension = entry.value ? nbt.simplify(entry.value) : null
        dimensionClocks.set(entry.key, dimension?.default_clock)
      }
    }
  })
  bot.time = {
    doDaylightCycle: null,
    bigTime: null,
    time: null,
    timeOfDay: null,
    day: null,
    isDay: null,
    moonPhase: null,
    bigAge: null,
    age: null,
    clocks: {}
  }
  bot._client.on('update_time', (packet) => {
    let time
    let age
    let doDaylightCycle

    // 26.1+: { age/gameTime, clockUpdates:[{id,totalTicks,partialTick,rate}] }
    // older: { age, time, tickDayTime? }
    if (packet.clockUpdates) {
      age = longToBigInt(packet.gameTime ?? packet.age ?? 0)
      advanceClocks()
      for (const update of packet.clockUpdates) {
        const id = update.id ?? update.clock
        const clock = {
          totalTicks: longToBigInt(update.totalTicks),
          partialTick: update.partialTick ?? 0,
          rate: update.rate
        }
        clocks.set(id, clock)
        updatedAt.set(id, performance.now())
      }
      for (const [name, id] of clockIds) {
        if (clocks.has(id)) bot.time.clocks[name] = clocks.get(id)
      }
      if (!clockTimer) {
        clockTimer = setInterval(advanceClocks, 50)
        clockTimer.unref()
      }
      const clockId = clockIds.get(dimensionClocks.get(qualified(bot.game?.dimension)))
      const clockUpdate = clocks.get(clockId)
      if (!clockUpdate) {
        // Unknown/default-less dimensions have no inferred day clock.
        for (const key of Object.keys(bot.time)) {
          if (key !== 'clocks') bot.time[key] = null
        }
        bot.time.bigAge = age
        bot.time.age = Number(age)
        bot.emit('time')
        return
      }
      time = longToBigInt(clockUpdate.totalTicks)
      doDaylightCycle = clockUpdate.rate !== 0
    } else {
      time = longToBigInt(packet.time)
      age = longToBigInt(packet.age)
      doDaylightCycle = packet.tickDayTime !== undefined ? !!packet.tickDayTime : time >= 0n
    }

    // When doDaylightCycle is false, we need to take the absolute value of time
    const finalTime = doDaylightCycle ? time : (time < 0n ? -time : time)

    bot.time.doDaylightCycle = doDaylightCycle
    bot.time.bigTime = finalTime
    bot.time.time = Number(finalTime)
    bot.time.timeOfDay = bot.time.time % 24000
    bot.time.day = Math.floor(bot.time.time / 24000)
    bot.time.isDay = bot.time.timeOfDay >= 0 && bot.time.timeOfDay < 13000
    bot.time.moonPhase = bot.time.day % 8
    bot.time.bigAge = age
    bot.time.age = Number(age)

    bot.emit('time')
  })
  // World clocks progress at 20 ticks/second even when physics is disabled.
  // Account for actual elapsed time so delayed timers do not lose ticks.
  function advanceClocks () {
    const now = performance.now()
    for (const [id, clock] of clocks) {
      const elapsed = now - updatedAt.get(id)
      updatedAt.set(id, now)
      if (bot._client.state && bot._client.state !== 'play') continue
      clock.partialTick += elapsed / 50 * clock.rate
      const fullTicks = Math.floor(clock.partialTick)
      clock.partialTick -= fullTicks
      clock.totalTicks += BigInt(fullTicks)
    }
  }

  function stopClocks () {
    clearInterval(clockTimer)
    clockTimer = undefined
  }
  bot.on('end', stopClocks)
  bot._client.on('end', stopClocks)
}

function longToBigInt (arr) {
  if (typeof arr === 'bigint') return arr
  if (typeof arr === 'number') return BigInt(arr)
  if (arr == null) return 0n
  if (Array.isArray(arr)) {
    return BigInt.asIntN(64, (BigInt(arr[0]) << 32n) | BigInt(arr[1] >>> 0))
  }
  if (typeof arr === 'object' && ('high' in arr || 'low' in arr)) {
    return BigInt.asIntN(64, (BigInt(arr.high) << 32n) | BigInt(arr.low >>> 0))
  }
  return BigInt(arr)
}
