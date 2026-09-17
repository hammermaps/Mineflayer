module.exports = inject

// TODO: apply this to all versions and rename scoreboard_team -> teams in minecraft-data
const TEAM_MODES = ['add', 'remove', 'change', 'join', 'leave']

function inject (bot) {
  const Team = require('../team')(bot.registry)
  const teams = {}

  function teamHandler (packet) {
    const { team: teamName, players = [] } = packet
    const mode = typeof packet.mode === 'number' ? TEAM_MODES[packet.mode] : packet.mode

    // 26.2 renamed the display name and made color optional; modern flags are decoded objects.
    const name = packet.name ?? packet.displayName
    const formatting = packet.formatting ?? packet.color ?? -1
    const friendlyFire = packet.friendlyFire ?? ((packet.flags?.friendly_fire ? 1 : 0) | (packet.flags?.see_friendly_invisible ? 2 : 0))
    let team = teams[teamName]

    switch (mode) {
      case 'add':
        team = new Team(
          teamName,
          name,
          friendlyFire,
          packet.nameTagVisibility,
          packet.collisionRule,
          formatting,
          packet.prefix,
          packet.suffix
        )
        for (const player of players) {
          team.add(player)
          bot.teamMap[player] = team
        }
        teams[teamName] = team
        bot.emit('teamCreated', teams[teamName])
        break

      case 'remove':
        if (!team) break
        team.members.forEach((member) => {
          delete bot.teamMap[member]
        })
        delete teams[teamName]
        bot.emit('teamRemoved', team)
        break

      case 'change':
        if (!team) break
        team.update(
          name,
          friendlyFire,
          packet.nameTagVisibility,
          packet.collisionRule,
          formatting,
          packet.prefix,
          packet.suffix
        )
        bot.emit('teamUpdated', teams[teamName])
        break

      case 'join':
        if (!team) break
        for (const player of players) {
          team.add(player)
          bot.teamMap[player] = team
        }
        bot.emit('teamMemberAdded', teams[teamName])
        break

      case 'leave':
        if (!team) break
        for (const player of players) {
          team.remove(player)
          delete bot.teamMap[player]
        }
        bot.emit('teamMemberRemoved', teams[teamName])
        break

      default:
        bot._warn(`Unknown team mode handling team update: ${mode}`)
    }
  }

  if (bot.supportFeature('teamUsesScoreboard')) {
    bot._client.on('scoreboard_team', teamHandler)
  } else {
    bot._client.on('teams', teamHandler)
  }

  bot.teams = teams
  bot.teamMap = {}

  // No team survives a login; the dropped teams emit no teamRemoved and the objects stay the same.
  const reset = () => {
    for (const teamName of Object.keys(teams)) delete teams[teamName]
    for (const member of Object.keys(bot.teamMap)) delete bot.teamMap[member]
  }
  // Run before game emits the public login event, including user callbacks.
  bot._client.prependListener('login', reset)
}
