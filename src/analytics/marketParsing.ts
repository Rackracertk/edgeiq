import type { CheatSport } from '../cheatSheetData'

export type GameMarkets = {
  id: string
  sport: CheatSport
  date: string
  home: { name: string; abbreviation: string }
  away: { name: string; abbreviation: string }
  provider: string | null
  homeMoneyline: number | null
  awayMoneyline: number | null
  homeSpread: number | null
  awaySpread: number | null
  spreadDescription: string | null
  homeSpreadOdds: number | null
  awaySpreadOdds: number | null
  total: number | null
  overOdds: number | null
  underOdds: number | null
  homeProbability: number | null
  awayProbability: number | null
  hasMarkets: boolean
}
export type MarketsSlate = {
  sport: CheatSport
  date: string
  dateLabel: string
  isToday: boolean
  checkedAt: string
  games: GameMarkets[]
  incomplete: boolean
}

function numeric(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (String(value).trim() === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
function moneyline(value: unknown): number | null {
  const number = numeric(value)
  if (number === null || !Number.isInteger(number) || number === 0 || Math.abs(number) < 100) return null
  return number
}
export function americanImpliedProbability(line: number): number {
  return line < 0 ? -line / (-line + 100) : 100 / (line + 100)
}
export function normalizedMoneylineProbability(
  home: number | null, away: number | null,
): { home: number; away: number } | null {
  if (home === null || away === null) return null
  const h = americanImpliedProbability(home)
  const a = americanImpliedProbability(away)
  if (!Number.isFinite(h) || !Number.isFinite(a) || h + a <= 0) return null
  return { home: Math.round(h / (h + a) * 1000) / 10, away: Math.round(a / (h + a) * 1000) / 10 }
}
function getOddsCandidates(event: any): any[] {
  const comp = event?.competitions?.[0]
  const list = [
    ...(Array.isArray(comp?.odds) ? comp.odds : []),
    ...(Array.isArray(event?.odds) ? event.odds : []),
    ...(Array.isArray(event?.pickcenter) ? event.pickcenter : []),
    ...(Array.isArray(event?.data?.pickcenter) ? event.data.pickcenter : []),
  ]
  return list.filter(x => x && typeof x === 'object')
}
function completeness(odds: any): number {
  if (!odds || typeof odds !== 'object') return 0
  let count = 0
  if (moneyline(odds.homeTeamOdds?.moneyLine) !== null) count += 2
  if (moneyline(odds.awayTeamOdds?.moneyLine) !== null) count += 2
  if (numeric(odds.overUnder) !== null && numeric(odds.overUnder)! > 0) count += 1
  if (numeric(odds.spread) !== null ||
      numeric(odds.homeTeamOdds?.spread) !== null ||
      numeric(odds.awayTeamOdds?.spread) !== null ||
      (typeof odds.details === 'string' && odds.details.trim())) count += 1
  if (typeof odds.provider?.name === 'string' && odds.provider.name.trim()) count += .1
  return count
}
export function extractMarketObject(event: any): any | null {
  const options = getOddsCandidates(event).filter(item => completeness(item) > 0)
  options.sort((a, b) => completeness(b) - completeness(a))
  return options[0] ?? null
}
export function hasCompleteMarketQuote(odds: any): boolean {
  return completeness(odds) >= 6
}
function findTeams(event: any): {
  home: { name: string; abbreviation: string }
  away: { name: string; abbreviation: string }
} | null {
  const competitors = event?.competitions?.[0]?.competitors
  if (!Array.isArray(competitors) || competitors.length !== 2) return null
  const home = competitors.find((t: any) => t.homeAway === 'home')
  const away = competitors.find((t: any) => t.homeAway === 'away')
  if (!home?.team || !away?.team) return null
  const label = (t: any) => ({
    name: String(t.team.displayName ?? t.team.name ?? t.team.abbreviation ?? ''),
    abbreviation: String(t.team.abbreviation ?? ''),
  })
  return { home: label(home), away: label(away) }
}

export function parseGameMarkets(event: any, sport: CheatSport, supplemental?: any): GameMarkets | null {
  const teams = findTeams(event)
  if (!teams || !event?.id || !event?.date) return null
  const initial = extractMarketObject(event)
  const extra = extractMarketObject(supplemental)
  // Choose one coherent sportsbook quote, never combine lines from
  // different providers into a synthetic market.
  const odds = completeness(extra) > completeness(initial) ? extra : initial
  const homeOdds = odds?.homeTeamOdds ?? {}
  const awayOdds = odds?.awayTeamOdds ?? {}
  const homeMoneyline = moneyline(homeOdds.moneyLine)
  const awayMoneyline = moneyline(awayOdds.moneyLine)
  const probabilities = normalizedMoneylineProbability(homeMoneyline, awayMoneyline)
  const rawSpread = numeric(odds?.spread)
  const explicitHomeSpread = numeric(homeOdds.spread ?? homeOdds.pointSpread)
  const explicitAwaySpread = numeric(awayOdds.spread ?? awayOdds.pointSpread)
  let homeSpread: number | null = explicitHomeSpread
  let awaySpread: number | null = explicitAwaySpread
  // On this feed "spread" alone is the favored team's spread; use
  // the mutually exclusive favorite flags rather than guessing which
  // home/away team owns that number.
  if (rawSpread !== null && homeSpread === null && awaySpread === null && rawSpread !== 0) {
    const isHomeFavorite = homeOdds.favorite === true && awayOdds.favorite === false
    const isAwayFavorite = awayOdds.favorite === true && homeOdds.favorite === false
    if (isHomeFavorite || isAwayFavorite) {
      const absolute = Math.abs(rawSpread)
      homeSpread = isHomeFavorite ? -absolute : absolute
      awaySpread = -homeSpread
    }
  }
  if (homeSpread !== null && awaySpread === null) awaySpread = -homeSpread
  if (awaySpread !== null && homeSpread === null) homeSpread = -awaySpread
  const rawTotal = numeric(odds?.overUnder)
  const total = rawTotal !== null && rawTotal > 0 ? rawTotal : null
  const spreadDescription = typeof odds?.details === 'string' && odds.details.trim()
    ? odds.details.trim().slice(0, 80) : null
  const provider = typeof odds?.provider?.name === 'string' && odds.provider.name.trim()
    ? odds.provider.name.trim() : null
  const homeSpreadOdds = moneyline(homeOdds.spreadOdds)
  const awaySpreadOdds = moneyline(awayOdds.spreadOdds)
  const overOdds = moneyline(odds?.overOdds)
  const underOdds = moneyline(odds?.underOdds)
  return {
    id: String(event.id), date: String(event.date), sport, ...teams, provider,
    homeMoneyline, awayMoneyline, homeSpread, awaySpread,
    spreadDescription, homeSpreadOdds, awaySpreadOdds,
    total, overOdds, underOdds,
    homeProbability: probabilities?.home ?? null,
    awayProbability: probabilities?.away ?? null,
    hasMarkets: homeMoneyline !== null || awayMoneyline !== null ||
      homeSpread !== null || awaySpread !== null || !!spreadDescription || total !== null,
  }
}
