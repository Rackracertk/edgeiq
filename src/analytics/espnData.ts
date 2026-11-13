
export async function getNBAGames(date: string) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${date}`

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`ESPN request failed: ${response.status}`)
  }

  const data = await response.json()
  return data.events ?? []
}

export async function getNBABoxScore(gameId: string) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${encodeURIComponent(gameId)}`

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`ESPN request failed: ${response.status}`)
  }

  const data = await response.json()
  return data.boxscore?.players ?? []
}

export function extractNBAPlayerStats(boxscorePlayers: any[]) {
  return boxscorePlayers.flatMap((team: any) => {
    const group = team.statistics?.[0]
    const athletes = group?.athletes ?? []
    const keys: string[] = group?.keys ?? []

    return athletes
      .filter((player: any) => !player.didNotPlay)
      .map((player: any) => {
        const stats: string[] = player.stats ?? []

        const getStat = (key: string) => {
          const index = keys.indexOf(key)
          return index >= 0 ? Number(stats[index]) || 0 : 0
        }




        const points = getStat('points')
        const rebounds = getStat('rebounds')
        const assists = getStat('assists')

        const threesIndex = keys.indexOf('threePointFieldGoalsMade-threePointFieldGoalsAttempted')
        const threesValue = threesIndex >= 0 ? stats[threesIndex] : '0-0'
        const threes = Number(threesValue?.split('-')[0]) || 0

        return {
          id: player.athlete?.id,
          name: player.athlete?.displayName,
          team: team.team?.displayName,
          position: String(player.athlete?.position?.abbreviation ?? player.athlete?.position?.name ?? '').toUpperCase(),
          points,
          rebounds,
          assists,
          threes,
          pra: points + rebounds + assists,
        }
      })
  })
}

export async function getRecentNBAGames(days = 30) {
  // Never mix the previous season into current-season research.
  const today = new Date()
  const seasonStartYear = today.getMonth() >= 9 ? today.getFullYear() : today.getFullYear() - 1
  const seasonStart = new Date(seasonStartYear, 9, 1)
  const dates: string[] = []
  for (let i = 0; i < days; i++) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    if (date < seasonStart) break
    dates.push([date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join(''))
  }

  const uniqueGames = new Map<string, any>()
  let successfulDays = 0
  // Small batches prevent the 60 sequential requests from delaying page load.
  for (let i = 0; i < dates.length; i += 6) {
    const results = await Promise.all(dates.slice(i, i + 6).map(async date => {
      try { return await getNBAGames(date) }
      catch (error) { console.warn('NBA scoreboard unavailable for ' + date, error); return null }
    }))
    for (const games of results) {
      if (!games) continue
      successfulDays++
      for (const game of games) {
        if (game.id && game.status?.type?.completed === true && (game.season?.type === 2 || game.season?.type === undefined)) {
          uniqueGames.set(String(game.id), game)
        }
      }
    }
  }
  if (dates.length && successfulDays === 0) throw new Error('NBA scoreboard requests failed; please retry later.')
  return Array.from(uniqueGames.values()).sort((a, b) => String(b.date).localeCompare(String(a.date)))
}

export function buildNBAPlayerHistory(
  games: any[],
  boxScores: any[][]
) {
  const history: Record<string, any[]> = {}

  games.forEach((game, index) => {
    if (game.status?.type?.completed !== true) return

    const players = extractNBAPlayerStats(boxScores[index] ?? [])

    players.forEach((player: any) => {
      if (!player.id) return

      const id = String(player.id)

      if (!history[id]) {
        history[id] = []
      }

      const alreadyExists = history[id].some(
  (existingGame) =>
    String(existingGame.gameId) === String(game.id)
)

if (!alreadyExists) {
  history[id].push({
    ...player,
    date: game.date,
    gameId: game.id,
  })
}
    })
  })

  Object.values(history).forEach((playerGames) => {
    playerGames.sort(
      (a, b) =>
        new Date(b.date).getTime() -
        new Date(a.date).getTime()
    )
  })

  return history
}
