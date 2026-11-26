import { useEffect, useState } from 'react'
import { loadGameMarkets, type GameMarkets, type MarketsSlate } from './analytics/gameMarkets'
import type { CheatSport } from './cheatSheetData'
import './GameLines.css'

function american(value: number | null): string {
  if (value === null) return '—'
  return value > 0 ? '+' + value : String(value)
}
function spread(value: number | null): string {
  if (value === null) return '—'
  return value > 0 ? '+' + value : String(value)
}
function formattedTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short', month: 'short',
    day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).format(new Date(iso))
}
function MarketCard({ game }: { game: GameMarkets }) {
  const probReady = game.homeProbability !== null && game.awayProbability !== null
  return <article className="market-card">
    <header className="market-card-head">
      <span className="market-kicker">{game.sport} · GAME MARKETS</span>
      <span className="market-time">{formattedTime(game.date)}</span>
    </header>
    <div className="market-matchup">
      <div><span>AWAY</span><h3>{game.away.abbreviation || game.away.name}</h3><p>{game.away.name}</p></div>
      <span className="market-at">@</span>
      <div><span>HOME</span><h3>{game.home.abbreviation || game.home.name}</h3><p>{game.home.name}</p></div>
    </div>

    <div className="market-prob">
      <div className="market-heading"><strong>Win probability</strong><span>Market-implied · bookmaker margin removed</span></div>
      {probReady ? <>
        <div className="market-prob-labels">
          <strong>{game.away.abbreviation} {game.awayProbability?.toFixed(1)}%</strong>
          <strong>{game.home.abbreviation} {game.homeProbability?.toFixed(1)}%</strong>
        </div>
        <div className="market-prob-bar" role="img" aria-label={game.away.name + ' ' + game.awayProbability + ' percent; ' + game.home.name + ' ' + game.homeProbability + ' percent'}>
          <span style={{ width: game.awayProbability + '%' }}/><span style={{ width: game.homeProbability + '%' }}/>
        </div>
      </> : <p className="market-unavailable">Unavailable — both moneylines are required to calculate market-implied percentages.</p>}
    </div>

    <div className="market-grid">
      <div className="market-stat">
        <span className="market-stat-title">MONEYLINE</span>
        <div className="market-side"><span>{game.away.abbreviation}</span><strong>{american(game.awayMoneyline)}</strong></div>
        <div className="market-side"><span>{game.home.abbreviation}</span><strong>{american(game.homeMoneyline)}</strong></div>
      </div>
      <div className="market-stat">
        <span className="market-stat-title">POINT SPREAD</span>
        <div className="market-side"><span>{game.away.abbreviation}</span><strong>{spread(game.awaySpread)} <small>{game.awaySpread === null ? '' : american(game.awaySpreadOdds)}</small></strong></div>
        <div className="market-side"><span>{game.home.abbreviation}</span><strong>{spread(game.homeSpread)} <small>{game.homeSpread === null ? '' : american(game.homeSpreadOdds)}</small></strong></div>
        {game.homeSpread === null && game.spreadDescription && <p className="market-spread-note">Source reports: {game.spreadDescription}</p>}
      </div>
      <div className="market-stat">
        <span className="market-stat-title">TOTAL GAME POINTS (O/U)</span>
        <div className="market-side"><span>Over</span><strong>{game.total ?? '—'} <small>{game.total === null ? '' : american(game.overOdds)}</small></strong></div>
        <div className="market-side"><span>Under</span><strong>{game.total ?? '—'} <small>{game.total === null ? '' : american(game.underOdds)}</small></strong></div>
      </div>
    </div>
    <footer className="market-card-foot">
      <span>{game.hasMarkets ? 'Reported by ' + (game.provider ?? 'an unidentified provider') : 'Markets unavailable from source'}</span>
      <span>Pregame reference only · confirm current prices</span>
    </footer>
  </article>
}

export default function GameLines({ onPro }: { onPro: () => void }) {
  const [sport, setSport] = useState<CheatSport>('NBA')
  const [slate, setSlate] = useState<MarketsSlate | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [withMarkets, setWithMarkets] = useState(false)

  useEffect(() => {
    let cancelled = false
    setSlate(null)
    setLoading(true)
    setError('')
    void loadGameMarkets(sport).then(data => {
      if (!cancelled) setSlate(data)
    }).catch(problem => {
      if (!cancelled) setError(problem instanceof Error ? problem.message : 'Unable to check the game lines.')
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [sport, refreshKey])

  const allGames = slate?.games ?? []
  const games = withMarkets ? allGames.filter(game => game.hasMarkets) : allGames

  return <div className="market-page">
    <section className="hero market-hero">
      <span className="eyebrow gold">EDGEIQ / GAME INTELLIGENCE</span>
      <h1>Game lines. <span className="gold">Clearer decisions.</span></h1>
      <p>Compare NBA and NFL moneylines, point spreads, total points, and market-implied win probabilities for upcoming games — all in one place.</p>
    </section>
    <div className="market-toolbar">
      <div className="cheat-tabs" role="group" aria-label="Sport">
        <button className={sport === 'NBA' ? 'cheat-tab on' : 'cheat-tab'} aria-pressed={sport === 'NBA'} onClick={() => setSport('NBA')}>🏀 NBA</button>
        <button className={sport === 'NFL' ? 'cheat-tab on' : 'cheat-tab'} aria-pressed={sport === 'NFL'} onClick={() => setSport('NFL')}>🏈 NFL</button>
      </div>
      <button className="market-refresh" disabled={loading} onClick={() => setRefreshKey(previous => previous + 1)}>↻ Refresh market lines</button>
    </div>
    <div className="market-explainer" role="note">
      <strong>How win probability works:</strong> When both teams' moneylines are reported, EDGEIQ converts them to implied probabilities and normalizes them to remove the bookmaker's margin. This is <strong>not</strong> a proprietary prediction, a guarantee or a calibrated AI forecast. Lines may be delayed, incomplete, or missing.
    </div>
    <div className="market-list-head">
      <div>
        <span className="eyebrow">PREGAME NBA / NFL MARKETS</span>
        <h2>{loading ? 'Checking upcoming games…' : slate ? (slate.isToday ? 'Today · ' : 'Next slate · ') + slate.dateLabel : 'Game markets'}</h2>
        <p>{slate ? allGames.length + ' upcoming games · ' + allGames.filter(game => game.hasMarkets).length + ' with reported lines' : 'Source: ESPN public scoreboards and game summaries'}</p>
      </div>
      <label className="market-filter">
        <input type="checkbox" checked={withMarkets} onChange={event => setWithMarkets(event.target.checked)}/>
        Show games with lines only
      </label>
    </div>
    {slate && <p className="market-checked">Checked {new Date(slate.checkedAt).toLocaleString()} · Data supplied through ESPN public endpoints; provider shown per game.</p>}
    {slate?.incomplete && <p className="market-warning">Some odds requests were unavailable. Missing markets are left blank rather than estimated.</p>}
    {loading ? <section className="panel market-empty" role="status"><h3>Loading {sport} matchups and markets…</h3><p>Checking upcoming games and any reported odds.</p></section>
      : error ? <section className="panel market-empty" role="alert"><h3>Market feed temporarily unavailable</h3><p>{error}</p><button className="cta" onClick={() => setRefreshKey(previous => previous + 1)}>Try again</button></section>
      : games.length === 0 ? <section className="panel market-empty"><h3>{withMarkets && allGames.length ? 'No market lines published' : 'No upcoming games found'}</h3><p>{withMarkets ? 'Switch off the filter to see scheduled matchups without reported odds.' : 'No upcoming slate was returned by the schedule source. Check again later.'}</p></section>
      : <div className="market-cards">{games.map(game => <MarketCard key={game.id} game={game}/>)}</div>}

    <section className="cheat-pro market-upsell">
      <div><span className="eyebrow gold">FREE MATCHUP RESEARCH</span><h2>Want deeper game intelligence?</h2>
        <p>Open The Script to explore the matchup, player history, game scenarios and available market comparisons.</p></div>
      <button className="cta" onClick={onPro}>Open The Script</button>
    </section>
    <p className="footnote market-disclaimer">Independent sports research for adults where permitted. Quoted prices are informational and may have changed. ESPN public feed availability does not establish commercial redistribution rights; obtain appropriate data licensing before charging for these market-data services. Always check a licensed sportsbook for the actual price and eligibility. No betting transaction is placed on EDGEIQ.</p>
  </div>
}
