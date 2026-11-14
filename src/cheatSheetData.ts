import { getNBAGames } from './analytics/espnData'
import { getPlayerPropValues, type NBAPlayerGame } from './analytics/nbaData'

export type CheatSport = 'NBA' | 'NFL'
export type CheatPick = {
  id: string
  sport: CheatSport
  playerId: string
  player: string
  team: string
  opponent: string
  matchup: string
  gameTime: string
  category: string
  direction: 'over' | 'under'
  line: number
  l5Hits: number
  l5Games: number
  recentHits: number
  recentGames: number
  average: number
  sample: number
  score: number
  context: string
}
export type ScheduledGame = {
  id: string
  date: string
  teams: { id: string; abbreviation: string; name: string }[]
}
export type Slate = {
  date: string
  label: string
  isToday: boolean
  games: ScheduledGame[]
  source: string
  seasonEvents?: any[]
}
export type NFLHistoryRow = {
  gameId: string
  date: string
  playerId: string
  player: string
  team: string
  stats: Record<string, number>
}
type Candidate = Omit<CheatPick, 'id'>

const nbaReferenceLines: Record<string, number[]> = {
  Points: [9.5, 14.5, 19.5, 24.5, 29.5],
  Rebounds: [3.5, 5.5, 7.5, 9.5, 11.5],
  Assists: [2.5, 4.5, 6.5, 8.5, 10.5],
  '3-Pointers Made': [0.5, 1.5, 2.5, 3.5],
  PRA: [19.5, 24.5, 29.5, 34.5, 39.5, 44.5],
}
const nflReferenceLines: Record<string, number[]> = {
  'Passing Yards': [149.5, 199.5, 249.5, 299.5],
  'Passing TDs': [0.5, 1.5, 2.5],
  'Rushing Yards': [39.5, 59.5, 79.5, 99.5],
  'Rushing Attempts': [9.5, 14.5, 19.5],
  'Receiving Yards': [29.5, 49.5, 69.5, 89.5],
  Receptions: [2.5, 3.5, 4.5, 5.5, 6.5],
}

function eastDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? ''
  return get('year') + get('month') + get('day')
}
function readableDate(date: string): string {
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(4, 6))
  const day = Number(date.slice(6, 8))
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', weekday: 'long', timeZone: 'America/New_York',
  }).format(new Date(Date.UTC(year, month - 1, day, 16)))
}
function parseGame(event: any): ScheduledGame | null {
  const competitors = event?.competitions?.[0]?.competitors ?? []
  const teams = competitors.map((entry: any) => ({
    id: String(entry.team?.id ?? entry.id ?? ''),
    abbreviation: String(entry.team?.abbreviation ?? ''),
    name: String(entry.team?.displayName ?? ''),
  }))
  if (!event?.id || !event?.date || teams.length !== 2 || teams.some((t: ScheduledGame['teams'][number]) => !t.id || !t.abbreviation)) return null
  return { id: String(event.id), date: String(event.date), teams }
}
async function loadJSON(url: string): Promise<any> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Sports schedule unavailable (' + response.status + ')')
  return response.json()
}

export async function loadDailySlate(sport: CheatSport): Promise<Slate> {
  const today = eastDate(new Date())
  if (sport === 'NBA') {
    // Upcoming games only: never publish a "pick" for a game that is live or finished.
    for (let offset = 0; offset < 4; offset++) {
      const day = eastDate(new Date(Date.now() + offset * 86400000))
      const events = await getNBAGames(day)
      const games = events
        .filter((event: any) => event.status?.type?.completed !== true && Date.parse(event.date) > Date.now())
        .map(parseGame).filter((game: ScheduledGame | null): game is ScheduledGame => game !== null)
      if (games.length) {
        return { date: day, label: readableDate(day), isToday: day === today, games, source: 'ESPN NBA scoreboard' }
      }
    }
    return { date: today, label: readableDate(today), isToday: true, games: [], source: 'ESPN NBA scoreboard' }
  }

  const now = new Date()
  const seasonYear = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  const data = await loadJSON('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=' + seasonYear + '&seasontype=2&limit=300')
  const events: any[] = (data.events ?? []).filter((event: any) => event.season?.type === 2 || event.season?.type == null)
  const scheduled = events.filter((event: any) => event.status?.type?.completed !== true && Date.parse(event.date) > Date.now())
  const upcoming = scheduled.map(parseGame).filter((game: ScheduledGame | null): game is ScheduledGame => game !== null)
    .sort((a: ScheduledGame, b: ScheduledGame) => a.date.localeCompare(b.date))
  const nextDate = upcoming.length ? eastDate(new Date(upcoming[0].date)) : today
  const games = upcoming.filter((game: ScheduledGame) => eastDate(new Date(game.date)) === nextDate)
  return { date: nextDate, label: readableDate(nextDate), isToday: nextDate === today, games, source: 'ESPN NFL scoreboard', seasonEvents: events }
}

function evaluate(
  sport: CheatSport, playerId: string, player: string, team: string, game: ScheduledGame,
  category: string, values: number[], line: number, direction: 'over' | 'under',
): Candidate | null {
  const sample = Math.min(10, values.length)
  if (sample < (sport === 'NBA' ? 9 : 6)) return null
  const recent = values.slice(0, sample)
  if (recent.some(value => !Number.isFinite(value) || value < 0)) return null
  const last5 = recent.slice(0, 5)
  const hit = (value: number) => direction === 'over' ? value > line : value < line
  const l5Hits = last5.filter(hit).length
  const recentHits = recent.filter(hit).length
  if (l5Hits < 4 || recentHits < Math.ceil(sample * .7)) return null
  const average = recent.reduce((sum, value) => sum + value, 0) / sample
  const median = [...recent].sort((a, b) => a - b)[Math.floor(recent.length / 2)]
  // Ignore extreme thresholds that would generate misleading 100% trends.
  if (median <= 0 || line < median * .62 || line > median * 1.38) return null
  const margin = direction === 'over' ? average - line : line - average
  if (margin <= 0) return null
  const other = game.teams.find(item => item.abbreviation !== team)
  if (!other) return null
  const score = (recentHits / sample) * 60 + (l5Hits / 5) * 35 + Math.min(5, margin / Math.max(1, average) * 30)
  const context = l5Hits + '/5 recent games and ' + recentHits + '/' + sample + ' available games crossed this reference threshold.'
  return {
    sport, playerId, player, team, opponent: other.abbreviation,
    matchup: team + ' vs ' + other.abbreviation, gameTime: game.date,
    category, direction, line, l5Hits, l5Games: 5, recentHits, recentGames: sample,
    average: Math.round(average * 10) / 10, sample, score, context,
  }
}
function selectPicks(candidates: Candidate[]): CheatPick[] {
  const chosen: CheatPick[] = []
  const players = new Set<string>()
  const teams = new Map<string, number>()
  const categoryCounts = new Map<string, number>()
  candidates.sort((a, b) => b.score - a.score || b.recentHits - a.recentHits)
  for (const candidate of candidates) {
    if (chosen.length >= 24) break
    if (players.has(candidate.sport + candidate.playerId)) continue
    if ((teams.get(candidate.team) ?? 0) >= 3 || (categoryCounts.get(candidate.category) ?? 0) >= 7) continue
    chosen.push({ ...candidate, id: candidate.sport + '-' + candidate.playerId + '-' + candidate.category })
    players.add(candidate.sport + candidate.playerId)
    teams.set(candidate.team, (teams.get(candidate.team) ?? 0) + 1)
    categoryCounts.set(candidate.category, (categoryCounts.get(candidate.category) ?? 0) + 1)
  }
  return chosen
}
export function buildNBAPicks(
  slate: Slate, history: Record<string, NBAPlayerGame[]>,
  players: { id: string; name: string; team: string; teamId: string }[],
): CheatPick[] {
  const candidates: Candidate[] = []
  const events = new Map(slate.games.flatMap(game => game.teams.map(team => [team.id, game] as const)))
  for (const player of players) {
    const game = events.get(String(player.teamId))
    if (!game) continue
    const logs = history[String(player.id)] ?? []
    if (logs.length < 9) continue
    const newest = Date.parse(logs[0].date)
    if (!Number.isFinite(newest) || Date.now() - newest > 21 * 86400000) continue
    for (const [category, lines] of Object.entries(nbaReferenceLines)) {
      const values = getPlayerPropValues(logs, category)
      for (const line of lines) for (const direction of ['over', 'under'] as const) {
        const candidate = evaluate('NBA', String(player.id), player.name, game.teams.find(t => t.id === player.teamId)?.abbreviation ?? '', game, category, values, line, direction)
        if (candidate) candidates.push(candidate)
      }
    }
  }
  return selectPicks(candidates)
}
function nflNumeric(stats: unknown, labels: unknown, label: string): number | null {
  if (!Array.isArray(stats) || !Array.isArray(labels)) return null
  const index = labels.findIndex((item: unknown) => String(item).toUpperCase() === label)
  if (index < 0 || stats[index] == null || String(stats[index]).trim() === '') return null
  const result = Number(stats[index])
  return Number.isFinite(result) && result >= 0 ? result : null
}
function parseNFLBoxscore(data: any, game: ScheduledGame): NFLHistoryRow[] {
  const result: NFLHistoryRow[] = []
  for (const side of data.boxscore?.players ?? []) {
    const team = String(side.team?.abbreviation ?? '')
    if (!team) continue
    for (const group of side.statistics ?? []) {
      const type = String(group.name ?? group.type ?? '').toLowerCase()
      for (const athlete of group.athletes ?? []) {
        if (athlete.didNotPlay || !athlete.athlete?.id) continue
        const raw: Record<string, number> = {}
        const set = (category: string, label: string) => {
          const value = nflNumeric(athlete.stats, group.labels ?? group.keys ?? [], label)
          if (value !== null) raw[category] = value
        }
        if (type.includes('passing')) { set('Passing Yards', 'YDS'); set('Passing TDs', 'TD') }
        if (type.includes('rushing')) { set('Rushing Yards', 'YDS'); set('Rushing Attempts', 'CAR') }
        if (type.includes('receiving')) { set('Receiving Yards', 'YDS'); set('Receptions', 'REC') }
        if (!Object.keys(raw).length) continue
        result.push({
          gameId: game.id, date: game.date, playerId: String(athlete.athlete.id),
          player: String(athlete.athlete.displayName ?? ''), team, stats: raw,
        })
      }
    }
  }
  return result
}
export async function loadNFLHistory(slate: Slate): Promise<{ rows: NFLHistoryRow[]; partial: boolean }> {
  if (!slate.games.length || !slate.seasonEvents) return { rows: [], partial: false }
  const upcomingTeams = new Set(slate.games.flatMap(game => game.teams.map(t => t.abbreviation)))
  const completed: ScheduledGame[] = slate.seasonEvents
    .filter((event: any) => event.status?.type?.completed === true && Date.parse(event.date) < Date.now())
    .map(parseGame).filter((game: ScheduledGame | null): game is ScheduledGame => game !== null)
    .sort((a: ScheduledGame, b: ScheduledGame) => b.date.localeCompare(a.date))
  const selected = new Map<string, ScheduledGame>()
  const counts = new Map<string, number>()
  for (const game of completed) {
    const relevant = game.teams.filter(team => upcomingTeams.has(team.abbreviation) && (counts.get(team.abbreviation) ?? 0) < 10)
    if (!relevant.length) continue
    selected.set(game.id, game)
    relevant.forEach(team => counts.set(team.abbreviation, (counts.get(team.abbreviation) ?? 0) + 1))
    if (Array.from(upcomingTeams).every(team => (counts.get(team) ?? 0) >= 10)) break
  }
  const key = 'edgeiq-nfl-cheatsheet-' + slate.date + '-' + selected.size
  try {
    const item = localStorage.getItem(key)
    if (item) {
      const cached = JSON.parse(item) as { time: number; rows: NFLHistoryRow[]; partial: boolean }
      if (Date.now() - cached.time < 90 * 60000 && Array.isArray(cached.rows)) return { rows: cached.rows, partial: cached.partial }
    }
  } catch { /* Browsers may block storage. */ }
  const all = Array.from(selected.values())
  const rows: NFLHistoryRow[] = []
  let failures = 0
  for (let i = 0; i < all.length; i += 8) {
    const batch = await Promise.all(all.slice(i, i + 8).map(async game => {
      try {
        const data = await loadJSON('https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=' + encodeURIComponent(game.id))
        return parseNFLBoxscore(data, game)
      } catch { failures++; return [] as NFLHistoryRow[] }
    }))
    rows.push(...batch.flat())
  }
  const result = { rows, partial: failures > 0 }
  if (!result.partial && rows.length) {
    try { localStorage.setItem(key, JSON.stringify({ time: Date.now(), ...result })) } catch { /* Storage is optional. */ }
  }
  return result
}
export function buildNFLPicks(slate: Slate, rows: NFLHistoryRow[]): CheatPick[] {
  const upcoming = new Map(slate.games.flatMap(game => game.teams.map(team => [team.abbreviation, game] as const)))
  const grouped = new Map<string, { player: string; team: string; playerId: string; logs: NFLHistoryRow[] }>()
  for (const row of rows) {
    if (!upcoming.has(row.team)) continue
    const key = row.playerId + '-' + row.team
    if (!grouped.has(key)) grouped.set(key, { player: row.player, team: row.team, playerId: row.playerId, logs: [] })
    grouped.get(key)!.logs.push(row)
  }
  const candidates: Candidate[] = []
  for (const item of grouped.values()) {
    const game = upcoming.get(item.team)
    if (!game) continue
    const latest = item.logs.reduce((best, row) => row.date > best ? row.date : best, '')
    if (!latest || Date.now() - Date.parse(latest) > 28 * 86400000) continue
    for (const [category, lines] of Object.entries(nflReferenceLines)) {
      const byGame = new Map<string, NFLHistoryRow>()
      for (const row of item.logs) if (category in row.stats && !byGame.has(row.gameId)) byGame.set(row.gameId, row)
      const values = Array.from(byGame.values()).sort((a, b) => b.date.localeCompare(a.date)).map(row => row.stats[category])
      for (const line of lines) for (const direction of ['over', 'under'] as const) {
        const candidate = evaluate('NFL', item.playerId, item.player, item.team, game, category, values, line, direction)
        if (candidate) candidates.push(candidate)
      }
    }
  }
  return selectPicks(candidates)
}
