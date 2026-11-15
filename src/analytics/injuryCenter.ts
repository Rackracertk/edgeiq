import { supabase } from '../supabaseClient'
import { loadDailySlate, type CheatSport, type ScheduledGame, type Slate } from '../cheatSheetData'
import { normalizeInjuries, type InjuryReport } from './injuryStatus'
export { normalizeInjuries, findInjury, shouldExcludeInjury, injuryAvailability } from './injuryStatus'
export type { InjuryReport } from './injuryStatus'

export type InjuryData = {
  injuries: InjuryReport[]
  available: boolean
  checkedAt: string
  source: string
  error?: string
}
export type InjurySlate = { slate: Slate; report: InjuryData; generatedAt: string }

export function easternDate(date: Date): string {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const get = (name: string) => p.find(item => item.type === name)?.value ?? ''
  return get('year') + get('month') + get('day')
}
export function nextDate(date: string, offset: number): string {
  const [y,m,d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m-1, d+offset)).toISOString().slice(0,10)
}
export function compactDate(iso: string): string { return iso.replaceAll('-', '') }

export const injurySourceUrl = (sport: CheatSport) => sport === 'NBA'
  ? 'https://official.nba.com/nba-injury-report-2026-27-season/'
  : 'https://www.nfl.com/injuries/'

export async function loadDirectInjuries(sport: CheatSport): Promise<InjuryData> {
  const path = sport === 'NBA' ? 'basketball/nba' : 'football/nfl'
  const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/' + path + '/injuries', {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw Error('ESPN injury feed HTTP ' + response.status)
  const data = await response.json()
  if (!Array.isArray(data?.injuries)) throw Error('Injury report format unavailable')
  const injuries = normalizeInjuries(data)
  if (data.injuries.length && injuries.length === 0) throw Error('Injury report could not be parsed')
  return { injuries, available: true, checkedAt: new Date().toISOString(), source: 'ESPN injury feed' }
}
async function fetchSnapshots(sport: CheatSport, startDate: string) {
  if (!supabase) return []
  const { data, error } = await supabase.from('edgeiq_slate_snapshots')
    .select('sport,slate_date,games,injuries,injuries_available,generated_at')
    .eq('sport', sport).gte('slate_date', startDate).order('slate_date', {ascending:true}).limit(12)
  if (error) return []
  return Array.isArray(data) ? data : []
}
export async function loadInjuryAwareSlate(sport: CheatSport, advance: 'today' | 'tomorrow'): Promise<InjurySlate> {
  const today = easternDate(new Date())
  const startDate = advance === 'tomorrow' ? nextDate(today, 1) : today
  const rows = await fetchSnapshots(sport, startDate)
  const candidate: any = rows.find(row => Array.isArray(row.games) &&
    row.games.some((game: ScheduledGame) => Date.parse(game.date) > Date.now()))
  const stillRecent = candidate && Date.now() - Date.parse(candidate.generated_at) < 2*60*60*1000
  let slate: Slate
  if (candidate && stillRecent) {
    const date = String(candidate.slate_date)
    slate = {
      date: compactDate(date), label: new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York', month: 'short', day: 'numeric', weekday: 'long',
      }).format(new Date(date + 'T16:00:00Z')),
      isToday: date === today,
      games: (candidate.games as ScheduledGame[]).filter(game => Date.parse(game.date) > Date.now()),
      source: 'Hourly EDGEIQ schedule snapshot',
    }
  } else {
    slate = await loadDailySlate(sport, compactDate(startDate))
  }
  // NFL cheat sheet requires completed-game events to calculate historical
  // trends. A schedule-only cached snapshot must never appear as valid history.
  if (sport === 'NFL' && slate.games.length && !slate.seasonEvents?.length) {
    try {
      const nfl = await loadDailySlate('NFL', slate.date)
      slate = { ...slate, seasonEvents: nfl.seasonEvents }
    } catch {
      // The UI will show no qualified NFL trends instead of inventing results.
    }
  }
  let report: InjuryData
  try {
    report = await loadDirectInjuries(sport)
  } catch (error) {
    // A recent, successful hourly server snapshot can replace a failed browser fetch.
    if (candidate && stillRecent && candidate.injuries_available === true &&
      Array.isArray(candidate.injuries)) {
      report = {
        injuries: candidate.injuries as InjuryReport[], available: true,
        checkedAt: String(candidate.generated_at), source: 'EDGEIQ injury snapshot',
      }
    } else {
      report = {
        injuries: [], available: false, checkedAt: new Date().toISOString(),
        source: 'Unverified', error: error instanceof Error ? error.message : 'Injury report unavailable',
      }
    }
  }
  return {slate,report,generatedAt:new Date().toISOString()}
}

export async function loadInjuryReport(sport: CheatSport): Promise<InjuryData> {
  try { return await loadDirectInjuries(sport) }
  catch (error) {
    const rows = await fetchSnapshots(sport, easternDate(new Date()))
    const recent = rows.find(row => row.injuries_available === true && Array.isArray(row.injuries) &&
      Date.now() - Date.parse(String(row.generated_at)) < 2*60*60*1000)
    if (recent) return {
      injuries: recent.injuries as InjuryReport[], available: true,
      checkedAt: String(recent.generated_at), source: 'EDGEIQ injury snapshot',
    }
    return {
      injuries: [], available: false, checkedAt: new Date().toISOString(),
      source: 'Unavailable',
      error: error instanceof Error ? error.message : 'Injury feed unavailable',
    }
  }
}
