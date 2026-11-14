import { useEffect, useMemo, useState } from 'react'
import './App.css'
import NFLResearch from './NFLResearch'
import NBAOpponentExplorer from './NBAOpponentExplorer'
import { calculateAverage, calculateRecentHitRates, type Direction } from './analytics/hitRates'
import { getPlayerPropValues, type NBAPlayerGame } from './analytics/nbaData'
import { getNBABoxScore, extractNBAPlayerStats, getRecentNBAGames, buildNBAPlayerHistory } from './analytics/espnData'
import { getCachedData, setCachedData } from './analytics/cache'
const props = ['Points', 'Rebounds', 'Assists', '3-Pointers Made', 'PRA']
const periods = ['L5', 'L10', 'L20'] as const
const sports = [
  { id: 'NBA', name: 'NBA', label: 'Basketball', active: true },
  { id: 'NFL', name: 'NFL', label: 'Football', active: true },
  { id: 'MLB', name: 'MLB', label: 'Baseball', active: false },
  { id: 'NHL', name: 'NHL', label: 'Hockey', active: false },
  { id: 'NCAAF', name: 'NCAAF', label: 'College football', active: false },
  { id: 'NCAAB', name: 'NCAAB', label: 'College basketball', active: false },
  { id: 'SOCCER', name: 'Soccer', label: 'Soccer', active: false },
] as const
const prices = [{ name: 'Weekly', price: '$3.99', term: '/week' }, { name: 'Monthly', price: '$9.99', term: '/month' }, { name: 'Annual', price: '$79.99', term: '/year' }]

function App() {
  const [players, setPlayers] = useState<ReturnType<typeof extractNBAPlayerStats>>([])
  const [history, setHistory] = useState<ReturnType<typeof buildNBAPlayerHistory>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [prop, setProp] = useState('Points')
  const [line, setLine] = useState(20)
  const [direction, setDirection] = useState<Direction>('over')
  const [sport, setSport] = useState<string>('NBA')
  const [activeTab, setActiveTab] = useState<'research' | 'pricing'>('research')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const cacheKey = 'edgeiq-nba-2026-27-v2'
        const cached = getCachedData<{
          players: ReturnType<typeof extractNBAPlayerStats>
          history: ReturnType<typeof buildNBAPlayerHistory>
        }>(cacheKey)

        if (cached) {
          if (!cancelled) {
            setPlayers(cached.players)
            setHistory(cached.history)
          }
          return
        }

        const recent = await getRecentNBAGames(120)
        const games = recent.games
        const boxScores: any[][] = []
        const failedBoxScores: string[] = []
        for (let i = 0; i < games.length; i += 8) {
          const batch = await Promise.all(games.slice(i, i + 8).map(async (game) => {
            try {
              return await getNBABoxScore(game.id)
            } catch (boxScoreError) {
              failedBoxScores.push(game.id)
              console.warn(`NBA box score unavailable for ${game.id}`, boxScoreError)
              return []
            }
          }))
          boxScores.push(...batch)
        }
        if (cancelled) return
        const unique = new Map<string, ReturnType<typeof extractNBAPlayerStats>[number]>()
        boxScores.forEach((score) => extractNBAPlayerStats(score).forEach((player) => {
          if (player.id && player.name) unique.set(String(player.id), player)
        }))
        const newHistory = buildNBAPlayerHistory(games, boxScores)
        const historyIds = new Set(Object.keys(newHistory))
        const newPlayers = Array.from(unique.values())
          .filter(player => historyIds.has(String(player.id)))
          .sort((a, b) => a.name.localeCompare(b.name))

        const failures = recent.failedDates.length + failedBoxScores.length
        if (failures === 0 && newPlayers.length > 0) setCachedData(cacheKey, { players: newPlayers, history: newHistory })

        if (!cancelled) {
          setHistory(newHistory)
          setPlayers(newPlayers)
          if (failures > 0) {
            setError(`Some ESPN data could not be loaded (${recent.failedDates.length} scoreboard dates, ${failedBoxScores.length} box scores). Only verified completed games are included; refresh to retry.`)
          } else if (newPlayers.length === 0) {
            setError('No verified 2026–27 regular-season player box scores are currently available from ESPN.')
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'NBA data unavailable')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const selected = players.find((p) => String(p.id) === playerId)
  const games: NBAPlayerGame[] = selected ? history[String(selected.id)] ?? [] : []
  const values = getPlayerPropValues(games, prop)
  const rates = calculateRecentHitRates(values, line, direction)
  const average = calculateAverage(values.slice(0, 10))
  const suggestions = useMemo(() => query.trim().length > 0 && !selected
    ? players.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : [], [players, query, selected])
  const hits = (value: number) => direction === 'over' ? value > line : value < line
  const hitCount = values.filter(hits).length
  const lineLabel = `${direction === 'over' ? 'Over' : 'Under'} ${line}`
  const format = (n: number | null) => n === null ? 'N/A' : `${n}%`
  const periodStats = (count: number) => {
    if (values.length < count) return null
    const recent = values.slice(0, count)
    return { hitCount: recent.filter(hits).length, results: recent }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-icon">E</span><span>EDGE<span className="gold">IQ</span><small>SPORTS INTELLIGENCE</small></span></div>
        <div className="side-caption">SPORTS</div>
        <div style={{ display: 'grid', gap: 6, padding: '0 12px 18px' }}>
          {sports.map((item) => <button key={item.id} onClick={() => { setSport(item.id); setActiveTab('research') }} aria-pressed={sport === item.id} style={{ textAlign: 'left', borderRadius: 9, border: sport === item.id ? '1px solid #ffb612' : '1px solid #31513d', background: sport === item.id ? '#183d2d' : 'transparent', color: '#e6f5e9', padding: '10px 12px', cursor: 'pointer' }}>{item.name} <span style={{ float: 'right', fontSize: 11, color: item.active ? '#64db93' : '#c0c9c1' }}>{item.active ? 'LIVE' : 'PLANNED'}</span></button>)}
        </div><div className="side-caption">WORKSPACE</div>
        <button className={activeTab === 'research' ? 'nav active' : 'nav'} onClick={() => setActiveTab('research')}>▦ &nbsp; Player Research</button>
        <button className={activeTab === 'pricing' ? 'nav active' : 'nav'} onClick={() => setActiveTab('pricing')}>✦ &nbsp; EDGEIQ Pro</button>
        <div className="side-note"><strong>Research, not guarantees.</strong><p>Hit rates describe past results. They are not probabilities of future outcomes.</p></div>
      </aside>
      <main className="main">
        <header className="topbar"><div><span className="eyebrow">EDGEIQ / {activeTab === 'research' ? 'PLAYER RESEARCH' : 'MEMBERSHIP'}</span></div><span className="live-pill"><span className="dot" /> {sport === 'NBA' ? 'NBA DATA RESEARCH' : `${sport} · IN DEVELOPMENT`}</span></header>
        {activeTab === 'research' ? sport === 'NFL' ? <NFLResearch /> : sport !== 'NBA' ? <><section className="hero"><div className="eyebrow gold">MULTI-SPORT RESEARCH</div><h1>{sport} <span className="gold">research.</span></h1><p>We're preparing sport-specific player statistics, historical game logs, prop hit rates and opponent analysis. This sport is not yet connected to verified live data.</p></section><section className="panel" style={{ padding: 28 }}><span className="eyebrow">IN DEVELOPMENT</span><h2>Data connection pending</h2><p>NBA research remains available now. We will only enable {sport} analytics once the data is connected and validated. No fabricated hit rates or matchup grades.</p><button className="cta" onClick={() => setSport('NBA')}>Explore NBA research</button></section></> : <>
          <section className="hero"><div className="eyebrow gold">THE EDGE STARTS WITH THE DATA</div><h1>Find your <span className="gold">edge.</span></h1><p>Player prop research, recent hit rates, and game-by-game trends in one clear workspace.</p></section>
          <div className="section-head"><div><span className="eyebrow">NBA RESEARCH CENTER</span><h2>Player Prop Analyzer</h2></div><span className="data-count" role="status" aria-live="polite">{loading ? 'Loading verified player history…' : error ? players.length ? 'Data partially unavailable' : 'Data unavailable' : `${players.length} players available`}</span></div>
          {error && <div className="error" role="alert" aria-live="assertive">{error}</div>}
          <section className="panel controls">
            <div className="field player-field"><label htmlFor="player-search">PLAYER</label><input id="player-search" placeholder="Search NBA players…" value={query} onChange={(e) => { setQuery(e.target.value); setPlayerId('') }} autoComplete="off" />
              {suggestions.length > 0 && <div className="suggestions">{suggestions.map((p) => <button key={String(p.id)} onClick={() => { setPlayerId(String(p.id)); setQuery(p.name) }}>{p.name}<span>{p.team}</span></button>)}</div>}
            </div>
            <div className="field"><label htmlFor="prop">STAT CATEGORY</label><select id="prop" value={prop} onChange={(e) => setProp(e.target.value)}>{props.map((p) => <option key={p}>{p}</option>)}</select></div>
            <div className="field"><label htmlFor="line">PROP LINE</label><input id="line" type="number" min="0" step="0.5" value={line} onChange={(e) => setLine(Number(e.target.value))} /></div>
            <div className="field"><label htmlFor="direction">DIRECTION</label><select id="direction" value={direction} onChange={(e) => setDirection(e.target.value as Direction)}><option value="over">Over</option><option value="under">Under</option></select></div>
          </section>
          <div className="section-head results-heading"><div><span className="eyebrow">PERFORMANCE SNAPSHOT</span><h2>{selected ? selected.name : 'Select a player'} <span className="muted">{selected ? '· ' + lineLabel + ' ' + prop : ''}</span></h2></div></div>
          <div className="metrics">
            {periods.map((period) => { const count = Number(period.slice(1)); const stats = selected ? periodStats(count) : null; const recentValues = values.slice(0, count); return <div className="metric" key={period}><div className="metric-label">LAST {count} GAMES <span className="metric-mark">↗</span></div><div className="metric-value">{selected ? format(rates[period]) : '—'}</div><div className="metric-sub">{!selected ? 'Select a player to begin' : stats ? `${stats.hitCount} of ${count} games hit · ${direction.toUpperCase()} ${line}` : `Only ${values.length} of ${count} games available`}</div><div className="metric-track" role="img" aria-label={stats ? `${stats.hitCount} hits in ${count} games` : `Only ${recentValues.length} valid games available`} style={{ display: 'flex', gap: '3px', background: 'transparent', overflow: 'visible' }}>{recentValues.map((value, i) => <span key={i} className={value === line ? 'trend-push' : hits(value) ? 'trend-hit' : 'trend-miss'} />)}</div></div> })}
            <div className="metric gold-metric"><div className="metric-label">LAST 10 AVG <span className="metric-mark">◎</span></div><div className="metric-value">{selected && average !== null ? average : '—'}</div><div className="metric-sub">{selected ? `${prop} average · ${Math.min(10, values.length)} available games` : 'Awaiting selection'}</div><div className="metric-track gold-track"><span style={{ width: average === null ? '0%' : '100%' }} /></div></div>
          </div>
          <NBAOpponentExplorer selected={selected} history={history} prop={prop} />
          <div className="details-grid">
            <section className="panel"><div className="panel-title"><div><span className="eyebrow">RECENT PERFORMANCE</span><h3>Game-by-game trend</h3></div><span className="small-tag">{prop}</span></div>
              {values.length ? <><div className="chart">{values.slice(0, 10).reverse().map((v, i) => <div className="bar-col" key={games.slice(0, 10).reverse()[i]?.gameId ?? i}><span className="bar-value">{v}</span><div className={`bar ${v === line ? 'push' : hits(v) ? 'hit' : 'miss'}`} style={{ height: `${Math.max(5, (v / Math.max(...values.slice(0, 10), line + 1)) * 100)}%` }} /><span className="bar-label">{Math.min(10, values.length) - i}</span></div>)}</div><p className="footnote trend-legend">Most recent games at right. <span className="legend-hit">Green = hit</span> · <span className="legend-miss">Gold = miss</span> · <span className="legend-push">Gray = push</span>.</p></> : <div className="empty">{loading ? 'Loading verified player game history…' : error ? 'Game trends are unavailable until ESPN data loads.' : 'Choose a player to display their recent game trends.'}</div>}
            </section>
            <section className="panel"><div className="panel-title"><div><span className="eyebrow">RESEARCH SUMMARY</span><h3>Prop breakdown</h3></div></div>
              <div className="summary-row"><span>Selected line</span><strong>{lineLabel}</strong></div><div className="summary-row"><span>Games available</span><strong>{games.length}</strong></div><div className="summary-row"><span>Hits in available games</span><strong>{selected ? `${hitCount} / ${values.length}` : '—'}</strong></div><div className="summary-row"><span>Last 10 average</span><strong>{selected && average !== null ? average : '—'}</strong></div>
              <div className="info-note">Matchup rankings use the completed game box scores currently loaded by EDGEIQ. They are historical team-level comparisons, not player-specific predictions.</div>
            </section>
          </div>
          <section className="panel log-panel"><div className="panel-title"><div><span className="eyebrow">HISTORICAL RESULTS</span><h3>Recent game log</h3></div><span className="small-tag">NEWEST FIRST</span></div>
            <div className="table-wrap"><table><thead><tr><th>DATE</th><th>OPPONENT</th><th>VENUE</th><th>PTS</th><th>REB</th><th>AST</th><th>3PM</th><th>PRA</th><th>{prop.toUpperCase()} {lineLabel.toUpperCase()}</th></tr></thead><tbody>{games.slice(0, 20).map((g) => { const val = getPlayerPropValues([g], prop)[0]; return <tr key={g.gameId ?? g.date}><td>{new Date(g.date).toLocaleDateString()}</td><td>{g.opponent ?? '—'}</td><td>{g.homeAway === 'home' ? 'HOME' : g.homeAway === 'away' ? 'AWAY' : '—'}</td><td>{g.points}</td><td>{g.rebounds}</td><td>{g.assists}</td><td>{g.threes}</td><td>{g.points + g.rebounds + g.assists}</td><td><span className={val === line ? 'push-chip' : hits(val) ? 'hit-chip' : 'miss-chip'}>{val === line ? 'PUSH' : hits(val) ? 'HIT' : 'MISS'}</span></td></tr> })}{games.length === 0 && <tr><td colSpan={9} className="table-empty">{loading ? 'Loading verified game history…' : error ? 'Game history unavailable; see the data error above.' : 'Select a player to view their game log.'}</td></tr>}</tbody></table></div>
          </section>
        </> : <><section className="hero"><div className="eyebrow gold">EDGEIQ MEMBERSHIP</div><h1>Research your way.</h1><p>Keep the essentials free. Unlock deeper tools as EDGEIQ grows.</p></section><div className="pricing-grid"><div className="panel price-card"><span className="eyebrow">FREE FOREVER</span><h2>$0</h2><p>Player search, available game logs, and recent hit rates.</p><button className="cta" onClick={() => setActiveTab('research')}>Start researching</button></div>{prices.map((p) => <div className="panel price-card" key={p.name}><span className="eyebrow gold">PRO · {p.name.toUpperCase()}</span><h2>{p.price}<small>{p.term}</small></h2><p>Planned: advanced comparisons, matchup research, saved watchlists, and expanded filters.</p><div className="coming-soon">COMING SOON · NO CHARGES</div></div>)}</div><p className="footnote">Subscriptions are a preview only. No payment collection, account entitlements, or premium features are active yet.</p></>}
        <footer>EDGEIQ © 2026 · Independent sports research · No guaranteed outcomes · 18+ where applicable</footer>
      </main>
    </div>
  )
}
export default App
