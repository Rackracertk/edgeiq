import { getNBAGamePropValue, type NBAPlayerGame } from './nbaData.ts'
import { asDefensePosition } from './defensiveMatchups.ts'
import type { NFLHistoryRow } from './nflBoxscore.ts'
import type { CheatPick, CheatSport, Slate } from '../cheatSheetData.ts'

// Observed frequencies from completed games, never forecasts or guaranteed chances.
export type EvidenceRate = { hits: number; games: number; percentage: number }
export type DefenseEvidence = EvidenceRate & {
  position: string
  distinctGames: number
  averageAllowed: number
}
export type ElitePick = CheatPick & {
  last20: EvidenceRate | null
  headToHead: EvidenceRate | null
  defense: DefenseEvidence | null
  position: string
  volatility: number | null
  researchScore: number
  researchGrade: 'MATCHUP BACKED' | 'TREND ONLY'
}

type NBAPlayers = { id: string; name: string; team: string; teamId: string; position?: string }[]
type NBAHistory = Record<string, NBAPlayerGame[]>
type Observation = { playerId: string; gameId: string; value: number }
const valid = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
const hit = (value: number, pick: CheatPick) =>
  pick.direction === 'over' ? value > pick.line : value < pick.line
const percent = (n: number, d: number) => Math.round(n / d * 100)
const toRate = (values: number[], pick: CheatPick): EvidenceRate | null =>
  values.length ? { hits: values.filter(value => hit(value, pick)).length, games: values.length,
    percentage: percent(values.filter(value => hit(value, pick)).length, values.length) } : null
const recent = (values: number[], max: number) => values.slice(0, max)
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length
const stdev = (values: number[]) => {
  if (values.length < 5) return null
  const average = mean(values)
  return Math.sqrt(mean(values.map(value => (value - average) ** 2)))
}

function nextOpponent(slate: Slate, pick: CheatPick) {
  const event = slate.games.find(game => game.date === pick.gameTime &&
    game.teams.some(team => team.abbreviation === pick.team))
  return event?.teams.find(team => team.abbreviation === pick.opponent)
}

function nbaEvidence(
  pick: CheatPick, slate: Slate, history: NBAHistory, players: NBAPlayers,
): { last20: EvidenceRate | null; headToHead: EvidenceRate | null; defense: DefenseEvidence | null;
  position: string; volatility: number | null } {
  const opponent = nextOpponent(slate, pick)
  const playerLogs = (history[pick.playerId] ?? [])
    .filter(log => Date.parse(log.date) < Date.parse(pick.gameTime))
    .sort((a, b) => b.date.localeCompare(a.date))
  const position = asDefensePosition(players.find(player => String(player.id) === pick.playerId)?.position ??
    playerLogs[0]?.position) ?? ''
  const values = playerLogs.flatMap(log => {
    const value = getNBAGamePropValue(log, pick.category)
    return valid(value) ? [value] : []
  })
  const h2h = playerLogs.filter(log => log.opponent === opponent?.name)
    .flatMap(log => {
      const value = getNBAGamePropValue(log, pick.category)
      return valid(value) ? [value] : []
    }).slice(0, 8)
  const appearances: Observation[] = []
  const distinct = new Set<string>()
  const seen = new Set<string>()
  // Compare against the *same opposing position*. Require real minutes so
  // low-minute bench appearances do not inflate or distort position allowances.
  if (opponent?.name && position) {
    for (const [athleteId, logs] of Object.entries(history)) for (const log of logs) {
      if (log.opponent !== opponent.name || asDefensePosition(log.position) !== position ||
          !valid(log.minutes) || log.minutes < 18 || !log.gameId ||
          Date.parse(log.date) >= Date.parse(pick.gameTime)) continue
      const value = getNBAGamePropValue(log, pick.category)
      const key = log.gameId + ':' + athleteId
      if (!valid(value) || seen.has(key)) continue
      seen.add(key)
      distinct.add(log.gameId)
      appearances.push({ playerId: athleteId, gameId: log.gameId, value })
    }
  }
  const observations = appearances.map(row => row.value)
  const opponentRate = observations.length >= 8 && distinct.size >= 4 ? toRate(observations, pick) : null
  const defense: DefenseEvidence | null = opponentRate
    ? { ...opponentRate, position, distinctGames: distinct.size,
        averageAllowed: Math.round(mean(observations) * 10) / 10 }
    : null
  return {
    last20: values.length >= 20 ? toRate(recent(values, 20), pick) : null,
    headToHead: h2h.length >= 2 ? toRate(h2h, pick) : null,
    defense, position: position || 'UNKNOWN', volatility: stdev(recent(values, 10)),
  }
}

function nflEvidence(
  pick: CheatPick, rows: NFLHistoryRow[],
): { last20: EvidenceRate | null; headToHead: EvidenceRate | null; defense: DefenseEvidence | null;
  position: string; volatility: number | null } {
  const own = new Map<string, NFLHistoryRow>()
  const observed = new Map<string, NFLHistoryRow>()
  const oppGames = new Set<string>()
  const matching = new Map<string, number>()
  for (const row of rows) {
    if (Date.parse(row.date) >= Date.parse(pick.gameTime)) continue
    if (row.playerId === pick.playerId && row.team === pick.team && valid(row.stats[pick.category])) {
      if (!own.has(row.gameId)) own.set(row.gameId, row)
    }
  }
  const playerLogs = Array.from(own.values()).sort((a, b) => b.date.localeCompare(a.date))
  const position = String(playerLogs.find(row => row.position)?.position ?? '').toUpperCase()
  const values = playerLogs.map(row => row.stats[pick.category])
  const h2h = playerLogs.filter(row => row.opponent === pick.opponent)
    .slice(0, 8).map(row => row.stats[pick.category])
  if (position) for (const row of rows) {
    if (row.opponent !== pick.opponent || row.position?.toUpperCase() !== position ||
        !valid(row.stats[pick.category]) || Date.parse(row.date) >= Date.parse(pick.gameTime)) continue
    const key = row.gameId + ':' + row.playerId
    if (observed.has(key)) continue
    observed.set(key, row)
    matching.set(key, row.stats[pick.category])
    oppGames.add(row.gameId)
  }
  const opponentValues = Array.from(matching.values())
  const opponentRate = opponentValues.length >= 8 && oppGames.size >= 4
    ? toRate(opponentValues, pick) : null
  const defense: DefenseEvidence | null = opponentRate
    ? { ...opponentRate, position, distinctGames: oppGames.size,
        averageAllowed: Math.round(mean(opponentValues) * 10) / 10 }
    : null
  return {
    last20: values.length >= 20 ? toRate(recent(values, 20), pick) : null,
    headToHead: h2h.length >= 2 ? toRate(h2h, pick) : null,
    defense, position: position || 'UNKNOWN', volatility: stdev(recent(values, 10)),
  }
}

export function enrichElitePicks(
  picks: CheatPick[], sport: CheatSport, slate: Slate,
  nbaHistory: NBAHistory, nflRows: NFLHistoryRow[], players: NBAPlayers,
): ElitePick[] {
  const ranked = picks.map(pick => {
    const evidence = sport === 'NBA'
      ? nbaEvidence(pick, slate, nbaHistory, players) : nflEvidence(pick, nflRows)
    const favorableMatchup = evidence.defense ? evidence.defense.percentage / 100 : null
    const h2hRate = evidence.headToHead ? evidence.headToHead.percentage / 100 : null
    const normalizedVolatility = evidence.volatility === null ? 0
      : evidence.volatility / Math.max(1, pick.average)
    // An explainable *ranking*, deliberately not a calibrated win probability.
    const score = Math.max(0, Math.min(100, Math.round(
      52 * (pick.recentHits / pick.recentGames) +
      12 * (pick.l5Hits / pick.l5Games) +
      (favorableMatchup === null ? 0 : 24 * favorableMatchup) +
      (h2hRate === null ? 0 : 7 * h2hRate) +
      Math.max(0, 5 - normalizedVolatility * 12)
    )))
    return {
      ...pick, ...evidence, researchScore: score,
      researchGrade: evidence.defense ? 'MATCHUP BACKED' as const : 'TREND ONLY' as const,
    }
  }).sort((a, b) =>
    Number(Boolean(b.defense)) - Number(Boolean(a.defense)) ||
    b.researchScore - a.researchScore ||
    b.recentHits - a.recentHits
  )
  const chosen: ElitePick[] = []
  const athleteCounts = new Map<string, number>()
  const teamCounts = new Map<string, number>()
  const statCounts = new Map<string, number>()
  for (const pick of ranked) {
    if (chosen.length >= 40) break
    const athlete = pick.sport + ':' + pick.playerId
    if ((athleteCounts.get(athlete) ?? 0) >= 2 ||
        (teamCounts.get(pick.team) ?? 0) >= 8 ||
        (statCounts.get(pick.category) ?? 0) >= 10) continue
    chosen.push(pick)
    athleteCounts.set(athlete, (athleteCounts.get(athlete) ?? 0) + 1)
    teamCounts.set(pick.team, (teamCounts.get(pick.team) ?? 0) + 1)
    statCounts.set(pick.category, (statCounts.get(pick.category) ?? 0) + 1)
  }
  return chosen
}

export function americanOddsBreakEven(odds: number): number | null {
  if (!Number.isFinite(odds) || (odds > -100 && odds < 100)) return null
  const probability = odds >= 100 ? 100 / (odds + 100) : -odds / (-odds + 100)
  return Math.round(probability * 1000) / 10
}
