import { useEffect, useMemo, useState } from 'react'
import type { NBAPlayerGame } from './analytics/nbaData'
import {
  buildNBAPicks, buildNFLPicks, loadDailySlate, loadNFLHistory,
  type CheatPick, type CheatSport, type NFLHistoryRow, type Slate,
} from './cheatSheetData'
import './DailyCheatSheet.css'

type Props = {
  nbaPlayers: { id: string; name: string; team: string; teamId: string }[]
  nbaHistory: Record<string, NBAPlayerGame[]>
  nbaLoading: boolean
  nbaError: string
  onPro: () => void
  onResearch: (pick: CheatPick) => void
}

const formatTime = (iso: string) => new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
}).format(new Date(iso))

export default function DailyCheatSheet({
  nbaPlayers, nbaHistory, nbaLoading, nbaError, onPro, onResearch,
}: Props) {
  const [sport, setSport] = useState<CheatSport>('NBA')
  const [slates, setSlates] = useState<Partial<Record<CheatSport, Slate>>>({})
  const [nflRows, setNflRows] = useState<NFLHistoryRow[]>([])
  const [nflPartial, setNflPartial] = useState(false)
  const [loadingSport, setLoadingSport] = useState<CheatSport | null>(null)
  const [errors, setErrors] = useState<Partial<Record<CheatSport, string>>>({})
  const [category, setCategory] = useState('ALL')
  const [direction, setDirection] = useState('ALL')
  const [showAll, setShowAll] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [copyStatus, setCopyStatus] = useState('')

  useEffect(() => {
    let cancelled = false
    if (slates[sport] || loadingSport === sport) return
    const currentSport = sport
    async function load() {
      setLoadingSport(currentSport)
      setErrors(previous => ({ ...previous, [currentSport]: '' }))
      try {
        const slate = await loadDailySlate(currentSport)
        if (cancelled) return
        setSlates(previous => ({ ...previous, [currentSport]: slate }))
        if (currentSport === 'NFL' && slate.games.length) {
          const result = await loadNFLHistory(slate)
          if (!cancelled) {
            setNflRows(result.rows)
            setNflPartial(result.partial)
          }
        }
      } catch (error) {
        if (!cancelled) setErrors(previous => ({
          ...previous,
          [currentSport]: error instanceof Error ? error.message : 'Unable to verify the schedule.',
        }))
      } finally {
        if (!cancelled) setLoadingSport(previous => previous === currentSport ? null : previous)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [sport, slates, loadingSport])

  const slate = slates[sport]
  const picks = useMemo(() => {
    if (!slate?.games.length) return []
    if (sport === 'NBA') return buildNBAPicks(slate, nbaHistory, nbaPlayers)
    return buildNFLPicks(slate, nflRows)
  }, [slate, sport, nbaHistory, nbaPlayers, nflRows])
  const categories = useMemo(() => Array.from(new Set(picks.map(pick => pick.category))).sort(), [picks])
  const filtered = picks.filter(pick =>
    (category === 'ALL' || pick.category === category) &&
    (direction === 'ALL' || pick.direction === direction)
  )
  const visible = showAll ? filtered : filtered.slice(0, 12)
  const selected = picks.filter(pick => selectedIds.includes(pick.id))
  const isBusy = loadingSport === sport || (sport === 'NBA' && nbaLoading)
  const displayError = errors[sport] || (sport === 'NBA' ? nbaError : '')
  const noGames = !!slate && slate.games.length === 0

  function switchSport(value: CheatSport) {
    setSport(value)
    setCategory('ALL')
    setDirection('ALL')
    setShowAll(false)
    setCopyStatus('')
  }
  function togglePick(id: string) {
    setSelectedIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id])
  }
  function pickText(pick: CheatPick): string {
    return pick.sport + ' · ' + pick.player + ' (' + pick.team + ' vs ' + pick.opponent + ') · ' +
      (pick.direction === 'over' ? 'Over ' : 'Under ') + pick.line + ' ' + pick.category +
      ' · L5 ' + pick.l5Hits + '/' + pick.l5Games +
      ' · Last ' + pick.recentGames + ' ' + pick.recentHits + '/' + pick.recentGames
  }
  async function copyShortlist() {
    try {
      await navigator.clipboard.writeText('EDGEIQ research shortlist — reference thresholds, NOT verified sportsbook lines\n' +
        selected.map(pickText).join('\n') +
        '\nReview current market lines, injuries and availability before acting. No guaranteed results.')
      setCopyStatus('Shortlist copied')
    } catch { setCopyStatus('Copy unavailable in this browser') }
  }

  return <div className="cheatsheet">
    <section className="hero cheat-hero">
      <div className="eyebrow gold">EDGEIQ / DAILY PLAYER PROP RESEARCH</div>
      <h1>Today's <span className="gold">cheat sheet.</span></h1>
      <p>Find the strongest recent statistical trends on upcoming NBA and NFL slates. Pick the ones you like, build your own shortlist, and inspect the numbers before making a decision.</p>
      <div className="cheat-hero-points">
        <span>✓ Completed-game history</span><span>✓ Real upcoming matchups</span><span>✓ Build a personal shortlist</span>
      </div>
    </section>

    <section className="cheat-toolbar" aria-label="Cheat sheet filters">
      <div className="cheat-tabs" role="group" aria-label="Choose sport">
        <button className={sport === 'NBA' ? 'cheat-tab on' : 'cheat-tab'} onClick={() => switchSport('NBA')} aria-pressed={sport === 'NBA'}>🏀 NBA</button>
        <button className={sport === 'NFL' ? 'cheat-tab on' : 'cheat-tab'} onClick={() => switchSport('NFL')} aria-pressed={sport === 'NFL'}>🏈 NFL</button>
      </div>
      <div className="cheat-toolbar-label">
        <strong>{slate ? (slate.isToday ? 'TODAY · ' : 'NEXT SLATE · ') + slate.label : 'Finding the next slate'}</strong>
        <span>{slate ? slate.games.length + ' scheduled games · ' + slate.source : 'Checking the live schedule'} · Eastern Time</span>
      </div>
    </section>

    <div className="cheat-info" role="note">
      <strong>How to read this board:</strong> Lines shown here are <strong>historical research thresholds</strong>, NOT live bookmaker offers. Picks are ranked by past L5 and recent hit frequency, not win probabilities. Player availability, injuries, odds and lineup changes are <strong>not verified</strong>.
    </div>

    {displayError && <p className="error" role="alert">{displayError}</p>}
    {nflPartial && sport === 'NFL' && <p className="error" role="status">Some NFL box scores could not be fetched. Trends only use the games that were successfully verified; treat the list as incomplete.</p>}

    <div className="cheat-stats">
      <div><span>GAME SLATE</span><strong>{slate ? slate.games.length : '—'}</strong><small>{slate?.isToday ? 'Today (ET)' : 'Next games (ET)'}</small></div>
      <div><span>TREND CANDIDATES</span><strong>{isBusy ? '…' : picks.length}</strong><small>Meeting the history rules</small></div>
      <div><span>MY SHORTLIST</span><strong>{selected.length}</strong><small>Choose any research cards</small></div>
    </div>

    <div className="cheat-section-title">
      <div><span className="eyebrow">FREE · DAILY RESEARCH BOARD</span><h2>Top historical prop trends</h2></div>
      <span className="small-tag">{sport} · {slate?.label ?? 'CHECKING'}</span>
    </div>

    <div className="cheat-controls">
      <label>STAT TYPE
        <select value={category} onChange={event => { setCategory(event.target.value); setShowAll(false) }}>
          <option value="ALL">All stat categories</option>
          {categories.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label>DIRECTION
        <select value={direction} onChange={event => { setDirection(event.target.value); setShowAll(false) }}>
          <option value="ALL">Over & under</option><option value="over">Overs only</option><option value="under">Unders only</option>
        </select>
      </label>
      <div className="cheat-count">{filtered.length} matching trends</div>
    </div>

    {isBusy ? <section className="panel cheat-empty" role="status">
      <h3>Building the {sport} board…</h3>
      <p>{sport === 'NFL' ? 'Checking regular-season game logs for teams on the upcoming slate. Initial NFL loading can take longer.' : 'Checking the schedule and loading completed NBA game logs.'}</p>
    </section> : noGames ? <section className="panel cheat-empty">
      <h3>No upcoming {sport} games found</h3>
      <p>We won't manufacture picks for games that aren't scheduled or haven't been verified. Check back closer to the next slate.</p>
    </section> : !slate ? <section className="panel cheat-empty">
      <h3>Schedule unavailable</h3><p>Refresh the page when the sports feed is available. No fictional matchups or picks are shown.</p>
      <button className="cta" onClick={() => { setErrors(previous => ({ ...previous, [sport]: '' })); setSlates(previous => ({ ...previous, [sport]: undefined })) }}>Try again</button>
    </section> : filtered.length === 0 ? <section className="panel cheat-empty">
      <h3>No qualifying trends for this slate</h3>
      <p>{picks.length ? 'Try another stat type or direction.' : 'The available completed-game data does not meet our recent-history criteria. This is not a slate of guaranteed or automatic picks.'}</p>
      {picks.length > 0 && <button className="nav" onClick={() => { setCategory('ALL'); setDirection('ALL') }}>Reset filters</button>}
    </section> : <>
      <div className="cheat-grid">
        {visible.map((pick, index) => {
          const active = selectedIds.includes(pick.id)
          return <article className={active ? 'cheat-card selected' : 'cheat-card'} key={pick.id}>
            <div className="cheat-card-top"><span>#{index + 1} · {pick.sport} TREND</span><span>{formatTime(pick.gameTime)}</span></div>
            <div className="cheat-player"><h3>{pick.player}</h3><span>{pick.matchup}</span></div>
            <div className="cheat-prop"><span>{pick.direction.toUpperCase()} {pick.line}</span><strong>{pick.category}</strong></div>
            <div className="cheat-rates">
              <div><small>LAST 5</small><strong>{pick.l5Hits}/{pick.l5Games}</strong></div>
              <div><small>LAST {pick.recentGames}</small><strong>{pick.recentHits}/{pick.recentGames}</strong></div>
              <div><small>RECENT AVG</small><strong>{pick.average}</strong></div>
            </div>
            <p className="cheat-reason">{pick.context}</p>
            <div className="cheat-actions">
              <button className={active ? 'cheat-save added' : 'cheat-save'} aria-pressed={active} onClick={() => togglePick(pick.id)}>{active ? '✓ Added to shortlist' : '+ Add to my shortlist'}</button>
              <button className="cheat-research" onClick={() => onResearch(pick)}>Research ↗</button>
            </div>
          </article>
        })}
      </div>
      {!showAll && filtered.length > 12 && <button className="cheat-more" onClick={() => setShowAll(true)}>Show all {filtered.length} trends ↓</button>}
    </>}

    {selected.length > 0 && <section className="panel cheat-shortlist">
      <div className="panel-title"><div><span className="eyebrow gold">YOUR RESEARCH LIST</span><h3>My shortlist · {selected.length} props</h3></div><span className="small-tag">NOT A BET SLIP</span></div>
      <div className="cheat-shortlist-items">{selected.map(pick => <div key={pick.id}><span>{pick.player} · {pick.direction} {pick.line} {pick.category}</span><button onClick={() => togglePick(pick.id)} aria-label={'Remove ' + pick.player}>Remove</button></div>)}</div>
      <div className="cheat-shortlist-actions">
        <button className="cta" onClick={() => void copyShortlist()}>Copy my shortlist</button>
        <button className="nav" onClick={() => { setSelectedIds([]); setCopyStatus('') }}>Clear list</button>
        {copyStatus && <span role="status">{copyStatus}</span>}
      </div>
    </section>}

    <section className="cheat-pro">
      <div><span className="eyebrow gold">COMING TO EDGEIQ PRO</span><h2>Like the free board? Go deeper.</h2>
        <p>Help shape premium features such as verified market-line comparisons, defensive matchup insights and research alerts. Premium tools and billing are not live yet.</p></div>
      <button className="cta" onClick={onPro}>See Pro plans & free interest list ↗</button>
    </section>
    <p className="footnote cheat-footnote">Independent statistical research for adults where applicable. ESPN public game summaries and scoreboards are unofficial data inputs, may be delayed or incomplete, and are not licensed sportsbook odds or injury reports. A historical hit rate is not an estimated probability of a future result. Confirm all lines, teams and active status independently.</p>
  </div>
}
