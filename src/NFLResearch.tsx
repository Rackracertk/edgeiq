import { useEffect, useMemo, useState } from 'react'
import { calculateRecentHitRates, type Direction } from './analytics/hitRates'
import { getVerifiedFeed, usingLicensedFeed } from './verifiedFeed'

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
  const [manualOpponent, setManualOpponent] = useState('auto')
  const [nextOpponent, setNextOpponent] = useState('')
  const [scheduleStatus, setScheduleStatus] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        if (usingLicensedFeed) {
          const feed = await getVerifiedFeed<{ rows: RecordRow[] }>('NFL')
          if (!cancelled) {
            setRows(feed.data.rows)
            if (feed.stale) setError('Verified NFL feed is more than an hour old. Last updated ' + new Date(feed.refreshedAt).toLocaleString())
          }
          return
        }
        const end = new Date()
        const seasonYear = end.getMonth() >= 7 ? end.getFullYear() : end.getFullYear() - 1
        const start = new Date(seasonYear, 8, 1)
        const daysInSeason = Math.max(0, Math.floor((new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime() - start.getTime()) / 86400000) + 1)
        const fmt = (date: Date) => date.getFullYear() + String(date.getMonth() + 1).padStart(2, '0') + String(date.getDate()).padStart(2, '0')
        // ESPN's NFL scoreboard rejects large calendar date ranges with HTTP 400.
        // Query each day separately, then deduplicate event IDs.
        const eventMap = new Map<string, Game>()
        let successfulDays = 0
        for (let offset = 0; offset < daysInSeason; offset += 6) {
          const days = Array.from({ length: Math.min(6, daysInSeason - offset) }, (_, i) => {
            const day = new Date(end)
            day.setDate(end.getDate() - offset - i)
            return day
          })
          const results = await Promise.all(days.map(async day => {
            try {
              const data = await json('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=' + fmt(day) + '&limit=100')
              return data.events ?? []
            } catch { return null }
          }))
          results.forEach(events => {
            if (!events) return
            successfulDays++
            events.forEach((event: any) => {
              if (event.status?.type?.completed === true && event.id && (event.season?.type === 2 || event.season?.type === undefined)) {
                eventMap.set(String(event.id), { id: String(event.id), date: String(event.date), completed: true })
              }
            })
          })
        }
        if (successfulDays === 0) throw new Error('NFL scoreboard requests failed. Please retry later.')
        const games = Array.from(eventMap.values())
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
  useEffect(() => {
    let cancelled = false
    setNextOpponent('')
    setScheduleStatus('')
    if (!selected?.team) return
    async function loadNextOpponent() {
      try {
        const today = new Date()
        const fmt = (date: Date) => date.getFullYear() + String(date.getMonth() + 1).padStart(2, '0') + String(date.getDate()).padStart(2, '0')
        const upcoming: { date: string; opponent: string }[] = []
        for (let offset = 0; offset < 21; offset += 7) {
          const results = await Promise.all(Array.from({ length: 7 }, (_, i) => {
            const day = new Date(today)
            day.setDate(today.getDate() + offset + i)
            return json('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=' + fmt(day) + '&limit=100').catch(() => null)
          }))
          for (const data of results) for (const event of data?.events ?? []) {
            if (event.status?.type?.completed) continue
            const competitors = event.competitions?.[0]?.competitors ?? []
            const teams = competitors.map((entry: any) => String(entry.team?.abbreviation ?? ''))
            if (teams.includes(selected!.team) && teams.length === 2) {
              const opponent = teams.find((team: string) => team !== selected!.team)
              if (opponent) upcoming.push({ date: String(event.date), opponent })
            }
          }
          if (upcoming.length) break
        }
        upcoming.sort((a, b) => a.date.localeCompare(b.date))
        if (!cancelled) {
          setNextOpponent(upcoming[0]?.opponent ?? '')
          if (!upcoming.length) setScheduleStatus('No upcoming opponent found in the next 21 days.')
        }
      } catch {
        if (!cancelled) setScheduleStatus('Upcoming schedule is temporarily unavailable.')
      }
    }
    void loadNextOpponent()
    return () => { cancelled = true }
  }, [selected?.team])
  const suggestions = query && !selected ? players.filter(player => player.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8) : []
  const history = Array.from(new Map(rows.filter(row => row.playerId === playerId && category in row.stats).map(row => [row.gameId, row])).values()).sort((a, b) => b.date.localeCompare(a.date))
  const values = history.map(row => row.stats[category])
  // Derive opponent passing yards allowed from actual completed game box scores.
  // Each game's team total is the sum of player passing yards for that team.
  const defensivePassing = useMemo(() => {
    const byGame = new Map<string, Map<string, number>>()
    rows.forEach(row => {
      if (row.stats['Passing Yards'] === undefined) return
      if (!byGame.has(row.gameId)) byGame.set(row.gameId, new Map())
      const teams = byGame.get(row.gameId)!
      teams.set(row.team, (teams.get(row.team) ?? 0) + row.stats['Passing Yards'])
    })
    const allowed = new Map<string, number[]>()
    byGame.forEach(teams => {
      if (teams.size !== 2) return
      const entries = Array.from(teams.entries())
      for (const [team] of entries) {
        const opponentYards = entries.find(([other]) => other !== team)?.[1]
        if (opponentYards === undefined) continue
        if (!allowed.has(team)) allowed.set(team, [])
        allowed.get(team)!.push(opponentYards)
      }
    })
    return Array.from(allowed, ([team, games]) => ({
      team, games: games.length,
      yardsAllowed: games.reduce((sum, yards) => sum + yards, 0) / games.length
    })).filter(item => item.games >= 3).sort((a, b) => a.yardsAllowed - b.yardsAllowed)
  }, [rows])
  const matchupOpponent = manualOpponent === 'auto' ? nextOpponent : manualOpponent
  const matchupIndex = defensivePassing.findIndex(item => item.team === matchupOpponent)
  const matchup = matchupIndex >= 0 ? defensivePassing[matchupIndex] : undefined
  const matchupDifficulty = matchup && defensivePassing.length > 1
    ? matchupIndex < defensivePassing.length / 3 ? 'TOUGH' : matchupIndex >= defensivePassing.length * 2 / 3 ? 'FAVORABLE' : 'AVERAGE'
    : 'UNAVAILABLE'
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
    <section className="panel log-panel">
      <div className="panel-title"><div><span className="eyebrow">PLAYER VS DEFENSE</span><h3>Opponent matchup explorer</h3></div><span className="small-tag">2026 REGULAR SEASON</span></div>
      <p className="footnote">Select a player, then compare their next scheduled opponent or any available NFL defense. Rankings reflect passing yards allowed, so they apply most directly to passing-yard props.</p>
      <div className="field" style={{ maxWidth: 420, marginBottom: 20 }}>
        <label htmlFor="nfl-opponent">OPPONENT</label>
        <select id="nfl-opponent" value={manualOpponent} onChange={event => setManualOpponent(event.target.value)}>
          <option value="auto">Next scheduled opponent (automatic)</option>
          {defensivePassing.map(item => <option key={item.team} value={item.team}>{item.team}</option>)}
        </select>
      </div>
      {selected ? <div className="metrics" style={{ marginBottom: 20 }}>
        <div className="metric"><div className="metric-label">MATCHUP</div><div className="metric-value" style={{ fontSize: 28 }}>{selected.team} vs {matchupOpponent || '—'}</div><div className="metric-sub">{manualOpponent === 'auto' ? (scheduleStatus || (nextOpponent ? 'Next scheduled opponent' : 'Checking upcoming schedule…')) : 'Manually selected defense'}</div></div>
        <div className="metric"><div className="metric-label">PASS DEFENSE RANK</div><div className="metric-value">{matchup ? '#' + (matchupIndex + 1) : 'N/A'}</div><div className="metric-sub">Among {defensivePassing.length} qualifying teams</div></div>
        <div className="metric"><div className="metric-label">PASS YARDS ALLOWED / GAME</div><div className="metric-value">{matchup ? matchup.yardsAllowed.toFixed(1) : 'N/A'}</div><div className="metric-sub">{matchup ? matchup.games + ' completed games' : 'No validated matchup data'}</div></div>
        <div className="metric gold-metric"><div className="metric-label">PASSING MATCHUP</div><div className="metric-value" style={{ fontSize: 28 }}>{matchupDifficulty}</div><div className="metric-sub">Relative to qualifying defenses; not a win probability</div></div>
      </div> : <p className="footnote">Choose an NFL player above to see their opponent matchup.</p>}
    </section>
    <section className="panel log-panel">
      <div className="panel-title"><div><span className="eyebrow">2026 NFL DEFENSIVE MATCHUPS</span><h3>Passing yards allowed per game</h3></div><span className="small-tag">LOWEST = TOUGHEST</span></div>
      <p className="footnote">Calculated from completed regular-season game box scores loaded by EDGEIQ. Teams require at least three games. This is a historical defensive measure, not a prediction.</p>
      <div className="table-wrap"><table><thead><tr><th>RANK</th><th>DEFENSE</th><th>GAMES</th><th>PASS YDS ALLOWED / GAME</th></tr></thead><tbody>
        {defensivePassing.map((item, index) => <tr key={item.team}><td>{index + 1}</td><td>{item.team}</td><td>{item.games}</td><td>{item.yardsAllowed.toFixed(1)}</td></tr>)}
        {defensivePassing.length === 0 && <tr><td colSpan={4} className="table-empty">{loading ? 'Loading defensive game logs…' : 'Insufficient verified defensive game logs.'}</td></tr>}
      </tbody></table></div>
    </section>
    <section className="panel log-panel"><div className="panel-title"><div><span className="eyebrow">HISTORICAL RESULTS</span><h3>NFL game log · {category}</h3></div><span className="small-tag">NEWEST FIRST</span></div>
      <div className="table-wrap"><table><thead><tr><th>DATE</th><th>TEAM</th><th>STAT</th><th>{direction.toUpperCase()} {line}</th></tr></thead><tbody>{history.slice(0, 20).map(row => <tr key={row.gameId}><td>{new Date(row.date).toLocaleDateString()}</td><td>{row.team}</td><td>{row.stats[category]}</td><td><span className={hit(row.stats[category]) ? 'hit-chip' : 'miss-chip'}>{hit(row.stats[category]) ? 'HIT' : row.stats[category] === line ? 'PUSH' : 'MISS'}</span></td></tr>)}{history.length === 0 && <tr><td colSpan={4} className="table-empty">{loading ? 'Loading NFL games…' : 'No games available for this player and stat.'}</td></tr>}</tbody></table></div>
      <p className="footnote">Data source: ESPN public game summaries. Available history may be incomplete. Matchup grades and projections are not yet validated.</p>
    </section>
  </>
}
