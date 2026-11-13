import { useEffect, useMemo, useState } from 'react'
import { calculateRecentHitRates, type Direction } from './analytics/hitRates'

type Game = { id: string; date: string; completed: boolean }
type RecordRow = { gameId: string; date: string; playerId: string; player: string; team: string; stats: Record<string, number> }
const categories = ['Passing Yards', 'Passing TDs', 'Rushing Yards', 'Rushing Attempts', 'Receiving Yards', 'Receptions', 'Receiving TDs'] as const
type Category = typeof categories[number]

async function json(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Sports data request failed (' + response.status + ')')
  return response.json()
}

function numberAt(stats: unknown, labels: unknown, label: string): number | null {
  if (!Array.isArray(stats) || !Array.isArray(labels)) return null
  const index = labels.findIndex((item: unknown) => String(item).toLowerCase() === label.toLowerCase())
  if (index < 0) return null
  const value = Number(stats[index])
  return Number.isFinite(value) ? value : null
}

function parseSummary(data: any, game: Game): RecordRow[] {
  const rows: RecordRow[] = []
  for (const team of data.boxscore?.players ?? []) {
    for (const group of team.statistics ?? []) {
      const name = String(group.name ?? group.type ?? '').toLowerCase()
      const labels = group.labels ?? group.keys ?? []
      for (const athlete of group.athletes ?? []) {
        if (athlete.didNotPlay || !athlete.athlete?.id) continue
        const stats: Record<string, number> = {}
        const raw = athlete.stats ?? []
        const set = (key: Category, label: string) => {
          const value = numberAt(raw, labels, label)
          if (value !== null) stats[key] = value
        }
        if (name.includes('passing')) {
          set('Passing Yards', 'YDS')
          set('Passing TDs', 'TD')
        }
        if (name.includes('rushing')) {
          set('Rushing Yards', 'YDS')
          set('Rushing Attempts', 'CAR')
        }
        if (name.includes('receiving')) {
          set('Receiving Yards', 'YDS')
          set('Receptions', 'REC')
          set('Receiving TDs', 'TD')
        }
        if (Object.keys(stats).length) rows.push({
          gameId: game.id, date: game.date, playerId: String(athlete.athlete.id),
          player: String(athlete.athlete.displayName ?? 'Unknown'),
          team: String(team.team?.abbreviation ?? team.team?.displayName ?? '—'), stats
        })
      }
    }
  }
  return rows
}

export default function NFLResearch() {
  const [rows, setRows] = useState<RecordRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [category, setCategory] = useState<Category>('Passing Yards')
  const [line, setLine] = useState(199.5)
  const [direction, setDirection] = useState<Direction>('over')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const start = new Date()
        start.setDate(start.getDate() - 35)
        const end = new Date()
        const fmt = (date: Date) => date.getFullYear() + String(date.getMonth() + 1).padStart(2, '0') + String(date.getDate()).padStart(2, '0')
        const scoreboard = await json('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=' + fmt(start) + '-' + fmt(end) + '&limit=100')
        const games: Game[] = (scoreboard.events ?? []).filter((event: any) => event.status?.type?.completed === true).map((event: any) => ({ id: String(event.id), date: String(event.date), completed: true }))
        const collected: RecordRow[] = []
        for (let i = 0; i < games.length; i += 6) {
          const batch = await Promise.all(games.slice(i, i + 6).map(async game => {
            try { return parseSummary(await json('https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=' + encodeURIComponent(game.id)), game) }
            catch { return [] as RecordRow[] }
          }))
          collected.push(...batch.flat())
        }
        if (!cancelled) {
          if (!games.length) setError('No completed NFL games were returned by the data source for this period.')
          setRows(collected)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'NFL data unavailable')
      } finally { if (!cancelled) setLoading(false) }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const players = useMemo(() => {
    const map = new Map<string, { id: string; name: string; team: string }>()
    rows.forEach(row => map.set(row.playerId, { id: row.playerId, name: row.player, team: row.team }))
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [rows])
  const selected = players.find(player => player.id === playerId)
  const suggestions = query && !selected ? players.filter(player => player.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8) : []
  const history = rows.filter(row => row.playerId === playerId && category in row.stats).sort((a, b) => b.date.localeCompare(a.date))
  const values = history.map(row => row.stats[category])
  const rates = calculateRecentHitRates(values, line, direction)
  const hit = (value: number) => direction === 'over' ? value > line : value < line
  const avg = values.length ? (values.slice(0, 10).reduce((a, b) => a + b, 0) / Math.min(values.length, 10)).toFixed(1) : '—'

  return <>
    <section className="hero"><div className="eyebrow gold">NFL PLAYER RESEARCH</div><h1>Football <span className="gold">analytics.</span></h1><p>Explore verified historical player box scores and over/under trends. Past results do not predict future outcomes.</p></section>
    <div className="section-head"><div><span className="eyebrow">NFL RESEARCH CENTER</span><h2>Player Prop Analyzer</h2></div><span className="data-count">{loading ? 'Loading NFL history…' : players.length + ' players available'}</span></div>
    {error && <div className="error" role="alert">{error}</div>}
    <section className="panel controls">
      <div className="field player-field"><label htmlFor="nfl-player">PLAYER</label><input id="nfl-player" placeholder="Search NFL players…" value={query} onChange={event => { setQuery(event.target.value); setPlayerId('') }} autoComplete="off" />
        {suggestions.length > 0 && <div className="suggestions">{suggestions.map(player => <button key={player.id} onClick={() => { setPlayerId(player.id); setQuery(player.name) }}>{player.name}<span>{player.team}</span></button>)}</div>}
      </div>
      <div className="field"><label htmlFor="nfl-stat">STAT CATEGORY</label><select id="nfl-stat" value={category} onChange={event => setCategory(event.target.value as Category)}>{categories.map(item => <option key={item}>{item}</option>)}</select></div>
      <div className="field"><label htmlFor="nfl-line">PROP LINE</label><input id="nfl-line" type="number" min="0" step="0.5" value={line} onChange={event => setLine(Number(event.target.value))} /></div>
      <div className="field"><label htmlFor="nfl-direction">DIRECTION</label><select id="nfl-direction" value={direction} onChange={event => setDirection(event.target.value as Direction)}><option value="over">Over</option><option value="under">Under</option></select></div>
    </section>
    <div className="section-head results-heading"><div><span className="eyebrow">PERFORMANCE SNAPSHOT</span><h2>{selected?.name ?? 'Select a player'} <span className="muted">{selected ? '· ' + direction + ' ' + line + ' ' + category : ''}</span></h2></div></div>
    <div className="metrics">{(['L5', 'L10', 'L20'] as const).map(period => {
      const count = Number(period.slice(1))
      const enough = values.length >= count
      const recent = values.slice(0, count)
      return <div className="metric" key={period}><div className="metric-label">LAST {count} GAMES</div><div className="metric-value">{selected && enough && rates[period] !== null ? rates[period] + '%' : 'N/A'}</div><div className="metric-sub">{!selected ? 'Select a player' : enough ? recent.filter(hit).length + ' of ' + count + ' games hit' : 'Only ' + values.length + ' games available'}</div><div className="metric-track" style={{ display: 'flex', gap: 3, background: 'transparent' }}>{Array.from({ length: count }, (_, i) => <span key={i} style={{ flex: 1, background: enough ? (hit(recent[i]) ? '#64db93' : '#637b6a') : '#31513d' }} />)}</div></div>
    })}<div className="metric gold-metric"><div className="metric-label">LAST 10 AVG</div><div className="metric-value">{avg}</div><div className="metric-sub">{category} per game (up to 10)</div><div className="metric-track gold-track"><span style={{ width: values.length ? '100%' : '0%' }} /></div></div></div>
    <section className="panel log-panel"><div className="panel-title"><div><span className="eyebrow">HISTORICAL RESULTS</span><h3>NFL game log · {category}</h3></div><span className="small-tag">NEWEST FIRST</span></div>
      <div className="table-wrap"><table><thead><tr><th>DATE</th><th>TEAM</th><th>STAT</th><th>{direction.toUpperCase()} {line}</th></tr></thead><tbody>{history.slice(0, 20).map(row => <tr key={row.gameId}><td>{new Date(row.date).toLocaleDateString()}</td><td>{row.team}</td><td>{row.stats[category]}</td><td><span className={hit(row.stats[category]) ? 'hit-chip' : 'miss-chip'}>{hit(row.stats[category]) ? 'HIT' : row.stats[category] === line ? 'PUSH' : 'MISS'}</span></td></tr>)}{history.length === 0 && <tr><td colSpan={4} className="table-empty">{loading ? 'Loading NFL games…' : 'No games available for this player and stat.'}</td></tr>}</tbody></table></div>
      <p className="footnote">Data source: ESPN public game summaries. Available history may be incomplete. Matchup grades and projections are not yet validated.</p>
    </section>
  </>
}
