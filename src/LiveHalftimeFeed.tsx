import { useCallback, useEffect, useMemo, useState } from 'react'
import { extractNBAPlayerStats } from './analytics/espnData'
import './LiveHalftimeFeed.css'
import {teamMatches,textMatches,teamName} from './analytics/teamDirectory'

type Sport = 'NBA' | 'NFL'
type Game = { id: string; label: string; status: string; period: number; clock: string; state: string; elapsed: number; completed: boolean }
type Athlete = { id: string; name: string; team: string; values: Record<string, number>; minutes: number | null; fouls: number | null }
type LiveGame = Game & { athletes: Athlete[]; boxscoreUnavailable?: boolean }
const endpoints: Record<Sport, string> = { NBA: 'basketball/nba', NFL: 'football/nfl' }
const nbaProps = ['Points', 'Rebounds', 'Assists', 'PRA', 'Points + Assists', 'Points + Rebounds', 'Assists + Rebounds', '3PT Made', 'Steals', 'Blocks', 'Steals + Blocks']
const nflProps = ['Passing Yards', 'Pass Completions', 'Passing TD', 'Interceptions', 'Rushing Yards', 'Rushing Attempts', 'Receiving Yards', 'Receptions', 'Sacks']
const toNumber = (v: unknown): number | null => {
  if (typeof v !== 'string' && typeof v !== 'number') return null
  const s = String(v).trim()
  if (!s || !/^-?\d+(?:\.\d+)?$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : null
}
const show = (n: number | null | undefined) => n === null || n === undefined ? '—' : String(Math.round(n * 10) / 10)
const dateET = (shift: number) => {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + shift)
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const field = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  return field('year') + field('month') + field('day')
}
async function getJson(url: string, signal: AbortSignal): Promise<any> {
  const response = await fetch(url, { signal, cache: 'no-store' })
  if (!response.ok) throw new Error('Data service returned HTTP ' + response.status)
  return response.json()
}
function gameFromEvent(event: any): Game | null {
  const competition = event?.competitions?.[0]
  const teams = competition?.competitors ?? []
  const home = teams.find((t: any) => t.homeAway === 'home')
  const away = teams.find((t: any) => t.homeAway === 'away')
  const id = String(event?.id ?? '')
  if (!id || !home || !away) return null
  const status = event.status ?? competition?.status ?? {}
  const period = Number(status.period ?? 0)
  const clock = String(status.displayClock ?? '0:00')
  const state = String(status.type?.state ?? (status.type?.completed ? 'post' : 'pre'))
  const match = clock.match(/^(\d+):(\d+)$/)
  const minutesLeft = match ? Number(match[1]) + Number(match[2]) / 60 : 0
  const quarterMinutes = event.league === 'NBA' ? 12 : 15
  const elapsed = period > 0 ? Math.max(0, (Math.min(period, 4) - 1) * quarterMinutes + (quarterMinutes - Math.min(quarterMinutes, minutesLeft))) : 0
  return { id, label: String(away.team?.abbreviation ?? away.team?.shortDisplayName ?? 'Away') + ' @ ' + String(home.team?.abbreviation ?? home.team?.shortDisplayName ?? 'Home'), status: String(status.type?.shortDetail ?? status.type?.description ?? event.status?.type?.name ?? 'Scheduled'), period, clock, state, elapsed, completed: Boolean(status.type?.completed) }
}
function parseNBA(data: any): Athlete[] {
  const all = extractNBAPlayerStats(data?.boxscore?.players ?? [])
  const extras = new Map<string, { minutes: number | null; fouls: number | null }>()
  for (const team of data?.boxscore?.players ?? []) {
    for (const group of team.statistics ?? []) {
      const keys: string[] = group.keys ?? []
      for (const p of group.athletes ?? []) {
        const stats: unknown[] = p.stats ?? []
        const minIndex = keys.indexOf('minutes')
        const foulsIndex = keys.indexOf('fouls')
        const minRaw = minIndex >= 0 ? stats[minIndex] : null
        const split = String(minRaw ?? '').split(':')
        const min = split.length === 2 && split.every(v => /^\d+$/.test(v)) ? Number(split[0]) + Number(split[1]) / 60 : toNumber(minRaw)
        extras.set(String(p.athlete?.id ?? ''), { minutes: min, fouls: foulsIndex >= 0 ? toNumber(stats[foulsIndex]) : null })
      }
    }
  }
  return all.map(p => ({ id: p.id, name: p.name, team: p.team, minutes: extras.get(p.id)?.minutes ?? null, fouls: extras.get(p.id)?.fouls ?? null, values: {
    Points: p.points, Rebounds: p.rebounds, Assists: p.assists, PRA: p.points + p.rebounds + p.assists,
    'Points + Assists': p.points + p.assists, 'Points + Rebounds': p.points + p.rebounds,
    'Assists + Rebounds': p.assists + p.rebounds, '3PT Made': p.threes,
    ...(p.steals !== undefined ? { Steals: p.steals } : {}), ...(p.blocks !== undefined ? { Blocks: p.blocks } : {}),
    ...(p.steals !== undefined && p.blocks !== undefined ? { 'Steals + Blocks': p.steals + p.blocks } : {})
  } }))
}
function parseNFL(data: any): Athlete[] {
  const athletes = new Map<string, Athlete>()
  for (const team of data?.boxscore?.players ?? []) {
    for (const category of team.statistics ?? []) {
      const name = String(category.name ?? category.displayName ?? '').toLowerCase()
      const labels: string[] = (category.labels ?? []).map((l: unknown) => String(l).toUpperCase())
      for (const row of category.athletes ?? []) {
        if (!row.athlete?.id || !row.athlete?.displayName || row.didNotPlay) continue
        const id = String(row.athlete.id)
        const existing = athletes.get(id) ?? { id, name: String(row.athlete.displayName), team: String(team.team?.abbreviation ?? team.team?.displayName ?? ''), values: {}, minutes: null, fouls: null }
        const stats: unknown[] = row.stats ?? []
        const get = (...keys: string[]) => {
          const idx = labels.findIndex(label => keys.includes(label))
          return idx < 0 ? null : toNumber(stats[idx])
        }
        if (name.includes('pass')) {
          const yards = get('YDS', 'YARDS'), td = get('TD'), int = get('INT')
          if (yards !== null) existing.values['Passing Yards'] = yards
          if (td !== null) existing.values['Passing TD'] = td
          if (int !== null) existing.values.Interceptions = int
          const cAtt = labels.findIndex(l => l === 'C/ATT' || l === 'COMP/ATT')
          const complete = cAtt >= 0 ? Number(String(stats[cAtt] ?? '').split('/')[0]) : get('CMP', 'COMP')
          if (complete !== null && Number.isFinite(complete) && complete >= 0) existing.values['Pass Completions'] = complete
        } else if (name.includes('rush')) {
          const yards = get('YDS', 'YARDS'), attempts = get('CAR', 'ATT', 'RUSH')
          if (yards !== null) existing.values['Rushing Yards'] = yards
          if (attempts !== null) existing.values['Rushing Attempts'] = attempts
        } else if (name.includes('receiv')) {
          const yards = get('YDS', 'YARDS'), receptions = get('REC')
          if (yards !== null) existing.values['Receiving Yards'] = yards
          if (receptions !== null) existing.values.Receptions = receptions
        } else if (name.includes('defen')) {
          const sacks = get('SACK', 'SACKS')
          if (sacks !== null) existing.values.Sacks = sacks
        }
        if (Object.keys(existing.values).length) athletes.set(id, existing)
      }
    }
  }
  return [...athletes.values()]
}
async function fetchGames(sport: Sport, signal: AbortSignal): Promise<LiveGame[]> {
  const path = endpoints[sport]
  const dates = [dateET(-1), dateET(0), dateET(1)]
  const boards = await Promise.allSettled(dates.map(d => getJson('https://site.api.espn.com/apis/site/v2/sports/' + path + '/scoreboard?dates=' + d, signal)))
  if (signal.aborted) return []
  const successful = boards.filter(b => b.status === 'fulfilled') as PromiseFulfilledResult<any>[]
  if (!successful.length) throw new Error('Unable to load any scoreboard from ESPN.')
  const map = new Map<string, Game>()
  for (const result of successful) {
    for (const event of result.value.events ?? []) {
      const game = gameFromEvent({ ...event, league: sport })
      if (game) map.set(game.id, game)
    }
  }
  const games = [...map.values()].sort((a, b) => (a.state === 'in' ? -1 : a.state === 'post' ? 0 : 1) - (b.state === 'in' ? -1 : b.state === 'post' ? 0 : 1))
  const updated = await Promise.all(games.map(async (game): Promise<LiveGame> => {
    if (game.state === 'pre') return { ...game, athletes: [] }
    try {
      const details = await getJson('https://site.api.espn.com/apis/site/v2/sports/' + path + '/summary?event=' + encodeURIComponent(game.id), signal)
      return { ...game, athletes: sport === 'NBA' ? parseNBA(details) : parseNFL(details) }
    } catch {
      return { ...game, athletes: [], boxscoreUnavailable: true }
    }
  }))
  return updated
}
function LiveHalftimeFeed() {
  const [sport, setSport] = useState<Sport>('NBA')
  const [category, setCategory] = useState('Points')
  const [search, setSearch] = useState('')
  const [games, setGames] = useState<LiveGame[]>([])
  const [gameId, setGameId] = useState('all')
  const [stage,setStage] = useState('all')
  const [trackedOnly,setTrackedOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [lines, setLines] = useState<Record<string, string>>(()=>{try{return JSON.parse(sessionStorage.getItem('edgeiq-halftime-lines-v2') || '{}')}catch{return {}}})
  useEffect(()=>{try{sessionStorage.setItem('edgeiq-halftime-lines-v2',JSON.stringify(lines))}catch{/* storage unavailable */}},[lines])
  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])
  useEffect(() => {
    const controller = new AbortController()
    let mounted = true
    async function load() {
      setRefreshing(true)
      try {
        const fresh = await fetchGames(sport, controller.signal)
        if (!mounted) return
        setGames(fresh); setUpdatedAt(new Date()); setError('')
      } catch (e) {
        if (mounted && !controller.signal.aborted) setError(e instanceof Error ? e.message : 'Live sports feed unavailable')
      } finally {
        if (mounted) { setLoading(false); setRefreshing(false) }
      }
    }
    void load()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, 45000)
    return () => { mounted = false; window.clearInterval(timer); controller.abort() }
  }, [sport, refreshKey])
  const chooseSport = (value: Sport) => { if(value===sport)return; setSport(value); setStage('all'); setSearch(''); setCategory(value === 'NBA' ? 'Points' : 'Passing Yards'); setGameId('all'); setGames([]); setLoading(true); setUpdatedAt(null); setError('') }
  const shown = useMemo(() => games.filter(g => (gameId === 'all' || g.id === gameId) && (stage === 'all' || stage === 'live' && g.state === 'in' || stage === 'half' && /halftime|half time|end of 2nd/i.test(g.status) || stage === 'final' && g.completed)).flatMap(g => g.athletes.map(a => ({ ...a, game: g }))).filter(a => a.values[category] !== undefined && (textMatches(a.name,search) || teamMatches(sport,a.team,search)) && (!trackedOnly || !!lines[sport+':'+a.game.id+':'+a.id+':'+category]?.trim())).sort((a, b) => Number(b.game.state === 'in') - Number(a.game.state === 'in') || b.values[category] - a.values[category]), [games, gameId, category, search, sport, stage, trackedOnly, lines])
  const liveCount = games.filter(g => g.state === 'in').length
  return <section className="panel ht-live">
    <div className="ht-live-head"><div><span className="eyebrow">AUTOMATIC PLAYER BOX SCORES</span><h2>Live Game Center</h2><p>NBA and NFL player stats are pulled automatically from ESPN every 45 seconds while this page is open.</p></div><span className="ht-live-badge">{liveCount ? liveCount + ' IN PROGRESS' : 'NO LIVE GAMES'}</span></div>
    <div className="ht-live-controls">
      <div className="ht-live-switch">{(['NBA', 'NFL'] as const).map(s => <button type="button" className={sport === s ? 'active' : ''} key={s} onClick={() => chooseSport(s)}>{s === 'NBA' ? '🏀 NBA' : '🏈 NFL'}</button>)}</div>
      <label>Game<select value={gameId} onChange={e => setGameId(e.target.value)}><option value="all">All games</option>{games.map(g => <option key={g.id} value={g.id}>{g.label} · {g.status}</option>)}</select></label>
      <label>Statistic<select value={category} onChange={e => setCategory(e.target.value)}>{(sport === 'NBA' ? nbaProps : nflProps).map(p => <option key={p} value={p}>{p}</option>)}</select></label>
      <label>Find player or team<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Player, team or abbreviation…" /></label>
      <button type="button" className="ht-live-refresh" onClick={refresh} disabled={refreshing}>{refreshing ? 'Updating...' : '↻ Refresh now'}</button>
    </div>
    <p className="ht-live-meta" role="status">{error ? '⚠ ' + error + ' · Previous data may be outdated.' : loading ? 'Loading game information...' : updatedAt ? 'Last refreshed: ' + updatedAt.toLocaleTimeString() + ' · ESPN scoreboard / box scores' : 'Awaiting feed'} {games.some(g => g.boxscoreUnavailable) ? '· Some player box scores unavailable' : ''}</p>
    <div className="revamp-filter"><label>GAME PHASE<select value={stage} onChange={e=>setStage(e.target.value)}><option value="all">All phases</option><option value="live">In progress</option><option value="half">Halftime</option><option value="final">Final</option></select></label><label className="revamp-check"><input type="checkbox" checked={trackedOnly} onChange={e=>setTrackedOnly(e.target.checked)}/> Show entered lines only</label><span className="revamp-mini">{shown.length} player-stat rows · {games.filter(g=>/halftime|half time|end of 2nd/i.test(g.status)).length} at halftime</span></div>
    <div className="ht-live-games">{games.map(g => <button key={g.id} className={gameId === g.id ? 'active' : ''} onClick={() => setGameId(old => old === g.id ? 'all' : g.id)}><strong>{g.label}</strong><span>{g.status}{g.state === 'in' && g.clock ? ' · ' + g.clock : ''}</span></button>)}</div>
    {!loading && games.length === 0 ? <div className="ht-empty">No games could be listed. Check the feed status above.</div> : !loading && shown.length === 0 ? <div className="ht-empty">{games.every(g => g.state === 'pre') ? 'Games have not started yet. Player totals will appear after box scores are available.' : 'No reported player stats match this filter yet. ESPN may not have published the box scores.'}</div> : <div className="ht-live-tablewrap"><table className="ht-live-table"><thead><tr><th>Player / Game</th><th>{category}</th><th>Simple pace*</th><th>Line (optional)</th><th>To finish over</th><th>Needed per remaining minute*</th><th>Status</th></tr></thead><tbody>{shown.map(a => {
      const val = a.values[category], lineKey = sport + ':' + a.game.id + ':' + a.id + ':' + category
      const entered = lines[lineKey] ?? ''
      const target = entered.trim() === '' ? null : Number(entered)
      const validTarget = target !== null && Number.isFinite(target) && target >= 0 ? target : null
      const remaining = validTarget === null ? null : Math.max(0, validTarget - val)
      const full = sport === 'NBA' ? 48 : 60
      const pace = a.game.elapsed > 0 && a.game.period <= 4 ? val / a.game.elapsed * full : null
      const timeLeft = Math.max(0,full-a.game.elapsed)
      const neededRate = remaining !== null && timeLeft > 0 && !a.game.completed ? remaining/timeLeft : null
      return <tr key={lineKey}><td><strong>{a.name}</strong><small>{teamName(sport,a.team)} · {a.game.label}{a.minutes !== null ? ' · ' + show(a.minutes) + ' min' : ''}{a.fouls !== null ? ' · ' + show(a.fouls) + ' PF' : ''}</small></td><td className="ht-live-stat">{show(val)}</td><td>{a.game.completed ? 'FINAL' : show(pace)}</td><td><input aria-label={'Line for ' + a.name + ' ' + category} inputMode="decimal" type="number" min="0" step="any" placeholder="Enter line" value={entered} onChange={e => setLines(old => ({ ...old, [lineKey]: e.target.value }))} /></td><td>{remaining === null ? '—' : val > validTarget! ? 'Over reached' : 'More than ' + show(remaining)}</td><td>{neededRate===null?'—':show(neededRate)}</td><td><span className={'ht-live-state ' + (a.game.state === 'in' ? 'live' : '')}>{a.game.status}</span></td></tr>
    })}</tbody></table></div>}
    <p className="ht-live-disclaimer">*Pace is a straight-line extrapolation using game-clock time; it does not account for playing time, game flow, or substitutions. ESPN game statistics may be delayed or revised. Player totals and game status are sourced from ESPN; entered prop lines are your own inputs, not live sportsbook prices. No betting outcomes are guaranteed. For research only.</p>
  </section>
}
export default LiveHalftimeFeed
