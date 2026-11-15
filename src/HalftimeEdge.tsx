import { useEffect, useState } from 'react'
import './HalftimeEdge.css'

type Sport = 'NBA' | 'NFL'
type Entry = { id: string; player: string; team: string; sport: Sport; category: string; current: number; pregame: number | null; live: number | null; elapsed: number; playerMinutes: number | null; fouls: number | null; note: string; updatedAt: string }
const nba = ['Points', 'Rebounds', 'Assists', 'PRA', 'Points + Assists', 'Points + Rebounds', 'Assists + Rebounds', '3PT Made', 'Steals', 'Blocks', 'Steals + Blocks']
const nfl = ['Passing Yards', 'Pass Completions', 'Passing TD', 'Interceptions', 'Rushing Yards', 'Rushing Attempts', 'Receiving Yards', 'Receptions', 'Sacks']
const storageKey = 'edgeiq-halftime-tracker-v1'
const show = (value: number) => value.toFixed(1).replace(/\.0$/, '')
function HalftimeEdge() {
  const [entries, setEntries] = useState<Entry[]>(() => {
    try { const stored = JSON.parse(localStorage.getItem(storageKey) || '[]'); return Array.isArray(stored) ? stored : [] } catch { return [] }
  })
  const [sport, setSport] = useState<Sport>('NBA')
  const [filter, setFilter] = useState<'All' | Sport>('All')
  const [player, setPlayer] = useState('')
  const [team, setTeam] = useState('')
  const [category, setCategory] = useState('Points')
  const [current, setCurrent] = useState('0')
  const [pregame, setPregame] = useState('')
  const [live, setLive] = useState('')
  const [elapsed, setElapsed] = useState('24')
  const [playerMinutes, setPlayerMinutes] = useState('')
  const [fouls, setFouls] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify(entries)) } catch { /* storage may be disabled */ } }, [entries])
  const duration = sport === 'NBA' ? 48 : 60
  const toOptional = (v: string) => v.trim() === '' ? null : Number(v)
  const add = (event: React.FormEvent) => {
    event.preventDefault()
    const total = Number(current), played = Number(elapsed), before = toOptional(pregame), now = toOptional(live)
    const minutes = toOptional(playerMinutes), personalFouls = toOptional(fouls)
    if (!player.trim() || !Number.isFinite(total) || total < 0 || !Number.isFinite(played) || played <= 0 || played > duration || [before, now, minutes, personalFouls].some(v => v !== null && (!Number.isFinite(v) || v < 0)) || (minutes !== null && minutes > played) || (personalFouls !== null && (!Number.isInteger(personalFouls) || personalFouls > 6))) {
      setError('Check the player name, stat, game time, and optional lines/minutes. Numbers must be valid and non-negative.')
      return
    }
    setEntries(old => [{ id: String(Date.now()) + Math.random(), player: player.trim(), team: team.trim(), sport, category, current: total, pregame: before, live: now, elapsed: played, playerMinutes: minutes, fouls: personalFouls, note: note.trim(), updatedAt: new Date().toISOString() }, ...old])
    setError('')
    setPlayer(''); setTeam(''); setCurrent('0'); setPregame(''); setLive(''); setPlayerMinutes(''); setFouls(''); setNote('')
  }
  return <div className="halftime-edge">
    <section className="hero"><div className="eyebrow gold">SECOND-HALF RESEARCH WORKSPACE</div><h1>Halftime <span className="gold">Edge.</span></h1><p>Compare player totals with pregame and live lines, track what remains, and explore second-half pace.</p></section>
    <section className="panel ht-panel">
      <div className="ht-heading"><div><span className="eyebrow">TRACKER · NBA + NFL</span><h2>Add a player prop</h2></div><span className="ht-chip">MANUAL DATA</span></div>
      <p className="ht-notice">This tracker does not receive live scores or sportsbook odds automatically. Enter verified stats and lines yourself. Pace is a basic calculation—not a forecast, probability, or betting recommendation.</p>
      <div className="ht-toggle">{(['NBA', 'NFL'] as const).map(item => <button type="button" className={item === sport ? 'active' : ''} key={item} onClick={() => { setSport(item); setCategory(item === 'NBA' ? 'Points' : 'Passing Yards'); setElapsed(item === 'NBA' ? '24' : '30') }}>{item === 'NBA' ? '🏀 NBA' : '🏈 NFL'}</button>)}</div>
      <form onSubmit={add} className="ht-form">
        <label>Player name<input required value={player} onChange={e => setPlayer(e.target.value)} placeholder="Player name" /></label>
        <label>Team<input value={team} onChange={e => setTeam(e.target.value)} placeholder="Optional" /></label>
        <label>Prop category<select value={category} onChange={e => setCategory(e.target.value)}>{(sport === 'NBA' ? nba : nfl).map(s => <option key={s} value={s}>{s}</option>)}</select></label>
        <label>Current stat<input required type="number" min="0" step="any" value={current} onChange={e => setCurrent(e.target.value)} /></label>
        <label>Pregame line<input type="number" min="0" step="any" placeholder="Optional" value={pregame} onChange={e => setPregame(e.target.value)} /></label>
        <label>Live line<input type="number" min="0" step="any" placeholder="Optional" value={live} onChange={e => setLive(e.target.value)} /></label>
        <label>Elapsed game minutes<input required type="number" min="0.1" max={duration} step="any" value={elapsed} onChange={e => setElapsed(e.target.value)} /></label>
        {sport === 'NBA' && <><label>Player minutes played<input type="number" min="0" step="any" placeholder="Optional" value={playerMinutes} onChange={e => setPlayerMinutes(e.target.value)} /></label><label>Fouls<input type="number" min="0" max="6" step="1" placeholder="Optional" value={fouls} onChange={e => setFouls(e.target.value)} /></label></>}
        <label className="ht-note">Injury / matchup notes<input value={note} onChange={e => setNote(e.target.value)} placeholder="Only enter verified information" /></label>
        {error && <p className="ht-error" role="alert">{error}</p>}
        <button type="submit" className="ht-save">+ Add to my halftime board</button>
      </form>
    </section>
    <section className="panel ht-panel">
      <div className="ht-heading"><div><span className="eyebrow">YOUR TRACKED PROPS</span><h2>Halftime Board ({entries.length})</h2></div><select aria-label="Filter sports" value={filter} onChange={e => setFilter(e.target.value as 'All' | Sport)}><option>All</option><option>NBA</option><option>NFL</option></select></div>
      {entries.filter(e => filter === 'All' || e.sport === filter).length === 0 ? <div className="ht-empty">Your board is empty. Add player totals above to start researching. No sample live stats are shown.</div> : <div className="ht-grid">{entries.filter(e => filter === 'All' || e.sport === filter).map(e => {
        const target = e.live ?? e.pregame
        const pace = e.current / e.elapsed * (e.sport === 'NBA' ? 48 : 60)
        const remaining = target === null ? null : Math.max(0, target - e.current)
        return <article className="ht-card" key={e.id}>
          <div className="ht-heading"><div><strong>{e.player}</strong><p>{e.sport} {e.team ? '· ' + e.team : ''} · {e.category}</p></div><button className="ht-remove" type="button" onClick={() => setEntries(old => old.filter(x => x.id !== e.id))}>Remove</button></div>
          <div className="ht-metrics"><div><small>Current</small><strong>{show(e.current)}</strong></div><div><small>Pregame</small><strong>{e.pregame === null ? '—' : show(e.pregame)}</strong></div><div><small>Live line</small><strong>{e.live === null ? '—' : show(e.live)}</strong></div><div><small>Full-game pace*</small><strong>{show(pace)}</strong></div></div>
          <p className="ht-callout">{target === null ? 'Add a line to calculate the remaining total.' : e.current > target ? 'Already above the ' + (e.live !== null ? 'live' : 'pregame') + ' line.' : 'Needs more than ' + show(remaining!) + ' additional ' + e.category.toLowerCase() + ' to finish over the ' + (e.live !== null ? 'live' : 'pregame') + ' line.'}</p>
          <p className="ht-meta">{show(e.elapsed)} / {e.sport === 'NBA' ? '48' : '60'} regulation minutes elapsed{e.playerMinutes !== null ? ' · ' + show(e.playerMinutes) + ' minutes played' : ''}{e.fouls !== null ? ' · ' + e.fouls + ' fouls' : ''}</p>
          {e.note && <p className="ht-meta">Note: {e.note}</p>}<p className="ht-meta">Manually entered: {new Date(e.updatedAt).toLocaleString()}</p>
        </article>
      })}</div>}
      <p className="ht-foot">*Full-game pace is current stat ÷ elapsed game time × regulation game length. Actual playing time, game situation, injuries, and overtime can change outcomes. Re-enter updated stats to track changes; entries are saved in this browser only.</p>
    </section>
  </div>
}
export default HalftimeEdge
