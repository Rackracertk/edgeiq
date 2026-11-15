import { useEffect, useMemo, useState } from 'react'
import { NBA_PROP_CATEGORIES, type NBAPlayerGame } from './analytics/nbaData'
import { NFL_PROP_CATEGORIES } from './analytics/nflBoxscore'
import {
  buildNBAPicks, buildNFLPicks, loadNFLHistory,
  type CheatPick, type CheatSport, type NFLHistoryRow, type Slate,
} from './cheatSheetData'
import { findInjury, shouldExcludeInjury, loadInjuryAwareSlate, easternDate, type InjuryData } from './analytics/injuryCenter'
import { americanOddsBreakEven, enrichElitePicks, type ElitePick } from './analytics/eliteResearch'
import './DailyCheatSheet.css'

type PublishedBoard = Slate & {
  report: InjuryData
  picks: ElitePick[]
  allPicks?: ElitePick[]
  generatedAt: string
  sourceCompleteness: 'COMPLETE' | 'PARTIAL'
  historicalGames: number
}
type DailyPublication = {
  schemaVersion: 1
  generatedAt: string
  publishedDateET: string
  dataStatus: 'OK' | 'PARTIAL'
  boards: Record<'NBA' | 'NFL', PublishedBoard[]>
}
type Props = {
  nbaPlayers: { id: string; name: string; team: string; teamId: string; position?: string }[]
  nbaHistory: Record<string, NBAPlayerGame[]>
  nbaLoading: boolean
  nbaError: string
  onPro: () => void
  onMarkets: () => void
  onInjuries: () => void
  onResearch: (pick: CheatPick) => void
}

const formatTime = (iso: string) => new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
}).format(new Date(iso))

export default function DailyCheatSheet({
  nbaPlayers, nbaHistory, nbaLoading, nbaError, onPro, onMarkets, onInjuries, onResearch,
}: Props) {
  const [sport, setSport] = useState<CheatSport>('NBA')
  const [advance, setAdvance] = useState<'today' | 'tomorrow'>('today')
  const [slates, setSlates] = useState<Record<string, Slate>>({})
  const [publication, setPublication] = useState<DailyPublication | null>(null)
  const [publicationStatus, setPublicationStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [reports, setReports] = useState<Record<string, InjuryData>>({})
  const [nflRows, setNflRows] = useState<NFLHistoryRow[]>([])
  const [nflPartial, setNflPartial] = useState(false)
  const [loadingKey, setLoadingKey] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [category, setCategory] = useState('ALL')
  const [propGroup, setPropGroup] = useState('ALL')
  const [pickMode, setPickMode] = useState<'all' | 'elite'>('all')
  const [direction, setDirection] = useState('ALL')
  const [showAll, setShowAll] = useState(false)
  const [matchupOnly, setMatchupOnly] = useState(false)
  const [manualOdds, setManualOdds] = useState<Record<string, string>>({})
  const [selectedPicks, setSelectedPicks] = useState<CheatPick[]>([])
  const [copyStatus, setCopyStatus] = useState('')

  const key = sport + ':' + advance

  useEffect(() => {
    let cancelled = false
    async function loadPublished() {
      try {
        const response = await fetch('/edgeiq-daily.json?updated=' + Date.now(), { cache: 'no-store' })
        if (!response.ok) throw Error('Published research unavailable')
        const feed = await response.json() as DailyPublication
        if (feed.schemaVersion !== 1 || !feed.boards || !Number.isFinite(Date.parse(feed.generatedAt))) {
          throw Error('Published research was not validated')
        }
        if (!cancelled) { setPublication(feed); setPublicationStatus('ready') }
      } catch {
        if (!cancelled) { setPublication(null); setPublicationStatus('unavailable') }
      }
    }
    void loadPublished()
    const interval = window.setInterval(() => void loadPublished(), 10 * 60 * 1000)
    const onFocus = () => void loadPublished()
    window.addEventListener('focus', onFocus)
    return () => { cancelled = true; window.clearInterval(interval); window.removeEventListener('focus', onFocus) }
  }, [])

  const publishedBoard = useMemo<PublishedBoard | undefined>(() => {
    if (!publication || Date.now() - Date.parse(publication.generatedAt) > 18 * 60 * 60 * 1000) return undefined
    const today = easternDate(new Date()).replaceAll('-', '')
    const boards = publication.boards?.[sport] ?? []
    const eligible = boards.filter(board => board.date >= today && Array.isArray(board.games))
    const board = advance === 'tomorrow'
      ? eligible.find(item => item.date > today)
      : eligible.find(item => item.games.some(game => Date.parse(game.date) > Date.now()))
    if (!board) return undefined
    return { ...board,
      games: board.games.filter(game => Date.parse(game.date) > Date.now()),
      picks: board.picks.filter(pick => Date.parse(pick.gameTime) > Date.now()),
      allPicks: board.allPicks?.filter(pick => Date.parse(pick.gameTime) > Date.now()),
    }
  }, [publication, sport, advance, retry])

  useEffect(() => {
    if (publicationStatus === 'loading' || publishedBoard) return
    let cancelled = false
    const currentKey = sport + ':' + advance
    async function load() {
      setLoadingKey(currentKey)
      setErrors(previous => ({ ...previous, [currentKey]: '' }))
      try {
        const result = await loadInjuryAwareSlate(sport, advance)
        if (cancelled) return
        if (sport === 'NFL' && result.slate.games.length) {
          const history = await loadNFLHistory(result.slate)
          if (!cancelled) { setNflRows(history.rows); setNflPartial(history.partial) }
        }
        if (cancelled) return
        setReports(previous => ({ ...previous, [currentKey]: result.report }))
        setSlates(previous => ({ ...previous, [currentKey]: result.slate }))
      } catch (error) {
        if (!cancelled) setErrors(previous => ({
          ...previous,
          [currentKey]: error instanceof Error ? error.message : 'Unable to load the selected slate.',
        }))
      } finally {
        if (!cancelled) setLoadingKey(current => current === currentKey ? null : current)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [sport, advance, retry, publicationStatus, publishedBoard])
  useEffect(() => {
    const interval = window.setInterval(() => setRetry(value => value + 1), 10 * 60 * 1000)
    const onFocus = () => setRetry(value => value + 1)
    window.addEventListener('focus', onFocus)
    return () => { window.clearInterval(interval); window.removeEventListener('focus', onFocus) }
  }, [])

  const slate = publishedBoard ?? slates[key]
  const report = publishedBoard?.report ?? reports[key]
  const reportAvailable = report?.available === true
  const excluded = (playerId: string, player: string, team: string, teamId: string) =>
    shouldExcludeInjury(findInjury(report?.injuries ?? [], playerId, player, team, teamId))
  const picks = useMemo(() => {
    if (!slate?.games.length) return []
    if (publishedBoard) return pickMode === 'all' ? (publishedBoard.allPicks ?? publishedBoard.picks) : publishedBoard.picks
    const unavailable = (id: string, name: string, team: string, teamId: string) =>
      shouldExcludeInjury(findInjury(report?.injuries ?? [], id, name, team, teamId))
    const mode = pickMode === 'all' ? 'all' : 'elite'
    const candidates = sport === 'NBA'
      ? buildNBAPicks(slate, nbaHistory, nbaPlayers, reportAvailable ? unavailable : undefined, mode)
      : buildNFLPicks(slate, nflRows, reportAvailable ? unavailable : undefined, mode)
    return enrichElitePicks(candidates, sport, slate, nbaHistory, nflRows, nbaPlayers,
      mode === 'all' ? 200 : 80)
  }, [slate, sport, nbaHistory, nbaPlayers, nflRows, report?.checkedAt, reportAvailable, publishedBoard, pickMode])
  useEffect(() => {
    if (!reportAvailable) return
    setSelectedPicks(current => current.filter(pick => Date.parse(pick.gameTime) > Date.now() &&
      !excluded(pick.playerId, pick.player, pick.team,
        slate?.games.find(game => game.teams.some(team => team.abbreviation === pick.team))
          ?.teams.find(team => team.abbreviation === pick.team)?.id ?? '')))
  }, [report?.checkedAt, reportAvailable])
  const excludedCount = reportAvailable && slate
    ? report!.injuries.filter(row => shouldExcludeInjury(row) &&
        slate.games.some(game => game.teams.some(team => team.abbreviation === row.team || team.id === row.teamId))).length
    : 0
  const categories = sport === 'NBA' ? NBA_PROP_CATEGORIES : NFL_PROP_CATEGORIES
  const groups = sport === 'NBA' ? [
    {id:'ALL',label:'All NBA props',stats:[]},
    {id:'CORE',label:'Points · rebounds · assists',stats:['Points','Rebounds','Assists']},
    {id:'COMBO',label:'PRA · PA · PR · AR',stats:['PRA','Points + Assists (PA)','Points + Rebounds (PR)','Assists + Rebounds (AR)']},
    {id:'3PT',label:'3-pointers',stats:['3-Pointers Made']},
    {id:'DEFENSE',label:'Steals · blocks',stats:['Steals','Blocks','Steals + Blocks (SB)']},
    {id:'MILESTONES',label:'Double / triple double',stats:['Double-Double','Triple-Double']},
  ] : [
    {id:'ALL',label:'All NFL props',stats:[]},
    {id:'PASS',label:'Passing',stats:['Passing Yards','Passing Completions','Passing Attempts','Passing TDs','Interceptions Thrown']},
    {id:'RUSH',label:'Rushing',stats:['Rushing Yards','Rushing Attempts','Rushing TDs','Longest Rush']},
    {id:'RECEIVE',label:'Receiving',stats:['Receiving Yards','Receptions','Receiving Targets','Receiving TDs','Longest Reception']},
    {id:'DEFENSE',label:'Defense',stats:['Sacks','Tackles','Solo Tackles']},
  ]
  const currentGroup = groups.find(group => group.id === propGroup)
  const filtered = picks.filter(pick =>
    (propGroup === 'ALL' || currentGroup?.stats.includes(pick.category)) &&
    (category === 'ALL' || pick.category === category) &&
    (direction === 'ALL' || pick.direction === direction) &&
    (!matchupOnly || pick.defense !== null)
  )
  const visible = showAll ? filtered : filtered.slice(0, 12)
  const selected = selectedPicks
  const isBusy = publicationStatus === 'loading' || (!publishedBoard && (loadingKey === key || (sport === 'NBA' && nbaLoading)))
  const displayError = publishedBoard ? '' : errors[key] || (sport === 'NBA' ? nbaError : '')
  const noGames = !!slate && slate.games.length === 0

  function switchSport(value: CheatSport) {
    setSport(value)
    setCategory('ALL')
    setPropGroup('ALL')
    setDirection('ALL')
    setShowAll(false)
    setMatchupOnly(false)
    setCopyStatus('')
  }
  function togglePick(pick: CheatPick) {
    setSelectedPicks(current => current.some(item => item.id === pick.id)
      ? current.filter(item => item.id !== pick.id) : [...current, pick])
  }
  function pickText(pick: CheatPick): string {
    return pick.sport + ' · ' + pick.player + ' (' + pick.team + ' vs ' + pick.opponent + ') · ' +
      (['Double-Double', 'Triple-Double'].includes(pick.category) ? (pick.direction === 'over' ? 'Yes' : 'No') : (pick.direction === 'over' ? 'Over ' : 'Under ') + pick.line) + ' ' + pick.category +
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
      <h1>{advance === 'tomorrow' ? "Tomorrow's" : "Today's"} <span className="gold">NBA + NFL prop cheat sheet.</span></h1>
      <p>Points, rebounds, assists, PRA, PA, PR, AR, threes, and ESPN-supported NFL passing, rushing, receiving and defensive props — both overs and unders, organized by market. Switch between broad historical research and elite 90%+ recent trends. Opponent and injury evidence appears wherever verified.</p>
      <div className="cheat-hero-points">
        <span>✓ All supported stat categories</span><span>✓ Over &amp; under research</span><span>✓ Opponent matchup evidence</span>
      </div>
    </section>

    <section className="cheat-toolbar" aria-label="Cheat sheet filters">
      <div className="cheat-tabs" role="group" aria-label="Choose sport">
        <button className={sport === 'NBA' ? 'cheat-tab on' : 'cheat-tab'} onClick={() => switchSport('NBA')} aria-pressed={sport === 'NBA'}>🏀 NBA</button>
        <button className={sport === 'NFL' ? 'cheat-tab on' : 'cheat-tab'} onClick={() => switchSport('NFL')} aria-pressed={sport === 'NFL'}>🏈 NFL</button>
      </div>
      <div className="cheat-tabs" role="group" aria-label="Slate timing">
        <button className={advance === 'today' ? 'cheat-tab on' : 'cheat-tab'} aria-pressed={advance === 'today'} onClick={() => setAdvance('today')}>Today</button>
        <button className={advance === 'tomorrow' ? 'cheat-tab on' : 'cheat-tab'} aria-pressed={advance === 'tomorrow'} onClick={() => setAdvance('tomorrow')}>Tomorrow / Next</button>
      </div>
      <div className="cheat-toolbar-label">
        <strong>{slate ? (slate.isToday ? 'TODAY · ' : 'NEXT AVAILABLE SLATE · ') + slate.label : 'Finding the next slate'}</strong>
        <span>{slate ? slate.games.length + ' scheduled games · ' + slate.source : 'Checking the live schedule'} · Eastern Time</span>
      </div>
    </section>

    <section className="panel" style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'space-between', padding: 18, flexWrap: 'wrap', marginBottom: 16 }}>
      <div><span className="eyebrow gold">NEW · GAME MARKETS</span><h3 style={{ margin: '6px 0 0' }}>NBA & NFL moneylines, spreads, totals and win chances</h3></div>
      <button className="cta" onClick={onMarkets}>Explore game lines ↗</button>
    </section>
    <section className={publishedBoard ? 'cheat-publish-live' : 'cheat-publish-fallback'} role="status">
      <strong>{publishedBoard ? '✓ Published automatically — unattended daily research' :
        publicationStatus === 'loading' ? 'Checking automated research publication…' :
        'Automatic research unavailable — browser fallback in use'}</strong>
      <span>{publishedBoard ? 'Updated ' + new Date(publishedBoard.generatedAt).toLocaleString('en-US', {
        timeZone: 'America/New_York', month:'short', day:'numeric',hour:'numeric',minute:'2-digit',
      }) + ' ET · ' + publishedBoard.historicalGames + ' completed games in source history' +
        (publishedBoard.sourceCompleteness === 'PARTIAL' ? ' · Partial source coverage' : '') :
        'This browser will try recent completed game logs. Automatic publishing may be delayed or unverified.'}</span>
    </section>
    <div className="cheat-info" role="note">
      <strong>All Props includes 60%+ observed historical trends; Elite 90%+ only shows 90–100% recent historical results. Neither is a future win probability.</strong> Lines are research thresholds, not verified sportsbook offerings. The Research Score ranks available evidence, not expected profit or a calibrated forecast. Position allowances require enough completed matchup data; missing data is explicitly marked. Injury screening only applies when its source is reachable.
    </div>

    {report && <section className={reportAvailable ? 'cheat-injury-ok' : 'cheat-injury-unavailable'} role="status">
      <div><strong>{reportAvailable ? 'Availability screening active' : 'Injury screening unavailable'}</strong>
        <p>{reportAvailable ? excludedCount + ' unavailable / uncertain athletes excluded for this slate. Remaining eligible candidates automatically move up the rankings.' : 'The injury source could not be verified. The board shows historical research only. Injury status is NOT screened; do not treat these trends as cleared picks.'}</p>
        <small>{reportAvailable ? 'Checked ' + new Date(report.checkedAt).toLocaleString() + ' · ' + report.source : (report.error ?? 'Source unavailable')}</small>
      </div>
      <button className="market-refresh" onClick={onInjuries}>Open Injury Center ↗</button>
    </section>}
    {displayError && <p className="error" role="alert">{displayError}</p>}
    {nflPartial && sport === 'NFL' && <p className="error" role="status">Some NFL box scores could not be fetched. Trends only use the games that were successfully verified; treat the list as incomplete.</p>}

    <div className="cheat-stats">
      <div><span>GAME SLATE</span><strong>{slate ? slate.games.length : '—'}</strong><small>{slate?.isToday ? 'Today (ET)' : 'Next games (ET)'}</small></div>
      <div><span>{pickMode === 'elite' ? 'ELITE TRENDS' : 'PROP RESEARCH CARDS'}</span><strong>{isBusy ? '…' : picks.length}</strong><small>{pickMode === 'elite' ? '90%+ past hit rate' : '60%+ past hit rate · not forecasts'}</small></div>
      <div><span>MY SHORTLIST</span><strong>{selected.length}</strong><small>Choose any research cards</small></div>
    </div>

    <div className="cheat-section-title">
      <div><span className="eyebrow">FREE BETA · COMPLETE NBA &amp; NFL PROPS</span><h2>{pickMode === 'elite' ? 'Elite 90%+ historical trends' : 'All available over/under prop research'}</h2></div>
      <span className="small-tag">{sport} · {slate?.label ?? 'CHECKING'}</span>
    </div>

    <div className="cheat-mode-switch" role="group" aria-label="Historical hit rate tier">
      <button className={pickMode === 'all' ? 'cheat-tab on' : 'cheat-tab'} aria-pressed={pickMode === 'all'}
        onClick={() => {setPickMode('all');setShowAll(false)}}>All Props · 60%+ history</button>
      <button className={pickMode === 'elite' ? 'cheat-tab on' : 'cheat-tab'} aria-pressed={pickMode === 'elite'}
        onClick={() => {setPickMode('elite');setShowAll(false)}}>Elite 90%+ history</button>
      <span className="cheat-mode-note">Historical records only — not predicted win rates, picks, or verified sportsbook odds.</span>
    </div>
    <div className="cheat-prop-groups" role="group" aria-label="Prop market groups">
      {groups.map(group => <button key={group.id} className={propGroup === group.id ? 'cheat-group-btn active' : 'cheat-group-btn'}
        onClick={() => {setPropGroup(group.id);setCategory('ALL');setShowAll(false)}}
        aria-pressed={propGroup === group.id}>{group.label}</button>)}
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
      <label className="cheat-matchup-toggle"><input type="checkbox" checked={matchupOnly} onChange={event => { setMatchupOnly(event.target.checked); setShowAll(false) }} /> Verified position samples only</label>
      <div className="cheat-count">{filtered.length} matching {pickMode === 'elite' ? 'elite trends' : 'research cards'}</div>
    </div>

    {isBusy ? <section className="panel cheat-empty" role="status">
      <h3>Building the {sport} board…</h3>
      <p>{sport === 'NFL' ? 'Checking regular-season game logs for teams on the upcoming slate. Initial NFL loading can take longer.' : 'Checking the schedule and loading completed NBA game logs.'}</p>
    </section> : noGames ? <section className="panel cheat-empty">
      <h3>No upcoming {sport} games found</h3>
      <p>We won't manufacture picks for games that aren't scheduled or haven't been verified. Check back closer to the next slate.</p>
    </section> : !slate ? <section className="panel cheat-empty">
      <h3>Schedule unavailable</h3><p>Refresh the page when the sports feed is available. No fictional matchups or picks are shown.</p>
      <button className="cta" onClick={() => { setErrors(previous => ({ ...previous, [key]: '' })); setRetry(previous => previous + 1) }}>Try again</button>
    </section> : filtered.length === 0 ? <section className="panel cheat-empty">
      <h3>No qualifying trends for this slate</h3>
      <p>{picks.length ? 'No qualifying observations match these filters. Try another stat, the opposite side, or turn off position-only filtering.' : pickMode === 'elite'
        ? 'No 90%+ historical trends passed the screening for this slate. Try All Props for additional research without elite labeling.'
        : 'No eligible over/under trends with sufficient verified history for this slate. We do not invent missing player lines or games.'}</p>
      {(picks.length > 0 || pickMode === 'elite') && <button className="nav" onClick={() => { setCategory('ALL'); setPropGroup('ALL'); setDirection('ALL'); setMatchupOnly(false);setPickMode('all') }}>Show all research</button>}
    </section> : <>
      <div className="cheat-grid">
        {visible.map((pick, index) => {
          const active = selected.some(item => item.id === pick.id)
          return <article className={active ? 'cheat-card selected' : 'cheat-card'} key={pick.id}>
            <div className="cheat-card-top"><span>#{index + 1} · {pick.sport} · {pick.recentHits / pick.recentGames >= .9 ? 'ELITE 90%+' : 'RESEARCH 60–89%'} · {pick.researchGrade}</span><span>{formatTime(pick.gameTime)}</span></div>
            <div className="cheat-player"><h3>{pick.player}</h3><span>{pick.matchup} · {pick.position !== 'UNKNOWN' ? pick.position : 'Position unverified'}</span></div>
            <div className="cheat-prop"><span>{['Double-Double', 'Triple-Double'].includes(pick.category) ? (pick.direction === 'over' ? 'YES' : 'NO') : pick.direction.toUpperCase() + ' ' + pick.line}</span><strong>{pick.category}</strong></div>
            <div className="cheat-elite-header">
              <span>OBSERVED HIT RATE · LAST {pick.recentGames}</span>
              <strong>{Math.round(100 * pick.recentHits / pick.recentGames)}%</strong>
              <small>{pick.recentHits}/{pick.recentGames} games · not a probability forecast</small>
            </div>
            <div className="cheat-rates">
              <div><small>LAST 5</small><strong>{pick.l5Hits}/{pick.l5Games}</strong></div>
              <div><small>LAST {pick.recentGames}</small><strong>{pick.recentHits}/{pick.recentGames}</strong></div>
              <div><small>L20</small><strong>{pick.last20 ? pick.last20.hits + '/' + pick.last20.games : 'N/A'}</strong></div>
            </div>
            <div className="cheat-defense">
              <div><strong>OPPONENT VS {pick.position === 'UNKNOWN' ? 'POSITION' : pick.position}</strong><span>{pick.opponent}</span></div>
              {pick.defense ? <p>
                <b>{pick.defense.hits}/{pick.defense.games} ({pick.defense.percentage}%)</b> matching-position player appearances crossed this same reference line in <b>{pick.defense.distinctGames} games</b>.
                <small>Opponent allowed {pick.defense.averageAllowed} {pick.category} per qualifying appearance</small>
              </p> : <p>Not enough verified position-matched, completed-game samples. No opponent hit rate is claimed.</p>}
            </div>
            <div className="cheat-evidence">
              <span>H2H: <b>{pick.headToHead ? pick.headToHead.hits + '/' + pick.headToHead.games : 'Insufficient games'}</b></span>
              <span>RESEARCH SCORE: <b>{pick.researchScore}/100</b></span>
            </div>
            <p className="cheat-reason">{pick.context} {pick.researchGrade === 'TREND ONLY' ? 'Opponent-position corroboration is not yet available.' : 'Opponent-position evidence is calculated from completed opposing-player appearances.'}</p>
            <details className="cheat-deep-research">
              <summary>View deep research &amp; market check</summary>
              <p><b>Average:</b> {pick.average} {pick.category} over {pick.recentGames} qualifying player games. <b>Volatility:</b> {pick.volatility === null ? 'N/A' : pick.volatility.toFixed(1)} standard deviation, where lower means more consistent results.</p>
              <p><b>Head-to-head:</b> {pick.headToHead ? pick.headToHead.hits + ' hits in ' + pick.headToHead.games + ' completed games against ' + pick.opponent : 'Not enough completed games against this opponent.'}</p>
              <p><b>Position allowance:</b> {pick.defense ? pick.defense.hits + ' of ' + pick.defense.games + ' qualifying player appearances, in ' + pick.defense.distinctGames + ' separate games, crossed the line. Counts are player appearances, not whole-team game totals.' : 'Insufficient position/minutes data; matchup effect unverified.'}</p>
              <label className="cheat-odds-input">Enter available American odds for this exact market
                <input inputMode="numeric" type="number" placeholder="Example: -110" value={manualOdds[pick.id] ?? ''} onChange={event => setManualOdds(current => ({ ...current, [pick.id]: event.target.value }))} />
              </label>
              <p>{manualOdds[pick.id] && americanOddsBreakEven(Number(manualOdds[pick.id])) !== null
                ? 'Break-even rate at those odds: ' + americanOddsBreakEven(Number(manualOdds[pick.id])) + '%. This is NOT a calculated edge; past hit rates are not calibrated win probabilities.'
                : 'Enter offered odds to see their break-even rate. Live market prices are not connected.'}</p>
              <small>Sources: completed ESPN game summaries and schedule where available. The reference line must match an actual available market before comparing. Injury availability may be incomplete.</small>
            </details>
            <div className="cheat-actions">
              <button className={active ? 'cheat-save added' : 'cheat-save'} aria-pressed={active} onClick={() => togglePick(pick)}>{active ? '✓ Added to shortlist' : '+ Add to my shortlist'}</button>
              <button className="cheat-research" onClick={() => onResearch(pick)}>Research ↗</button>
            </div>
          </article>
        })}
      </div>
      {!showAll && filtered.length > 12 && <button className="cheat-more" onClick={() => setShowAll(true)}>Show all {filtered.length} trends ↓</button>}
    </>}

    {selected.length > 0 && <section className="panel cheat-shortlist">
      <div className="panel-title"><div><span className="eyebrow gold">YOUR RESEARCH LIST</span><h3>My shortlist · {selected.length} props</h3></div><span className="small-tag">NOT A BET SLIP</span></div>
      <div className="cheat-shortlist-items">{selected.map(pick => <div key={pick.id}><span>{pick.player} · {['Double-Double', 'Triple-Double'].includes(pick.category) ? (pick.direction === 'over' ? 'Yes' : 'No') : pick.direction + ' ' + pick.line} {pick.category}</span><button onClick={() => togglePick(pick)} aria-label={'Remove ' + pick.player}>Remove</button></div>)}</div>
      <div className="cheat-shortlist-actions">
        <button className="cta" onClick={() => void copyShortlist()}>Copy my shortlist</button>
        <button className="nav" onClick={() => { setSelectedPicks([]); setCopyStatus('') }}>Clear list</button>
        {copyStatus && <span role="status">{copyStatus}</span>}
      </div>
    </section>}

    <section className="cheat-pro">
      <div><span className="eyebrow gold">COMING TO EDGEIQ PRO</span><h2>Like the free board? Go deeper.</h2>
        <p>During beta, all research cards and matchup evidence remain free. Later, EDGEIQ Pro can add licensed live sportsbook prices, independently validated projections, advanced filters, and alerting behind secure subscriptions. Billing remains off until those features are ready.</p></div>
      <button className="cta" onClick={onPro}>See Pro plans & free interest list ↗</button>
    </section>
    <p className="footnote cheat-footnote">Independent statistical research for adults where applicable. All Props includes trends from 60% and Elite 90%+ has higher historical frequency; neither is a predictive model. ESPN public game summaries and scoreboards are unofficial data inputs, may be delayed or incomplete, and are not licensed sportsbook odds or injury reports. A 90–100% historical hit rate is not a 90–100% estimated probability of a future result. Scores rank evidence only; no odds-based value claim is made. Confirm all lines, teams and active status independently.</p>
  </div>
}
