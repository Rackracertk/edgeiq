export type NFLHistoryRow = {
  gameId: string
  date: string
  playerId: string
  player: string
  team: string
  stats: Record<string, number>
}

export type NFLBoxGame = { id: string; date: string }

export const NFL_PROP_CATEGORIES = [
  'Passing Yards', 'Passing TDs', 'Interceptions Thrown',
  'Rushing Yards', 'Rushing Attempts',
  'Receiving Yards', 'Receptions', 'Receiving TDs',
  'Sacks',
] as const

export function defaultNFLLine(category: string): number {
  if (category === 'Interceptions Thrown' || category === 'Sacks' || category === 'Passing TDs' || category === 'Receiving TDs') return 0.5
  if (category === 'Rushing Attempts') return 14.5
  if (category === 'Receptions') return 4.5
  if (category === 'Rushing Yards' || category === 'Receiving Yards') return 49.5
  return 199.5
}

function normalized(value: unknown): string {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function statAt(values: unknown, rawLabels: unknown, aliases: string[]): number | null {
  if (!Array.isArray(values) || !Array.isArray(rawLabels)) return null
  const names = new Set(aliases.map(normalized))
  const idx = rawLabels.findIndex((label: unknown) => names.has(normalized(label)))
  if (idx < 0 || values[idx] == null || String(values[idx]).trim() === '') return null
  const value = Number(values[idx])
  return Number.isFinite(value) && value >= 0 ? value : null
}

// Sacks here are DEFENSIVE sacks credited to a player, not the
// offensive number of times a quarterback was sacked.
// Interceptions Thrown come solely from the QB passing group:
// never confuse them with interceptions caught by a defender.
export function parseNFLBoxscore(data: any, game: NFLBoxGame): NFLHistoryRow[] {
  const records: NFLHistoryRow[] = []
  for (const side of data.boxscore?.players ?? []) {
    const team = String(side.team?.abbreviation ?? '')
    if (!team) continue
    for (const group of side.statistics ?? []) {
      const groupName = String(group.name ?? group.type ?? '').toLowerCase()
      const labels: unknown = group.labels ?? group.keys ?? []
      for (const athlete of group.athletes ?? []) {
        if (athlete.didNotPlay === true || !athlete.athlete?.id) continue
        const stats: Record<string, number> = {}
        const put = (category: string, aliases: string[]) => {
          const value = statAt(athlete.stats ?? [], labels, aliases)
          if (value !== null) stats[category] = value
        }
        if (groupName.includes('passing')) {
          put('Passing Yards', ['YDS', 'passingYards'])
          put('Passing TDs', ['TD', 'passingTouchdowns'])
          put('Interceptions Thrown', ['INT', 'INTS', 'interceptions'])
        }
        if (groupName.includes('rushing')) {
          put('Rushing Yards', ['YDS', 'rushingYards'])
          put('Rushing Attempts', ['CAR', 'ATT', 'rushingAttempts'])
        }
        if (groupName.includes('receiving')) {
          put('Receiving Yards', ['YDS', 'receivingYards'])
          put('Receptions', ['REC', 'receptions'])
          put('Receiving TDs', ['TD', 'receivingTouchdowns'])
        }
        if (groupName.includes('defensive') || groupName.includes('defense')) {
          put('Sacks', ['SACK', 'SACKS', 'SK', 'SCK', 'sacks'])
        }
        if (!Object.keys(stats).length) continue
        records.push({
          gameId: game.id,
          date: game.date,
          playerId: String(athlete.athlete.id),
          player: String(athlete.athlete.displayName ?? ''),
          team,
          stats,
        })
      }
    }
  }
  return records
}
