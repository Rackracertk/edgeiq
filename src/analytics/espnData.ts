export const NBA_SEASON_YEAR = 2027

type ESPNGame = {
  id: string
  date: string
  season?: { year?: number; type?: number }
  status?: { type?: { completed?: boolean } }
  competitions?: Array<{
    competitors?: Array<{
      id?: string
      team?: { id?: string; displayName?: string }
      homeAway?: string
    }>
  }>
}

type ESPNPlayerStats = {
  id: string
  name: string
  team: string
  teamId: string
  position: string
  points: number
  rebounds: number
  assists: number
  threes: number
}

type ESPNPlayerHistory = ESPNPlayerStats & {
  date: string
  gameId: string
  opponent: string
  homeAway: 'home' | 'away'
}

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

function parseStat(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  if (String(value).trim() === '') return null

  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export function extractNBAPlayerStats(boxscorePlayers: any[]): ESPNPlayerStats[] {
  return boxscorePlayers.flatMap((team: any) => {
    const group = team.statistics?.[0]
    const athletes = group?.athletes ?? []
    const keys: string[] = group?.keys ?? []
    const teamId = team.team?.id == null ? '' : String(team.team.id)
    const teamName = String(team.team?.displayName ?? '')

    return athletes.flatMap((player: any) => {
      if (player.didNotPlay !== false || !teamId || !teamName || !player.athlete?.id || !player.athlete?.displayName) return []

      const stats: unknown[] = player.stats ?? []
      const statAt = (key: string) => {
        const index = keys.indexOf(key)
        return index >= 0 ? parseStat(stats[index]) : null
      }

      const points = statAt('points')
      const rebounds = statAt('rebounds')
      const assists = statAt('assists')
      const threesIndex = keys.indexOf('threePointFieldGoalsMade-threePointFieldGoalsAttempted')
      const threesMatch = threesIndex >= 0
        ? String(stats[threesIndex] ?? '').match(/^(\d+)-(\d+)$/)
        : null
      const threes = threesMatch ? parseStat(threesMatch[1]) : null

      if (points === null || rebounds === null || assists === null || threes === null) return []

      return [{
        id: String(player.athlete.id),
        name: String(player.athlete.displayName),
        team: teamName,
        teamId,
        position: String(player.athlete.position?.abbreviation ?? player.athlete.position?.name ?? '').toUpperCase(),
        points,
        rebounds,
        assists,
        threes,
      }]
    })
  })
}

export type NBARecentGamesResult = {
  games: ESPNGame[]
  failedDates: string[]
}

export async function getRecentNBAGames(days = 30): Promise<NBARecentGamesResult> {
  const today = new Date()
  const seasonStart = new Date(NBA_SEASON_YEAR - 1, 9, 1)
  const dates: string[] = []
  for (let i = 0; i < days; i++) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    if (date < seasonStart) break
    dates.push([date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join(''))
  }

  const uniqueGames = new Map<string, ESPNGame>()
  const failedDates: string[] = []
  let successfulDays = 0
  for (let i = 0; i < dates.length; i += 6) {
    const results = await Promise.all(dates.slice(i, i + 6).map(async date => {
      try { return { date, games: await getNBAGames(date) } }
      catch (error) {
        console.warn('NBA scoreboard unavailable for ' + date, error)
        return { date, games: null }
      }
    }))
    for (const result of results) {
      if (!result.games) {
        failedDates.push(result.date)
        continue
      }
      successfulDays++
      for (const game of result.games) {
        if (
          game.id &&
          game.status?.type?.completed === true &&
          game.season?.year === NBA_SEASON_YEAR &&
          game.season?.type === 2
        ) {
          uniqueGames.set(String(game.id), game)
        }
      }
    }
  }
  if (dates.length && successfulDays === 0) throw new Error('NBA scoreboard requests failed; please retry later.')

  return {
    games: Array.from(uniqueGames.values()).sort((a, b) => String(b.date).localeCompare(String(a.date))),
    failedDates,
  }
}

export function buildNBAPlayerHistory(
  games: ESPNGame[],
  boxScores: any[][]
): Record<string, ESPNPlayerHistory[]> {
  const history: Record<string, ESPNPlayerHistory[]> = {}
  const seenGameIds = new Set<string>()

  games.forEach((game, index) => {
    const gameId = String(game.id ?? '')
    if (
      !gameId ||
      seenGameIds.has(gameId) ||
      game.status?.type?.completed !== true ||
      game.season?.year !== NBA_SEASON_YEAR ||
      game.season?.type !== 2
    ) return
    seenGameIds.add(gameId)

    const competitors = game.competitions?.[0]?.competitors ?? []
    if (competitors.length !== 2) return

    const players = extractNBAPlayerStats(boxScores[index] ?? [])
    players.forEach(player => {
      const competitor = competitors.find(entry => String(entry.team?.id ?? entry.id ?? '') === player.teamId)
      const opponent = competitors.find(entry => String(entry.team?.id ?? entry.id ?? '') !== player.teamId)
      const opponentName = String(opponent?.team?.displayName ?? '')
      const homeAway = competitor?.homeAway
      if (!competitor || !opponentName || (homeAway !== 'home' && homeAway !== 'away')) return

      if (!history[player.id]) history[player.id] = []
      history[player.id].push({
        ...player,
        date: game.date,
        gameId,
        opponent: opponentName,
        homeAway,
      })
    })
  })

  Object.values(history).forEach(playerGames => {
    playerGames.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  })

  return history
}
