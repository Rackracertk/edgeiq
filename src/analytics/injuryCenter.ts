import { supabase } from '../supabaseClient'
import { loadDailySlate, type CheatSport, type ScheduledGame, type Slate } from '../cheatSheetData'

export type InjuryReport = {
  playerId: string
  player: string
  team: string
  teamId: string
  status: string
  reason: string
  note: string
  updatedAt: string
}
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

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  return ''
}
export function normalizeInjuries(payload: any): InjuryReport[] {
  const groups: any[] = Array.isArray(payload?.injuries) ? payload.injuries : []
  const rows: InjuryReport[] = []
  for (const group of groups) {
    const groupTeam = group?.team ?? {}
    const entries: any[] = Array.isArray(group?.injuries) ? group.injuries : group?.athlete ? [group] : []
    for (const entry of entries) {
      const athlete = entry?.athlete ?? entry?.player ?? {}
      const team = entry?.team ?? groupTeam
      const playerId = text(athlete.id)
      const player = text(athlete.displayName || athlete.fullName || athlete.name)
      const status = text(typeof entry.status === 'string'
        ? entry.status : entry.status?.name || entry.status?.description || entry.status?.type || entry.fantasyStatus?.name)
      if ((!playerId && !player) || !status) continue
      rows.push({
        playerId, player, team: text(team.abbreviation), teamId: text(team.id),
        status,
        reason: text(entry.type?.name || entry.type?.description || entry.details?.type || entry.details?.detail || entry.injury?.description),
        note: text(entry.details?.shortComment || entry.details?.description || entry.shortComment || entry.details?.detail).slice(0,240),
        updatedAt: text(entry.date || entry.lastUpdated),
      })
    }
  }
  const unique = new Map<string, InjuryReport>()
  for (const item of rows) unique.set(item.playerId || (item.team + ':' + item.player), item)
  return [...unique.values()]
}
const normName = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'')
export function findInjury(
  rows: InjuryReport[], playerId: string, player: string,
  team: string, teamId = '',
): InjuryReport | undefined {
  const byId = rows.find(item => item.playerId && item.playerId === playerId)
  if (byId) return byId
  const name = normName(player)
  return rows.find(item => normName(item.player) === name && (
    (!!teamId && item.teamId === teamId) || (!!team && item.team === team)
  ))
}
export type Availability = 'unavailable' | 'risk' | 'listed' | 'unknown'
export function injuryAvailability(status: string): Availability {
  const name = status.trim().toLowerCase().replace(/[-_]/g,' ')
  if (!name) return 'unknown'
  if (/\b(out|inactive|suspended|reserve|ir|pup|nfi|non football injury)\b/.test(name)) return 'unavailable'
  if (/\b(doubtful|questionable|game time|gtd|day to day)\b/.test(name)) return 'risk'
  return 'listed'
}
export function shouldExcludeInjury(item: InjuryReport | undefined): boolean {
  return !!item && ['unavailable','risk'].includes(injuryAvailability(item.status))
}
export const injurySourceUrl = (sport: CheatSport) => sport === 'NBA'
  ? 'https://official.nba.com/nba-injury-report-2026-27-season/'
  : 'https://www.nfl.com/injuries/'

async function loadDirectInjuries(sport: CheatSport): Promise<InjuryData> {
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
