import type { Bot, BotOptions, WorldClock } from '../index'

export function verifyReviewedApi (bot: Bot): Promise<void> {
  const options: BotOptions = { username: 'typecheck', particleStatus: 'minimal' }
  bot.settings.particleStatus = options.particleStatus ?? 'all'
  const clock: WorldClock = bot.time.clocks['minecraft:overworld']
  const totalTicks: bigint = clock.totalTicks
  const partialTick: number = clock.partialTick
  const rate: number = clock.rate
  const rain: number = bot.rainState
  void [totalTicks, partialTick, rate, rain]
  // @ts-expect-error Only supported wire values may be configured.
  options.particleStatus = 'unsupported'
  return bot.closeWindow(bot.inventory)
}
