export type NFLHistoryRow = {
  gameId: string
  date: string
  playerId: string
  player: string
  team: string
  position?: string
  opponent?: string
  stats: Record<string, number>
}

export type NFLBoxGame = { id: string; date: string; teams?: { abbreviation: string }[] }

export const NFL_PROP_CATEGORIES = [
  'Passing Yards', 'Passing Completions', 'Passing Attempts', 'Passing TDs', 'Interceptions Thrown',
  'Rushing Yards', 'Rushing Attempts', 'Rushing TDs', 'Longest Rush',
  'Receiving Yards', 'Receptions', 'Receiving Targets', 'Receiving TDs', 'Longest Reception',
  'Sacks', 'Tackles', 'Solo Tackles',
] as const

export function defaultNFLLine(category: string): number {
  if (['Interceptions Thrown','Sacks','Passing TDs','Receiving TDs','Rushing TDs'].includes(category)) return 0.5
  if (category === 'Passing Completions') return 19.5
  if (category === 'Passing Attempts') return 29.5
  if (category === 'Rushing Attempts') return 14.5
  if (category === 'Longest Rush' || category === 'Longest Reception') return 19.5
  if (category === 'Receptions' || category === 'Receiving Targets') return 4.5
  if (category === 'Tackles') return 5.5
  if (category === 'Solo Tackles') return 3.5
  if (category === 'Rushing Yards' || category === 'Receiving Yards') return 49.5
  return 199.5
}

function normalized(value: unknown): string {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function statAt(values: unknown, rawLabels: unknown, aliases: string[], allowNegative = false): number | null {
  if (!Array.isArray(values) || !Array.isArray(rawLabels)) return null
  const names = new Set(aliases.map(normalized))
  const idx = rawLabels.findIndex((label: unknown) => names.has(normalized(label)))
  if (idx < 0 || values[idx] == null || String(values[idx]).trim() === '') return null
  const value = Number(values[idx])
  return Number.isFinite(value) && (allowNegative || value >= 0) ? value : null
}

function statRatio(values: unknown, labels: unknown, label: string): [number,number] | null {
  if (!Array.isArray(values) || !Array.isArray(labels)) return null
  const index = labels.findIndex(item => normalized(item) === normalized(label))
  if (index < 0 || values[index] == null) return null
  const text = String(values[index]).trim()
  const parsed = /^(\\d+)\\s*\\/\\s*(\\d+)$/.exec(text)
  if (!parsed) return null
  const completed = Number(parsed[1]), attempted = Number(parsed[2])
  return Number.isFinite(completed) && Number.isFinite(attempted) &&
    completed >= 0 && attempted >= completed ? [completed,attempted] : null
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
        const put = (category: string, aliases: string[], allowNegative = false) => {
          const value = statAt(athlete.stats ?? [], labels, aliases, allowNegative)
          if (value !== null) stats[category] = value
        }
        if (groupName.includes('passing')) {
          const cAtt = statRatio(athlete.stats ?? [], labels, 'C/ATT')
          if (cAtt) {
            stats['Passing Completions'] = cAtt[0]
            stats['Passing Attempts'] = cAtt[1]
          }
          put('Passing Yards', ['YDS', 'passingYards'])
          put('Passing TDs', ['TD', 'passingTouchdowns'])
          put('Interceptions Thrown', ['INT', 'INTS', 'interceptions'])
        }
        if (groupName.includes('rushing')) {
          put('Rushing Yards', ['YDS', 'rushingYards'], true)
          put('Rushing Attempts', ['CAR', 'ATT', 'rushingAttempts'])
          put('Rushing TDs', ['TD','rushingTouchdowns'])
          put('Longest Rush', ['LONG','LG','longRushing'])
        }
        if (groupName.includes('receiving')) {
          put('Receiving Yards', ['YDS', 'receivingYards'])
          put('Receptions', ['REC', 'receptions'])
          put('Receiving Targets', ['TGTS','targets'])
          put('Receiving TDs', ['TD', 'receivingTouchdowns'])
          put('Longest Reception', ['LONG','LG','longReceiving'])
        }
        if (groupName.includes('defensive') || groupName.includes('defense')) {
          put('Sacks', ['SACK', 'SACKS', 'SK', 'SCK', 'sacks'])
          put('Tackles', ['TOT','TOTAL','totalTackles'])
          put('Solo Tackles', ['SOLO','soloTackles'])
        }
        if (!Object.keys(stats).length) continue
        records.push({
          gameId: game.id,
          date: game.date,
          playerId: String(athlete.athlete.id),
          player: String(athlete.athlete.displayName ?? ''),
          team,
          position: String(athlete.athlete.position?.abbreviation ?? '').toUpperCase(),
          opponent: game.teams?.find(item => item.abbreviation !== team)?.abbreviation,
          stats,
        })
      }
    }
  }
  return records
}
