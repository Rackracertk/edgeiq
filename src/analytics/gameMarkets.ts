import { loadDailySlate, type CheatSport, type ScheduledGame, type Slate } from '../cheatSheetData'
import { parseGameMarkets, extractMarketObject, hasCompleteMarketQuote, type GameMarkets, type MarketsSlate } from './marketParsing'
export type { GameMarkets, MarketsSlate } from './marketParsing'
export { parseGameMarkets, americanImpliedProbability, normalizedMoneylineProbability } from './marketParsing'

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

function easternDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const part = (name: string) => parts.find(item => item.type === name)?.value ?? ''
  return part('year') + part('month') + part('day')
}
async function nextNFLSlate(): Promise<Slate> {
  const today = easternDate(new Date())
  let anyResponse = false
  for (let offset = 0; offset < 15; offset++) {
    const day = easternDate(new Date(Date.now() + offset * 86400000))
    let events: any[]
    try {
      const data = await json(urlForDate('NFL', day))
      events = data.events ?? []
      anyResponse = true
    } catch { continue }
    const upcoming = events.filter(event => event.status?.type?.completed !== true &&
      Date.parse(event.date) > Date.now() && Array.isArray(event.competitions?.[0]?.competitors) &&
      event.competitions[0].competitors.length === 2)
    const games: ScheduledGame[] = upcoming.map(event => ({
      id: String(event.id),
      date: String(event.date),
      teams: (event.competitions[0].competitors as any[]).map(entry => ({
        id: String(entry.team?.id ?? ''),
        abbreviation: String(entry.team?.abbreviation ?? ''),
        name: String(entry.team?.displayName ?? ''),
        homeAway: entry.homeAway === 'home' || entry.homeAway === 'away' ? entry.homeAway : undefined,
      })),
    })).filter(game => game.id && game.teams.every(team => team.abbreviation && team.homeAway))
    if (games.length) {
      return {
        date: day,
        label: new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York', weekday: 'long', month: 'short', day: 'numeric',
        }).format(new Date(games[0].date)),
        isToday: day === today,
        games,
        source: 'ESPN NFL scoreboard',
        seasonEvents: events,
      }
    }
  }
  if (!anyResponse) throw new Error('NFL schedule feed is temporarily unavailable.')
  return { date: today, label: 'Upcoming NFL games', isToday: true, games: [], source: 'ESPN NFL scoreboard' }
}

export async function loadGameMarkets(sport: CheatSport): Promise<MarketsSlate> {
  let slate: Slate
  if (sport === 'NFL') {
    try {
      slate = await loadDailySlate(sport)
    } catch {
      slate = await nextNFLSlate()
    }
    if (!slate.games.length) slate = await nextNFLSlate()
  } else {
    slate = await loadDailySlate(sport)
  }
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
      if (!hasCompleteMarketQuote(extractMarketObject(event))) {
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
