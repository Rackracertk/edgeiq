import { getNBAGamePropValue, type NBAPlayerGame } from './nbaData.ts'

export type DefensePosition = 'G' | 'F' | 'C'
export type DefenseHistory = Record<string, (NBAPlayerGame & {
  gameId?: string
  team?: string
  position?: string
})[]>
export type DefenseRow = {
  team: string
  games: number
  allowedPerGame: number
  position?: DefensePosition
  appearances?: number
  distinctGames?: number
  allowedPerAppearance?: number
  hits?: number
  hitRate?: number
}
type Athlete = { playerId: string; team: string; position: DefensePosition | null; value: number; minutes: number | null }
type TeamBox = { athletes: Athlete[]; counted: Set<string> }
type GameBox = Map<string, TeamBox>

export function asDefensePosition(raw: string | null | undefined): DefensePosition | null {
  const position = String(raw ?? '').trim().toUpperCase()
  if (position === 'G' || position === 'PG' || position === 'SG') return 'G'
  if (position === 'F' || position === 'SF' || position === 'PF') return 'F'
  if (position === 'C') return 'C'
  return null
}

function rate(hits: number, samples: number) { return Math.round(hits / samples * 100) }
function rounded(value: number) { return Math.round(value * 10) / 10 }
function hit(value: number, line: number, direction: 'over' | 'under') {
  return direction === 'over' ? value > line : value < line
}

export function buildDefenseRankings(
  history: DefenseHistory,
  prop: string,
  line: number,
  direction: 'over' | 'under',
): { overall: DefenseRow[]; byPosition: Record<DefensePosition, DefenseRow[]>; validGames: number } {
  const byGame = new Map<string, GameBox>()
  for (const [playerId, logs] of Object.entries(history)) for (const game of logs) {
    if (!game.gameId || !game.team) continue
    const value = getNBAGamePropValue(game, prop)
    if (value === null) continue
    let gameTeams = byGame.get(game.gameId)
    if (!gameTeams) { gameTeams = new Map(); byGame.set(game.gameId, gameTeams) }
    let box = gameTeams.get(game.team)
    if (!box) { box = { athletes: [], counted: new Set() }; gameTeams.set(game.team, box) }
    if (box.counted.has(playerId)) continue
    box.counted.add(playerId)
    box.athletes.push({
      playerId, team: game.team, position: asDefensePosition(game.position),
      value, minutes: typeof game.minutes === 'number' && Number.isFinite(game.minutes) ? game.minutes : null,
    })
  }
  const overall = new Map<string, { totals: number[] }>()
  const positionRecords: Record<DefensePosition, Map<string, { totals: number[]; appearances: number; hits: number; distinctGames: Set<string>; appearancesValues: number[] }>> = {
    G: new Map(), F: new Map(), C: new Map(),
  }
  let validGames = 0
  for (const [gameId, gameTeams] of byGame) {
    if (gameTeams.size !== 2 || [...gameTeams.values()].some(box => box.athletes.length < 5)) continue
    validGames++
    const entries = [...gameTeams.entries()]
    for (const [defense] of entries) {
      const offense = entries.find(([team]) => team !== defense)?.[1]
      if (!offense) continue
      const sum = offense.athletes.reduce((total, athlete) => total + athlete.value, 0)
      let totals = overall.get(defense)
      if (!totals) { totals = {totals: []}; overall.set(defense, totals) }
      totals.totals.push(sum)
      for (const position of ['G', 'F', 'C'] as const) {
        const opponentGroup = offense.athletes.filter(p => p.position === position)
        if (!opponentGroup.length) continue
        let record = positionRecords[position].get(defense)
        if (!record) {
          record = { totals: [], appearances: 0, hits: 0, distinctGames: new Set(), appearancesValues: [] }
          positionRecords[position].set(defense, record)
        }
        record.totals.push(opponentGroup.reduce((total, p) => total + p.value, 0))
        // Qualifying appearances require adequate playing time, preventing brief
        // bench cameos from artificially increasing misses for individual props.
        const active = opponentGroup.filter(p => p.minutes !== null && p.minutes >= 18)
        for (const athlete of active) {
          record.appearances++
          record.hits += Number(hit(athlete.value, line, direction))
          record.appearancesValues.push(athlete.value)
          record.distinctGames.add(gameId)
        }
      }
    }
  }
  const overallRows: DefenseRow[] = [...overall].flatMap(([team, data]) => data.totals.length >= 3
    ? [{team, games: data.totals.length, allowedPerGame:rounded(data.totals.reduce((a,b)=>a+b,0)/data.totals.length)}] : [])
    .sort((a,b)=>a.allowedPerGame-b.allowedPerGame)
  const byPosition = Object.fromEntries((['G','F','C'] as const).map(position => {
    const rows: DefenseRow[] = [...positionRecords[position]].flatMap(([team, record]) => (
      record.totals.length >= 3 && record.appearances >= 8 && record.distinctGames.size >= 3
    ) ? [{
      team, games: record.totals.length, position,
      allowedPerGame: rounded(record.totals.reduce((a,b)=>a+b,0)/record.totals.length),
      appearances: record.appearances, distinctGames:record.distinctGames.size,
      allowedPerAppearance:rounded(record.appearancesValues.reduce((a,b)=>a+b,0)/record.appearances),
      hits:record.hits, hitRate:rate(record.hits,record.appearances),
    }] : [])
      .sort((a,b)=>(a.allowedPerAppearance??Infinity)-(b.allowedPerAppearance??Infinity))
    return [position, rows]
  })) as Record<DefensePosition, DefenseRow[]>
  return { overall: overallRows, byPosition, validGames }
}
