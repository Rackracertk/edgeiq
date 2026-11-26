import PlayerResearchCard from './PlayerResearchCard'
import {usePlayerInjury} from './usePlayerInjury'
import { useEffect, useMemo, useState } from 'react'
import './App.css'
import NFLResearch from './NFLResearch'
import GameLines from './GameLines'
import InjuryCenter from './InjuryCenter'
import HalftimeEdge from './HalftimeEdge'
import TheScript from './TheScript'
import Home from './Home'
import type { Fixture } from './analytics/scriptSports'
import AccountCenter from './AccountCenter'
import ProInsights from './ProInsights'
import { getVerifiedFeed, usingLicensedFeed } from './verifiedFeed'
import NBAOpponentExplorer from './NBAOpponentExplorer'
import MultiSportBoard, { type AddedSport } from './MultiSportBoard'
import type { ScriptSport } from './analytics/scriptSports'
import { type Direction } from './analytics/hitRates'
import { getPlayerPropValues, getNBAGamePropValue, NBA_PROP_CATEGORIES, isNBABinaryProp, defaultNBALine, type NBAPlayerGame } from './analytics/nbaData'
import { getNBABoxScore, extractNBAPlayerStats, getRecentNBAGames, buildNBAPlayerHistory } from './analytics/espnData'
import { getCachedData, setCachedData } from './analytics/cache'
type NBAResearchPublication = {
  schemaVersion: number
  generatedAt: string
  players: ReturnType<typeof extractNBAPlayerStats>
  history: ReturnType<typeof buildNBAPlayerHistory>
  nextOpponents: Record<string, string>
  teamAbbreviations: Record<string, string>
}
const props = NBA_PROP_CATEGORIES
const sports = [
  { id: 'NBA', name: 'NBA', label: 'Basketball', active: true },
  { id: 'NFL', name: 'NFL', label: 'Football', active: true },
  { id: 'MLB', name: 'MLB', label: 'Baseball', active: true },
  { id: 'NHL', name: 'NHL', label: 'Hockey', active: true },
  { id: 'NCAAF', name: 'NCAAF', label: 'College football', active: true },
  { id: 'NCAAB', name: 'NCAAB', label: 'College basketball', active: true },
  { id: 'SOCCER', name: 'Soccer', label: 'Soccer', active: true },
  { id: 'WNBA', name: 'WNBA', label: 'Basketball', active: true },
  { id: 'TENNIS', name: 'Tennis', label: 'Tennis', active: true },
  { id: 'MMA', name: 'UFC / MMA', label: 'Mixed martial arts', active: true },
] as const

function App() {
  const [players, setPlayers] = useState<ReturnType<typeof extractNBAPlayerStats>>([])
  const [history, setHistory] = useState<ReturnType<typeof buildNBAPlayerHistory>>({})
  const [nbaUpcoming, setNbaUpcoming] = useState<Record<string, string>>({})
  const [nflCurrent, setNflCurrent] = useState<{ playerId: string; playerName: string; statCategory: string; line: number; direction: Direction } | null>(null)
  const [nbaTeamLabels, setNbaTeamLabels] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [nbaResearchSource, setNbaResearchSource] = useState('')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [prop, setProp] = useState('Points')
  const [line, setLine] = useState(20)
  const [direction, setDirection] = useState<Direction>('over')
  const [sport, setSport] = useState<string>('NBA')
  const [activeTab, setActiveTab] = useState<'home' | 'research' | 'pricing' | 'account' | 'markets' | 'injuries' | 'halftime' | 'script'>('home')
  const [scriptGame,setScriptGame]=useState<Fixture|null>(null)
  const openScript=(game?:Fixture)=>{setScriptGame(game??null);setActiveTab('script')}

  useEffect(() => {
    if(activeTab!=='research'||sport!=='NBA')return
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
        // The unattended publisher prepares one verified shared history snapshot.
        // Prefer that over making every visitor download hundreds of ESPN boxscores.
        try {
          const response = await fetch('/edgeiq-nba-history.json?rev=' + Date.now(), { cache: 'no-store' })
          if (!response.ok) throw Error('Published NBA research unavailable (' + response.status + ')')
          const published = await response.json() as NBAResearchPublication
          if (published.schemaVersion !== 1 ||
              !Array.isArray(published.players) || !published.players.length ||
              !published.history || !Object.keys(published.history).length ||
              !Number.isFinite(Date.parse(published.generatedAt)) ||
              Date.now() - Date.parse(published.generatedAt) > 36 * 60 * 60 * 1000) {
            throw Error('Published NBA research missing or expired')
          }
          if (!cancelled) {
            setPlayers(published.players)
            setHistory(published.history)
            setNbaUpcoming(published.nextOpponents ?? {})
            setNbaTeamLabels(published.teamAbbreviations ?? {})
            setNbaResearchSource('Unattended daily publisher · ' +
              new Date(published.generatedAt).toLocaleString('en-US',{
                timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',
              }) + ' ET')
          }
          return
        } catch(error) {
          console.warn('Published NBA history unavailable; checking local backup.',error)
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
            setNbaResearchSource('Cached completed-game history; nightly publication unavailable')
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
          setNbaResearchSource('Browser historical feed; nightly publication unavailable')
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
  }, [activeTab,sport])

  const selected = players.find((p) => String(p.id) === playerId)
  const injury=usePlayerInjury('NBA',selected?String(selected.id):undefined,selected?.name,selected?.team)
  const games: NBAPlayerGame[] = selected ? history[String(selected.id)] ?? [] : []
  const eligibleGames = games.filter(game => getNBAGamePropValue(game, prop) !== null)
  const values = getPlayerPropValues(eligibleGames, prop)
  const suggestions = useMemo(() => query.trim().length > 0 && !selected
    ? players.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : [], [players, query, selected])
  const hits = (value: number) => direction === 'over' ? value > line : value < line
  const lineLabel = isNBABinaryProp(prop) ? (direction === 'over' ? 'Yes' : 'No') : `${direction === 'over' ? 'Over' : 'Under'} ${line}`

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-icon">E</span><span>EDGE<span className="gold">IQ</span><small>SPORTS INTELLIGENCE</small></span></div>
        <div className="side-caption">SPORTS</div>
        <div style={{ display: 'grid', gap: 6, padding: '0 12px 18px' }}>
          {sports.map((item) => <button key={item.id} onClick={() => { setSport(item.id); setScriptGame(null); setActiveTab('home') }} aria-pressed={sport === item.id} style={{ textAlign: 'left', borderRadius: 9, border: sport === item.id ? '1px solid #ffb612' : '1px solid #31513d', background: sport === item.id ? '#183d2d' : 'transparent', color: '#e6f5e9', padding: '10px 12px', cursor: 'pointer' }}>{item.name} <span style={{ float: 'right', fontSize: 11, color: item.active ? '#64db93' : '#c0c9c1' }}>{item.id === 'NBA' || item.id === 'NFL' ? 'DATA' : 'RESEARCH'}</span></button>)}
        </div>
        <div className="side-caption">EXPLORE</div>
        <button className={activeTab==='home'?'nav active':'nav'} onClick={()=>setActiveTab('home')}>⌂ &nbsp; Home</button>
        <button className={activeTab==='script'?'nav active script-nav':'nav script-nav'} onClick={()=>openScript()}>◈ &nbsp; The Script</button>
        <button className={activeTab==='research'?'nav active':'nav'} onClick={()=>setActiveTab('research')}>▦ &nbsp; Player Props</button>
        <button className={activeTab==='halftime'?'nav active':'nav'} onClick={()=>setActiveTab('halftime')}>◷ &nbsp; Live Edge</button>
        <button className={activeTab==='injuries'?'nav active':'nav'} onClick={()=>setActiveTab('injuries')}>✚ &nbsp; Injuries</button>
        <div className="side-note"><strong>Everything is free.</strong><p>No subscription or account needed to browse. Past results do not guarantee future outcomes.</p></div>
      </aside>
      <main className="main">
        <header className="topbar"><div><span className="eyebrow">EDGEIQ / {activeTab === 'home' ? 'HOME' : activeTab === 'script' ? 'THE SCRIPT' : activeTab === 'markets' ? 'GAME LINES' : activeTab === 'injuries' ? 'INJURY CENTER' : activeTab === 'halftime' ? 'HALFTIME EDGE' : activeTab === 'research' ? 'PLAYER RESEARCH' : activeTab === 'pricing' ? 'MEMBERSHIP' : 'MY ACCOUNT'}</span></div><span className="free-beta-pill">FREE BETA</span><button className="nav account-shortcut" onClick={()=>setActiveTab("account")} aria-label="My account">My account</button><span className="live-pill"><span className="dot" /> {activeTab === 'script' ? 'MATCHUP INTELLIGENCE' : activeTab === 'markets' ? 'GAME MARKETS' : activeTab === 'injuries' ? 'PLAYER AVAILABILITY' : activeTab === 'halftime' ? 'SECOND-HALF RESEARCH' : sport === 'NBA' ? 'NBA DATA RESEARCH' : sport === 'NFL' ? 'NFL DATA RESEARCH' : `${sport} · MATCHUP RESEARCH`}</span></header>
        {activeTab === 'home' ? <Home sport={sport as ScriptSport} onOpen={openScript} onAccount={()=>setActiveTab('account')}/> : activeTab === 'script' ? <TheScript key={sport+'|'+(scriptGame?.id??'default')} selectedSport={sport as ScriptSport} onSportChange={setSport} initialGame={scriptGame??undefined} /> : activeTab === 'halftime' ? <HalftimeEdge /> : activeTab === 'injuries' ? <InjuryCenter /> : activeTab === 'markets' ? <GameLines onPro={() => setActiveTab('script')} /> : activeTab === 'research' ? sport === 'NFL' ? <NFLResearch key="nfl-default" onUpgrade={() => setActiveTab('pricing')} onResearchChange={setNflCurrent} /> : sport !== 'NBA' ? (sport === 'TENNIS' || sport === 'MMA' ? <section className="panel"><h2>Individual sport research</h2><p>Open The Script for event schedules and available observed statistics.</p><button className="cta" onClick={()=>setActiveTab('script')}>Open The Script</button></section> : <><section className="panel"><h2>{sport} player research</h2><p>Open a game in The Script for recorded player box scores and available markets.</p><button className="cta" onClick={()=>openScript()}>Explore matchups</button></section><MultiSportBoard key={sport} initialSport={sport as AddedSport} /></>) : <>
          <section className="hero"><div className="eyebrow gold">THE EDGE STARTS WITH THE DATA</div><h1>Find your <span className="gold">edge.</span></h1><p>Player prop research, recent hit rates, and game-by-game trends in one clear workspace.</p></section>
          <div className="section-head"><div><span className="eyebrow">NBA RESEARCH CENTER</span><h2>Player Prop Analyzer</h2></div><span className="data-count" role="status" aria-live="polite">{loading ? 'Loading verified player history…' : error ? players.length ? 'Data partially unavailable' : 'Data unavailable' : `${players.length} players available`}</span></div>
          {nbaResearchSource && <div className="cheat-publish-live" role="status" style={{marginBottom:18}}>
            <strong>NBA game logs ready</strong><span>{nbaResearchSource}</span>
          </div>}
          {error && <div className="error" role="alert" aria-live="assertive">{error}</div>}
          <section className="panel controls">
            <div className="field player-field"><label htmlFor="player-search">PLAYER</label><input id="player-search" placeholder="Search NBA players…" value={query} onChange={(e) => { setQuery(e.target.value); setPlayerId('') }} autoComplete="off" />
              {suggestions.length > 0 && <div className="suggestions">{suggestions.map((p) => <button key={String(p.id)} onClick={() => { setPlayerId(String(p.id)); setQuery(p.name) }}>{p.name}<span>{p.team}</span></button>)}</div>}
            </div>
            <div className="field"><label htmlFor="prop">STAT CATEGORY</label><select id="prop" value={prop} onChange={(e) => { const next = e.target.value; setProp(next); setLine(defaultNBALine(next)); setDirection('over') }}>{props.map((p) => <option key={p}>{p}</option>)}</select></div>
            <div className="field"><label htmlFor="line">ANALYSIS LINE</label><input id="line" type="number" min="0" step="0.5" disabled={isNBABinaryProp(prop)} value={line} onChange={(e) => setLine(Number(e.target.value))} /></div>
            <div className="field"><label htmlFor="direction">DIRECTION</label><select id="direction" value={direction} onChange={(e) => setDirection(e.target.value as Direction)}><option value="over">{isNBABinaryProp(prop) ? 'Yes' : 'Over'}</option><option value="under">{isNBABinaryProp(prop) ? 'No' : 'Under'}</option></select></div>
          </section>
          {selected?<PlayerResearchCard name={selected.name} category={prop} rows={eligibleGames.map((g,i)=>({value:values[i],date:g.date,gameId:g.gameId}))} line={line} direction={direction} injury={injury} defense={<a href="#nba-defense-detail" onClick={()=>{const el=document.getElementById("nba-defense-detail");if(el instanceof HTMLDetailsElement)el.open=true}}>View matchup</a>}/>:<section className="panel"><p>Select a player to see their research card.</p></section>}
          <details className="panel pr-advanced" id="nba-defense-detail"><summary>Opponent defense and matchup analysis</summary>
          <NBAOpponentExplorer selected={selected} history={history} prop={prop} line={line} direction={direction} nextOpponents={nbaUpcoming} teamLabels={nbaTeamLabels} /></details>
          <ProInsights sport="NBA" playerId={selected ? String(selected.id) : null} playerName={selected?.name} prop={prop} line={line} direction={direction} onUpgrade={() => setActiveTab('pricing')} />
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
