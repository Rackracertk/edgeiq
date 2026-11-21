import type { NFLHistoryRow } from './nflBoxscore.ts'

export type NFLDefensiveYardCategory = 'Passing Yards' | 'Rushing Yards'
export type NFLDefensiveYardRow = {
  team: string
  games: number
  yardsAllowed: number
}

/** Actual completed-game opponent offense totals, never a forecast.
 * Each game must have a stat-bearing box-score entry for BOTH teams.
 * Deduplicate individual athlete rows in the same game/category.
 */
export function rankNFLDefensiveYards(
  rows: NFLHistoryRow[],
  category: NFLDefensiveYardCategory,
  minimumGames = 3,
): NFLDefensiveYardRow[] {
  const byGame = new Map<string, Map<string, { total: number; seen: Set<string> }>>()
  for (const row of rows) {
    if (!row.gameId || !row.team) continue
    const yards = row.stats[category]
    if (typeof yards !== 'number' || !Number.isFinite(yards)) continue
    let byTeam = byGame.get(row.gameId)
    if (!byTeam) { byTeam = new Map(); byGame.set(row.gameId, byTeam) }
    let offense = byTeam.get(row.team)
    if (!offense) { offense = {total: 0, seen: new Set()}; byTeam.set(row.team, offense) }
    if (offense.seen.has(row.playerId)) continue
    offense.seen.add(row.playerId)
    offense.total += yards
  }

  const allowed = new Map<string, number[]>()
  for (const teams of byGame.values()) {
    // A game without both offensive box scores isn't safe for defensive ranking.
    if (teams.size !== 2) continue
    for (const [defense] of teams) {
      const opponent = [...teams].find(([name]) => name !== defense)?.[1]
      if (!opponent) continue
      const values = allowed.get(defense) ?? []
      values.push(opponent.total)
      allowed.set(defense, values)
    }
  }

  return [...allowed].flatMap(([team, values]) =>
    values.length < minimumGames ? [] : [{
      team,
      games: values.length,
      yardsAllowed: values.reduce((sum, yards) => sum + yards, 0) / values.length,
    }]
  ).sort((a, b) => a.yardsAllowed - b.yardsAllowed || a.team.localeCompare(b.team))
}
