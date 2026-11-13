
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
  const allGames: any[] = []

  for (let i = 0; i < days; i++) {
    const date = new Date()
    date.setDate(date.getDate() - i)

    const dateString = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('')

    try {
      const games = await getNBAGames(dateString)
      allGames.push(...games)
    } catch (error) {
      console.error('Failed to load games:', error)
    }
  }

  return allGames
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
