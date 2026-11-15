import { useState } from 'react'
import './App.css'

const sports = ['NBA', 'NFL', 'MLB', 'NHL', 'NCAAB', 'Soccer', 'UFC'] as const
type LiveSport = 'NBA' | 'NFL'
type Player = { id: number; name: string; team: string; sport: LiveSport; stat: string; current: number; pregame: number | null; live: number | null; elapsed: number; minutes: number; fouls: string; injury: string }
const statOptions: Record<LiveSport, string[]> = {
  NBA: ['Points', 'Rebounds', 'Assists', 'PRA', 'PA', 'PR', 'AR', '3PT Made', 'Steals', 'Blocks', 'Steals + Blocks'],
  NFL: ['Passing Yards', 'Passing TD', 'Interceptions', 'Completions', 'Rushing Yards', 'Rushing Attempts', 'Receiving Yards', 'Receptions', 'Sacks']
}
const fullGameMinutes: Record<LiveSport, number> = { NBA: 48, NFL: 60 }
const format = (n: number) => Number.isFinite(n) ? n.toFixed(1).replace(/\.0$/, '') : '—'
const parseOptional = (value: string) => value.trim() === '' ? null : Number(value)

function App() {
  const [sport, setSport] = useState('NBA')
  const [tab, setTab] = useState<'research' | 'halftime'>('research')
  const [liveSport, setLiveSport] = useState<LiveSport>('NBA')
  const [name, setName] = useState('')
  const [team, setTeam] = useState('')
  const [stat, setStat] = useState('Points')
  const [current, setCurrent] = useState('0')
  const [pregame, setPregame] = useState('')
  const [live, setLive] = useState('')
  const [elapsed, setElapsed] = useState('24')
  const [minutes, setMinutes] = useState('')
  const [fouls, setFouls] = useState('')
  const [injury, setInjury] = useState('')
  const [players, setPlayers] = useState<Player[]>([])
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'All' | LiveSport>('All')

  const addPlayer = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const cur = Number(current), time = Number(elapsed)
    const pre = parseOptional(pregame), liveLine = parseOptional(live)
    if (!name.trim() || !Number.isFinite(cur) || cur < 0 || !Number.isFinite(time) || time <= 0 || time > fullGameMinutes[liveSport] || [pre, liveLine].some(x => x !== null && (!Number.isFinite(x) || x < 0))) {
      setError('Enter a player, a valid current stat, and elapsed game time. Lines must be positive numbers when supplied.')
      return
    }
    const played = minutes.trim() ? Number(minutes) : 0
    if (!Number.isFinite(played) || played < 0 || played > time) { setError('Player minutes must be between 0 and elapsed game minutes.'); return }
    setPlayers(prev => [{ id: Date.now(), name: name.trim(), team: team.trim(), sport: liveSport, stat, current: cur, pregame: pre, live: liveLine, elapsed: time, minutes: played, fouls, injury: injury.trim() }, ...prev])
    setError('')
    setName(''); setTeam(''); setCurrent('0'); setPregame(''); setLive(''); setMinutes(''); setFouls(''); setInjury('')
  }
  const chooseSport = (value: LiveSport) => {
    setLiveSport(value); setStat(statOptions[value][0]); setElapsed(value === 'NBA' ? '24' : '30')
  }

  return (
    <main className="edge-shell">
      <header className="edge-header">
        <div><h1>EDGE<span>IQ</span></h1><p>SPORTS INTELLIGENCE PLATFORM</p></div>
        <span className="edge-brand">RESEARCH THE EDGE</span>
      </header>
      <section className="edge-hero">
        <p className="edge-eyebrow">SMARTER RESEARCH. BETTER DECISIONS.</p>
        <h2>Your Sports Analytics Command Center</h2>
        <p>Research players, compare matchups, and explore data-driven insights.</p>
      </section>
      <nav className="edge-tabs" aria-label="Analytics sections">
        <button className={tab === 'research' ? 'selected' : ''} onClick={() => setTab('research')}>Sports Research</button>
        <button className={tab === 'halftime' ? 'selected' : ''} onClick={() => setTab('halftime')}>⏱ Halftime Edge</button>
      </nav>
      {tab === 'research' ? <>
        <div className="edge-tabs" aria-label="Choose sport">
          {sports.map(item => <button key={item} className={sport === item ? 'selected' : ''} onClick={() => setSport(item)}>{item}</button>)}
        </div>
        <section className="edge-panel"><p className="edge-eyebrow">{sport} ANALYTICS</p><h2>{sport} Research Center</h2><p>Player statistics, matchup ratings, projections, and trends will appear here once data sources are connected.</p><p className="edge-note">Dashboard preview — live data not connected yet.</p></section>
      </> : <>
        <section className="edge-panel">
          <div className="edge-heading"><div><p className="edge-eyebrow">HALFTIME EDGE · 2H RESEARCH</p><h2>Live Prop Tracker</h2></div><span className="edge-status">Manual tracking</span></div>
          <p>Track a player's halftime totals against pregame and live prop lines. Add the latest numbers from your source to calculate what they still need and their simple game pace.</p>
          <p className="edge-warning">⚠ Live sports data and sportsbook odds are not connected. Figures below are user-entered, not automatically updated or verified. Pace is a simple extrapolation, not a prediction or betting recommendation.</p>
          <div className="edge-tabs">{(['NBA', 'NFL'] as const).map(s => <button key={s} className={liveSport === s ? 'selected' : ''} onClick={() => chooseSport(s)}>{s}</button>)}</div>
          <form className="edge-form" onSubmit={addPlayer}>
            <label>Player name<input required value={name} onChange={e => setName(e.target.value)} placeholder="Enter player's name" /></label>
            <label>Team (optional)<input value={team} onChange={e => setTeam(e.target.value)} placeholder="Team" /></label>
            <label>Prop category<select value={stat} onChange={e => setStat(e.target.value)}>{statOptions[liveSport].map(s => <option key={s}>{s}</option>)}</select></label>
            <label>Current stat<input type="number" min="0" step="any" required value={current} onChange={e => setCurrent(e.target.value)} /></label>
            <label>Pregame line (optional)<input type="number" min="0" step="any" value={pregame} onChange={e => setPregame(e.target.value)} placeholder="e.g. 24.5" /></label>
            <label>Live line (optional)<input type="number" min="0" step="any" value={live} onChange={e => setLive(e.target.value)} placeholder="e.g. 27.5" /></label>
            <label>Elapsed game minutes<input type="number" min="0.1" max={fullGameMinutes[liveSport]} step="any" required value={elapsed} onChange={e => setElapsed(e.target.value)} /></label>
            <label>Player minutes (optional)<input type="number" min="0" step="any" value={minutes} onChange={e => setMinutes(e.target.value)} placeholder="NBA minutes played" /></label>
            {liveSport === 'NBA' && <label>Personal fouls (optional)<input type="number" min="0" max="6" step="1" value={fouls} onChange={e => setFouls(e.target.value)} /></label>}
            <label className="edge-wide">Injury or matchup note (optional)<input value={injury} onChange={e => setInjury(e.target.value)} placeholder="Only enter information you've verified" /></label>
            {error && <p className="edge-error" role="alert">{error}</p>}
            <button className="edge-add" type="submit">+ Add to Halftime Board</button>
          </form>
        </section>
        <section className="edge-panel">
          <div className="edge-heading"><div><p className="edge-eyebrow">YOUR HALFTIME BOARD</p><h2>Tracked Props ({players.length})</h2></div><select aria-label="Filter tracked props" value={filter} onChange={e => setFilter(e.target.value as 'All' | LiveSport)}><option>All</option><option>NBA</option><option>NFL</option></select></div>
          {players.filter(p => filter === 'All' || filter === p.sport).length === 0 ? <div className="edge-empty">No players added yet. Enter a player's current game stats above to start tracking. No sample or fabricated live numbers are displayed.</div> :
            <div className="edge-cards">{players.filter(p => filter === 'All' || filter === p.sport).map(p => {
              const pace = p.current / p.elapsed * fullGameMinutes[p.sport]
              const line = p.live ?? p.pregame
              return <article key={p.id} className="edge-card">
                <div className="edge-heading"><div><strong>{p.name}</strong><p>{p.sport} {p.team && '· ' + p.team} · {p.stat}</p></div><button className="edge-remove" onClick={() => setPlayers(prev => prev.filter(x => x.id !== p.id))} aria-label={'Remove ' + p.name}>Remove</button></div>
                <div className="edge-metrics">
                  <div><small>Current total</small><strong>{format(p.current)}</strong></div><div><small>Pregame line</small><strong>{p.pregame === null ? '—' : format(p.pregame)}</strong></div><div><small>Live line</small><strong>{p.live === null ? '—' : format(p.live)}</strong></div><div><small>Full-game pace*</small><strong>{format(pace)}</strong></div>
                </div>
                <p className="edge-summary">{line === null ? 'Enter a pregame or live line to compare.' : p.current > line ? 'Current total is already above the ' + (p.live !== null ? 'live' : 'pregame') + ' line.' : 'Needs more than ' + format(Math.max(0, line - p.current)) + ' additional ' + p.stat.toLowerCase() + ' to finish over the ' + (p.live !== null ? 'live' : 'pregame') + ' line.'}</p>
                <p className="edge-meta">{format(p.elapsed)} of {fullGameMinutes[p.sport]} game minutes elapsed {p.minutes > 0 ? '· ' + format(p.minutes) + ' player minutes' : ''} {p.fouls ? '· ' + p.fouls + ' fouls' : ''}</p>
                {p.injury && <p className="edge-meta">Note: {p.injury}</p>}
              </article>
            })}</div>}
          <p className="edge-fine">*Full-game pace = current stat ÷ elapsed game minutes × regulation minutes. It ignores substitutions, changing usage, overtime, game flow, and other important factors. Updates require manually adding new figures. Entries reset when the page reloads.</p>
        </section>
      </>}
      <footer>EDGEIQ © 2026 · Analytics for research and education · No guaranteed outcomes</footer>
    </main>
  )
}
export default App
