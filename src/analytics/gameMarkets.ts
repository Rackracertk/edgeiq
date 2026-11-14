import { loadDailySlate, type CheatSport, type ScheduledGame } from '../cheatSheetData'

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
function extractMarketObject(event: any): any | null {
  const options = getOddsCandidates(event)
  return options.find(item =>
    item.homeTeamOdds?.moneyLine != null || item.awayTeamOdds?.moneyLine != null ||
    item.overUnder != null || item.spread != null || item.details
  ) ?? null
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
  const odds = initial ?? extractMarketObject(supplemental)
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
async function json(url: string): Promise<any> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('Schedule request failed (' + response.status + ')')
  return response.json()
}
function urlForDate(sport: CheatSport, date: string): string {
  const endpoint = sport === 'NBA'
    ? 'basketball/nba' : 'football/nfl'
  return 'https://site.api.espn.com/apis/site/v2/sports/' + endpoint +
    '/scoreboard?dates=' + encodeURIComponent(date) + '&limit=100'
}
function summaryUrl(sport: CheatSport, eventId: string): string {
  const endpoint = sport === 'NBA' ? 'basketball/nba' : 'football/nfl'
  return 'https://site.api.espn.com/apis/site/v2/sports/' + endpoint +
    '/summary?event=' + encodeURIComponent(eventId)
}
function fallbackEvent(game: ScheduledGame): any {
  // Only used for team names / times; no odds or probabilities are synthesized.
  return {
    id: game.id, date: game.date, competitions: [{
      competitors: game.teams.map(team => ({
        homeAway: team.homeAway,
        team: { displayName: team.name, abbreviation: team.abbreviation },
      })),
    }],
  }
}

export async function loadGameMarkets(sport: CheatSport): Promise<MarketsSlate> {
  const slate = await loadDailySlate(sport)
  const gameIds = new Set(slate.games.map(game => game.id))
  let events: any[] = []
  let incomplete = false
  if (slate.games.length) {
    try {
      const data = await json(urlForDate(sport, slate.date))
      events = (data.events ?? []).filter((event: any) => gameIds.has(String(event.id)))
    } catch {
      // A valid schedule may still have missing odds, so continue with
      // the original schedule and leave unverified values blank.
      incomplete = true
    }
  }
  const byId = new Map<string, any>(events.map(event => [String(event.id), event]))
  if (sport === 'NFL') {
    for (const event of slate.seasonEvents ?? []) {
      if (gameIds.has(String(event.id)) && !byId.has(String(event.id))) byId.set(String(event.id), event)
    }
  }
  const marketRows: GameMarkets[] = []
  // Fetch an individual game summary only when no market fields were found
  // on the scoreboard. The summary occasionally has a pickcenter entry.
  for (let i = 0; i < slate.games.length; i += 5) {
    const batch = await Promise.all(slate.games.slice(i, i + 5).map(async game => {
      const event = byId.get(game.id) ?? fallbackEvent(game)
      let supplemental: any = null
      if (!extractMarketObject(event)) {
        try { supplemental = await json(summaryUrl(sport, game.id)) }
        catch { incomplete = true }
      }
      // Summary response carries "pickcenter" at the root, while the
      // schedule remains authoritative for the home/away participants.
      return parseGameMarkets(event, sport, supplemental)
    }))
    marketRows.push(...batch.filter((game): game is GameMarkets => game !== null))
  }
  return {
    sport, date: slate.date, dateLabel: slate.label,
    isToday: slate.isToday,
    checkedAt: new Date().toISOString(),
    games: marketRows.sort((a, b) => a.date.localeCompare(b.date)),
    incomplete,
  }
}
