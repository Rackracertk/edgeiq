import { useEffect, useMemo, useState } from 'react'
import './App.css'
import NFLResearch from './NFLResearch'
import DailyCheatSheet from './DailyCheatSheet'
import type { CheatPick } from './cheatSheetData'
import AccountCenter from './AccountCenter'
import ProInsights from './ProInsights'
import { getVerifiedFeed, usingLicensedFeed } from './verifiedFeed'
import NBAOpponentExplorer from './NBAOpponentExplorer'
import { calculateAverage, calculateRecentHitRates, type Direction } from './analytics/hitRates'
import { getPlayerPropValues, getNBAGamePropValue, NBA_PROP_CATEGORIES, isNBABinaryProp, defaultNBALine, type NBAPlayerGame } from './analytics/nbaData'
import { getNBABoxScore, extractNBAPlayerStats, getRecentNBAGames, buildNBAPlayerHistory } from './analytics/espnData'
import { getCachedData, setCachedData } from './analytics/cache'
const props = NBA_PROP_CATEGORIES
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

function App() {
  const [players, setPlayers] = useState<ReturnType<typeof extractNBAPlayerStats>>([])
  const [history, setHistory] = useState<ReturnType<typeof buildNBAPlayerHistory>>({})
  const [nbaUpcoming, setNbaUpcoming] = useState<Record<string, string>>({})
  const [nflCurrent, setNflCurrent] = useState<{ playerId: string; playerName: string; statCategory: string; line: number; direction: Direction } | null>(null)
  const [nflCheatSelection, setNflCheatSelection] = useState<{ playerId: string; playerName: string; statCategory: string; line: number; direction: Direction } | null>(null)
  const [nbaTeamLabels, setNbaTeamLabels] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [prop, setProp] = useState('Points')
  const [line, setLine] = useState(20)
  const [direction, setDirection] = useState<Direction>('over')
  const [sport, setSport] = useState<string>('NBA')
  const [activeTab, setActiveTab] = useState<'research' | 'pricing' | 'account' | 'cheatsheet'>('cheatsheet')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        if (usingLicensedFeed) {
          const feed = await getVerifiedFeed<{
            players: ReturnType<typeof extractNBAPlayerStats>
            history: ReturnType<typeof buildNBAPlayerHistory>
            nextOpponents?: Record<string, string>
            teamAbbreviations?: Record<string, string>
          }>('NBA')
          if (!cancelled) {
            setPlayers(feed.data.players)
            setHistory(feed.data.history)
            setNbaUpcoming(feed.data.nextOpponents ?? {})
            setNbaTeamLabels(feed.data.teamAbbreviations ?? {})
            if (feed.stale) setError('Verified NBA feed is more than an hour old. Last updated ' + new Date(feed.refreshedAt).toLocaleString())
          }
          return
        }
        const cacheKey = 'edgeiq-nba-2026-27-v3'
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
  const eligibleGames = games.filter(game => getNBAGamePropValue(game, prop) !== null)
  const values = getPlayerPropValues(eligibleGames, prop)
  const rates = calculateRecentHitRates(values, line, direction)
  const average = calculateAverage(values.slice(0, 10))
  const suggestions = useMemo(() => query.trim().length > 0 && !selected
    ? players.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : [], [players, query, selected])
  const hits = (value: number) => direction === 'over' ? value > line : value < line
  const hitCount = values.filter(hits).length
  const lineLabel = isNBABinaryProp(prop) ? (direction === 'over' ? 'Yes' : 'No') : `${direction === 'over' ? 'Over' : 'Under'} ${line}`
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
        <button className={activeTab === 'cheatsheet' ? 'nav active' : 'nav'} onClick={() => setActiveTab('cheatsheet')}>★ &nbsp; Daily Cheat Sheet</button>
        <button className={activeTab === 'research' ? 'nav active' : 'nav'} onClick={() => setActiveTab('research')}>▦ &nbsp; Player Research</button>
        <button className={activeTab === 'pricing' ? 'nav active' : 'nav'} onClick={() => setActiveTab('pricing')}>✦ &nbsp; EDGEIQ Pro</button>
        <button className={activeTab === 'account' ? 'nav active' : 'nav'} onClick={() => setActiveTab('account')}>♙ &nbsp; My Account</button>
        <div className="side-note"><strong>Research, not guarantees.</strong><p>Hit rates describe past results. They are not probabilities of future outcomes.</p></div>
      </aside>
      <main className="main">
        <header className="topbar"><div><span className="eyebrow">EDGEIQ / {activeTab === 'cheatsheet' ? 'DAILY CHEAT SHEET' : activeTab === 'research' ? 'PLAYER RESEARCH' : activeTab === 'pricing' ? 'MEMBERSHIP' : 'MY ACCOUNT'}</span></div><span className="live-pill"><span className="dot" /> {activeTab === 'cheatsheet' ? 'DAILY RESEARCH BOARD' : sport === 'NBA' ? 'NBA DATA RESEARCH' : sport === 'NFL' ? 'NFL DATA RESEARCH' : `${sport} · IN DEVELOPMENT`}</span></header>
        {activeTab === 'cheatsheet' ? <DailyCheatSheet nbaPlayers={players} nbaHistory={history} nbaLoading={loading} nbaError={error} onPro={() => setActiveTab('pricing')} onResearch={(pick: CheatPick) => { setSport(pick.sport); setActiveTab('research'); if (pick.sport === 'NBA') { setPlayerId(pick.playerId); setQuery(pick.player); setProp(pick.category); setLine(pick.line); setDirection(pick.direction) } else { setNflCheatSelection({ playerId: pick.playerId, playerName: pick.player, statCategory: pick.category, line: pick.line, direction: pick.direction }) } }} /> : activeTab === 'research' ? sport === 'NFL' ? <NFLResearch key={nflCheatSelection ? `${nflCheatSelection.playerId}-${nflCheatSelection.statCategory}-${nflCheatSelection.line}-${nflCheatSelection.direction}` : 'nfl-default'} initialSelection={nflCheatSelection} onUpgrade={() => setActiveTab('pricing')} onResearchChange={setNflCurrent} /> : sport !== 'NBA' ? <><section className="hero"><div className="eyebrow gold">MULTI-SPORT RESEARCH</div><h1>{sport} <span className="gold">research.</span></h1><p>We're preparing sport-specific player statistics, historical game logs, prop hit rates and opponent analysis. This sport is not yet connected to verified live data.</p></section><section className="panel" style={{ padding: 28 }}><span className="eyebrow">IN DEVELOPMENT</span><h2>Data connection pending</h2><p>NBA research remains available now. We will only enable {sport} analytics once the data is connected and validated. No fabricated hit rates or matchup grades.</p><button className="cta" onClick={() => setSport('NBA')}>Explore NBA research</button></section></> : <>
          <section className="hero"><div className="eyebrow gold">THE EDGE STARTS WITH THE DATA</div><h1>Find your <span className="gold">edge.</span></h1><p>Player prop research, recent hit rates, and game-by-game trends in one clear workspace.</p></section>
          <div className="section-head"><div><span className="eyebrow">NBA RESEARCH CENTER</span><h2>Player Prop Analyzer</h2></div><span className="data-count" role="status" aria-live="polite">{loading ? 'Loading verified player history…' : error ? players.length ? 'Data partially unavailable' : 'Data unavailable' : `${players.length} players available`}</span></div>
          {error && <div className="error" role="alert" aria-live="assertive">{error}</div>}
          <section className="panel controls">
            <div className="field player-field"><label htmlFor="player-search">PLAYER</label><input id="player-search" placeholder="Search NBA players…" value={query} onChange={(e) => { setQuery(e.target.value); setPlayerId('') }} autoComplete="off" />
              {suggestions.length > 0 && <div className="suggestions">{suggestions.map((p) => <button key={String(p.id)} onClick={() => { setPlayerId(String(p.id)); setQuery(p.name) }}>{p.name}<span>{p.team}</span></button>)}</div>}
            </div>
            <div className="field"><label htmlFor="prop">STAT CATEGORY</label><select id="prop" value={prop} onChange={(e) => { const next = e.target.value; setProp(next); setLine(defaultNBALine(next)); setDirection('over') }}>{props.map((p) => <option key={p}>{p}</option>)}</select></div>
            <div className="field"><label htmlFor="line">PROP LINE</label><input id="line" type="number" min="0" step="0.5" disabled={isNBABinaryProp(prop)} value={line} onChange={(e) => setLine(Number(e.target.value))} /></div>
            <div className="field"><label htmlFor="direction">DIRECTION</label><select id="direction" value={direction} onChange={(e) => setDirection(e.target.value as Direction)}><option value="over">{isNBABinaryProp(prop) ? 'Yes' : 'Over'}</option><option value="under">{isNBABinaryProp(prop) ? 'No' : 'Under'}</option></select></div>
          </section>
          <div className="section-head results-heading"><div><span className="eyebrow">PERFORMANCE SNAPSHOT</span><h2>{selected ? selected.name : 'Select a player'} <span className="muted">{selected ? '· ' + lineLabel + ' ' + prop : ''}</span></h2></div></div>
          <div className="metrics">
            {periods.map((period) => { const count = Number(period.slice(1)); const stats = selected ? periodStats(count) : null; const recentValues = values.slice(0, count); return <div className="metric" key={period}><div className="metric-label">LAST {count} GAMES <span className="metric-mark">↗</span></div><div className="metric-value">{selected ? format(rates[period]) : '—'}</div><div className="metric-sub">{!selected ? 'Select a player to begin' : stats ? `${stats.hitCount} of ${count} games hit · ${lineLabel.toUpperCase()}` : `Only ${values.length} of ${count} games available`}</div><div className="metric-track" role="img" aria-label={stats ? `${stats.hitCount} hits in ${count} games` : `Only ${recentValues.length} valid games available`} style={{ display: 'flex', gap: '3px', background: 'transparent', overflow: 'visible' }}>{recentValues.map((value, i) => <span key={i} className={value === line ? 'trend-push' : hits(value) ? 'trend-hit' : 'trend-miss'} />)}</div></div> })}
            <div className="metric gold-metric"><div className="metric-label">LAST 10 AVG <span className="metric-mark">◎</span></div><div className="metric-value">{selected && average !== null ? average : '—'}</div><div className="metric-sub">{selected ? `${prop} average · ${Math.min(10, values.length)} available games` : 'Awaiting selection'}</div><div className="metric-track gold-track"><span style={{ width: average === null ? '0%' : '100%' }} /></div></div>
          </div>
          <NBAOpponentExplorer selected={selected} history={history} prop={prop} nextOpponents={nbaUpcoming} teamLabels={nbaTeamLabels} />
          <ProInsights sport="NBA" playerId={selected ? String(selected.id) : null} playerName={selected?.name} prop={prop} line={line} direction={direction} onUpgrade={() => setActiveTab('pricing')} />
          <div className="details-grid">
            <section className="panel"><div className="panel-title"><div><span className="eyebrow">RECENT PERFORMANCE</span><h3>Game-by-game trend</h3></div><span className="small-tag">{prop}</span></div>
              {values.length ? <><div className="chart">{values.slice(0, 10).reverse().map((v, i) => <div className="bar-col" key={eligibleGames.slice(0, 10).reverse()[i]?.gameId ?? i}><span className="bar-value">{v}</span><div className={`bar ${v === line ? 'push' : hits(v) ? 'hit' : 'miss'}`} style={{ height: `${Math.max(5, (v / Math.max(...values.slice(0, 10), line + 1)) * 100)}%` }} /><span className="bar-label">{Math.min(10, values.length) - i}</span></div>)}</div><p className="footnote trend-legend">Most recent games at right. <span className="legend-hit">Green = hit</span> · <span className="legend-miss">Gold = miss</span> · <span className="legend-push">Gray = push</span>.</p></> : <div className="empty">{loading ? 'Loading verified player game history…' : error ? 'Game trends are unavailable until ESPN data loads.' : 'Choose a player to display their recent game trends.'}</div>}
            </section>
            <section className="panel"><div className="panel-title"><div><span className="eyebrow">RESEARCH SUMMARY</span><h3>Prop breakdown</h3></div></div>
              <div className="summary-row"><span>Selected line</span><strong>{lineLabel}</strong></div><div className="summary-row"><span>Games available</span><strong>{eligibleGames.length}</strong></div><div className="summary-row"><span>Hits in available games</span><strong>{selected ? `${hitCount} / ${values.length}` : '—'}</strong></div><div className="summary-row"><span>Last 10 average</span><strong>{selected && average !== null ? average : '—'}</strong></div>
              <div className="info-note">Matchup rankings use the completed game box scores currently loaded by EDGEIQ. They are historical team-level comparisons, not player-specific predictions.</div>
            </section>
          </div>
          <section className="panel log-panel"><div className="panel-title"><div><span className="eyebrow">HISTORICAL RESULTS</span><h3>Recent game log</h3></div><span className="small-tag">NEWEST FIRST</span></div>
            <div className="table-wrap"><table><thead><tr><th>DATE</th><th>OPPONENT</th><th>VENUE</th><th>PTS</th><th>REB</th><th>AST</th><th>3PM</th><th>STL</th><th>BLK</th><th>PRA</th><th>{prop.toUpperCase()} {lineLabel.toUpperCase()}</th></tr></thead><tbody>{games.slice(0, 20).map((g) => { const val = getPlayerPropValues([g], prop)[0]; return <tr key={g.gameId ?? g.date}><td>{new Date(g.date).toLocaleDateString()}</td><td>{g.opponent ?? '—'}</td><td>{g.homeAway === 'home' ? 'HOME' : g.homeAway === 'away' ? 'AWAY' : '—'}</td><td>{g.points}</td><td>{g.rebounds}</td><td>{g.assists}</td><td>{g.threes}</td><td>{g.steals ?? '—'}</td><td>{g.blocks ?? '—'}</td><td>{g.points + g.rebounds + g.assists}</td><td>{val === undefined ? <span className="footnote">N/A</span> : <span className={val === line ? 'push-chip' : hits(val) ? 'hit-chip' : 'miss-chip'}>{val === line ? 'PUSH' : hits(val) ? 'HIT' : 'MISS'}</span>}</td></tr> })}{games.length === 0 && <tr><td colSpan={11} className="table-empty">{loading ? 'Loading verified game history…' : error ? 'Game history unavailable; see the data error above.' : 'Select a player to view their game log.'}</td></tr>}</tbody></table></div>
          </section>
        </> : <AccountCenter mode={activeTab === 'pricing' ? 'pricing' : 'account'} onResearch={() => setActiveTab('research')} currentResearch={sport === 'NBA' && selected ? { sport: 'NBA', playerId: String(selected.id), playerName: selected.name, statCategory: prop, line, direction } : sport === 'NFL' && nflCurrent ? { sport: 'NFL', ...nflCurrent } : null} />}
        <footer>EDGEIQ © 2026 · Independent sports research · No guaranteed outcomes · 18+ where applicable</footer>
      </main>
    </div>
  )
}
export default App
