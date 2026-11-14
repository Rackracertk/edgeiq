import { useEffect, useMemo, useState } from 'react'
import type { NBAPlayerGame } from './analytics/nbaData'
import { usingLicensedFeed } from './verifiedFeed'

type Player = { id?: string | number; name?: string; team?: string; position?: string }
type History = Record<string, (NBAPlayerGame & { gameId?: string; team?: string; position?: string })[]>
type Props = { selected?: Player; history: History; prop: string; nextOpponents?: Record<string, string>; teamLabels?: Record<string, string> }

const statValue = (game: NBAPlayerGame, prop: string) => {
  if (prop === 'Points') return game.points
  if (prop === 'Rebounds') return game.rebounds
  if (prop === 'Assists') return game.assists
  if (prop === '3-Pointers Made') return game.threes
  return game.points + game.rebounds + game.assists
}

export default function NBAOpponentExplorer({ selected, history, prop, nextOpponents, teamLabels }: Props) {
  const [manualOpponent, setManualOpponent] = useState('auto')
  const [nextOpponent, setNextOpponent] = useState('')
  const [scheduleStatus, setScheduleStatus] = useState('')
  const [teamNames, setTeamNames] = useState<Record<string, string>>({})

  const rankings = useMemo(() => {
    const byGame = new Map<string, Map<string, { total: number; players: number }>>()
    Object.values(history).forEach(games => games.forEach(game => {
      if (!game.gameId || !game.team) return
      if (!byGame.has(game.gameId)) byGame.set(game.gameId, new Map())
      const totals = byGame.get(game.gameId)!
      const previous = totals.get(game.team) ?? { total: 0, players: 0 }
      totals.set(game.team, { total: previous.total + statValue(game, prop), players: previous.players + 1 })
    }))
    const allowed = new Map<string, number[]>()
    byGame.forEach(teams => {
      // Reject partial box scores rather than displaying misleading defensive ranks.
      if (teams.size !== 2 || Array.from(teams.values()).some(team => team.players < 5)) return
      const entries = Array.from(teams.entries())
      for (const [team] of entries) {
        const opponent = entries.find(([name]) => name !== team)
        if (!opponent) continue
        if (!allowed.has(team)) allowed.set(team, [])
        allowed.get(team)!.push(opponent[1].total)
      }
    })
    return Array.from(allowed, ([team, games]) => ({
      team, games: games.length,
      allowed: games.reduce((sum, n) => sum + n, 0) / games.length
    })).filter(row => row.games >= 3).sort((a, b) => a.allowed - b.allowed)
  }, [history, prop])


  const [positionFilter, setPositionFilter] = useState('PG')
  const positionRankings = useMemo(() => {
    const byGame = new Map<string, Map<string, { count: number; total: number; positionTotal: number; positionCount: number }>>()
    Object.values(history).forEach(games => games.forEach(game => {
      if (!game.gameId || !game.team) return
      if (!byGame.has(game.gameId)) byGame.set(game.gameId, new Map())
      const teams = byGame.get(game.gameId)!
      const row = teams.get(game.team) ?? { count: 0, total: 0, positionTotal: 0, positionCount: 0 }
      row.count++
      row.total += statValue(game, prop)
      if (game.position?.toUpperCase() === positionFilter) {
        row.positionTotal += statValue(game, prop)
        row.positionCount++
      }
      teams.set(game.team, row)
    }))
    const allowed = new Map<string, number[]>()
    byGame.forEach(teams => {
      if (teams.size !== 2 || Array.from(teams.values()).some(row => row.count < 5)) return
      for (const defense of teams.keys()) {
        const opponent = Array.from(teams.entries()).find(([name]) => name !== defense)?.[1]
        if (!opponent?.positionCount) continue
        if (!allowed.has(defense)) allowed.set(defense, [])
        allowed.get(defense)!.push(opponent.positionTotal)
      }
    })
    return Array.from(allowed, ([team, values]) => ({
      team, games: values.length, allowed: values.reduce((a, b) => a + b, 0) / values.length
    })).filter(row => row.games >= 3).sort((a, b) => a.allowed - b.allowed)
  }, [history, prop, positionFilter])

  useEffect(() => {
    let cancelled = false
    setNextOpponent('')
    setScheduleStatus('')
    if (!selected?.team) return
    if (usingLicensedFeed) {
      setNextOpponent(nextOpponents?.[selected.team] ?? '')
      setTeamNames(teamLabels ?? {})
      if (!nextOpponents?.[selected.team]) setScheduleStatus('No upcoming opponent supplied by the licensed feed.')
      return
    }
    const team = selected.team
    async function load() {
      const names: Record<string, string> = {}
      const upcoming: { date: string; opponent: string }[] = []
      let successes = 0
      const today = new Date()
      const format = (d: Date) => d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0')
      for (let offset = 0; offset < 14; offset += 7) {
        const results = await Promise.all(Array.from({ length: 7 }, (_, i) => {
          const day = new Date(today)
          day.setDate(today.getDate() + offset + i)
          return fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=' + format(day))
            .then(r => { if (!r.ok) throw new Error('Schedule unavailable'); return r.json() })
            .catch(() => null)
        }))
        for (const data of results) {
          if (!data) continue
          successes++
          for (const event of data.events ?? []) {
            const competitors = event.competitions?.[0]?.competitors ?? []
            for (const entry of competitors) {
              if (entry.team?.displayName && entry.team?.abbreviation) names[String(entry.team.displayName)] = String(entry.team.abbreviation)
            }
            if (event.status?.type?.completed || event.season?.type !== 2) continue
            const teams = competitors.map((entry: any) => String(entry.team?.displayName ?? ''))
            if (teams.includes(team) && teams.length === 2) {
              const opponent = teams.find((name: string) => name !== team)
              if (opponent) upcoming.push({ date: String(event.date), opponent })
            }
          }
        }
        if (upcoming.length) break
      }
      upcoming.sort((a, b) => a.date.localeCompare(b.date))
      if (!cancelled) {
        setTeamNames(names)
        setNextOpponent(upcoming[0]?.opponent ?? '')
        if (!upcoming.length) setScheduleStatus(successes ? 'No upcoming regular-season opponent found within 14 days.' : 'Schedule temporarily unavailable.')
      }
    }
    void load()
    return () => { cancelled = true }
  }, [selected?.team, nextOpponents, teamLabels])

  const opponent = manualOpponent === 'auto' ? nextOpponent : manualOpponent
  const index = rankings.findIndex(row => row.team === opponent)
  const matchup = index < 0 ? undefined : rankings[index]
  const difficulty = !matchup || rankings.length < 3 ? 'UNAVAILABLE' : index < rankings.length / 3 ? 'TOUGH' : index >= rankings.length * 2 / 3 ? 'FAVORABLE' : 'AVERAGE'
  const short = (team: string) => teamNames[team] ?? team

  return <section className="panel log-panel">
    <div className="panel-title"><div><span className="eyebrow">NBA OPPONENT RESEARCH</span><h3>Opponent matchup explorer</h3></div><span className="small-tag">2026–27 SEASON DATA</span></div>
    <p className="footnote">Compare the next scheduled opponent or select any available defense. Rankings use team totals from completed game box scores loaded by EDGEIQ, not opponent position-specific allowances. Only games with at least five recorded players on each team qualify; partial game data is excluded.</p>
    <div className="field" style={{ maxWidth: 420, marginBottom: 20 }}>
      <label htmlFor="nba-opponent">OPPONENT</label>
      <select id="nba-opponent" value={manualOpponent} onChange={e => setManualOpponent(e.target.value)}>
        <option value="auto">Next scheduled opponent (automatic)</option>
        {rankings.map(row => <option key={row.team} value={row.team}>{row.team}</option>)}
      </select>
    </div>
    {selected ? <div className="metrics" style={{ marginBottom: 20 }}>
      <div className="metric"><div className="metric-label">MATCHUP</div><div className="metric-value" style={{ fontSize: 26 }}>{short(selected.team ?? '—')} vs {opponent ? short(opponent) : '—'}</div><div className="metric-sub">{manualOpponent === 'auto' ? scheduleStatus || (nextOpponent ? 'Next scheduled opponent' : 'Checking upcoming schedule…') : 'Manually selected defense'}</div></div>
      <div className="metric"><div className="metric-label">{prop.toUpperCase()} DEFENSE RANK</div><div className="metric-value">{matchup ? '#' + (index + 1) : 'N/A'}</div><div className="metric-sub">Among {rankings.length} qualifying teams · lowest allowed = toughest</div></div>
      <div className="metric"><div className="metric-label">{prop.toUpperCase()} ALLOWED / GAME</div><div className="metric-value">{matchup ? matchup.allowed.toFixed(1) : 'N/A'}</div><div className="metric-sub">{matchup ? matchup.games + ' loaded completed games' : 'Insufficient validated data'}</div></div>
      <div className="metric gold-metric"><div className="metric-label">MATCHUP DIFFICULTY</div><div className="metric-value" style={{ fontSize: 26 }}>{difficulty}</div><div className="metric-sub">Relative to qualifying defenses; not a prediction</div></div>
    </div> : <p className="footnote">Choose an NBA player above to explore defensive matchups.</p>}
    <div className="panel-title"><div><span className="eyebrow">DEFENSIVE LEADERBOARD</span><h3>{prop} allowed per game</h3></div><span className="small-tag">LOWEST = TOUGHEST</span></div>
    <div className="table-wrap"><table><thead><tr><th>RANK</th><th>DEFENSE</th><th>GAMES</th><th>{prop.toUpperCase()} ALLOWED / GAME</th></tr></thead><tbody>
      {rankings.map((row, i) => <tr key={row.team}><td>{i + 1}</td><td>{row.team}</td><td>{row.games}</td><td>{row.allowed.toFixed(1)}</td></tr>)}
      {!rankings.length && <tr><td colSpan={4} className="table-empty">Waiting for completed game box scores from at least three games per team.</td></tr>}
    </tbody></table></div>

    <div className="panel-title" style={{ marginTop: 32 }}><div><span className="eyebrow">POSITION-SPECIFIC DEFENSE</span><h3>{prop} allowed to {positionFilter}s</h3></div><span className="small-tag">LOWEST = TOUGHEST</span></div>
    <p className="footnote">Historical per-game totals by listed player position, not individual-player projections. A game is included only when the opposing box score has a player tagged at that position; minimum three qualifying games. Position labels depend on ESPN coverage and may not reflect the role played that night.</p>
    <div className="field" style={{ maxWidth: 300, marginBottom: 20 }}>
      <label htmlFor="nba-position">PLAYER POSITION</label>
      <select id="nba-position" value={positionFilter} onChange={e => setPositionFilter(e.target.value)}>
        {['PG', 'SG', 'SF', 'PF', 'C'].map(position => <option key={position} value={position}>{position}</option>)}
      </select>
    </div>
    {selected && <div className="metrics" style={{ marginBottom: 20 }}>
      <div className="metric"><div className="metric-label">OPPONENT VS {positionFilter}</div><div className="metric-value">{opponent ? (positionRankings.findIndex(row => row.team === opponent) >= 0 ? '#' + (positionRankings.findIndex(row => row.team === opponent) + 1) : 'N/A') : 'N/A'}</div><div className="metric-sub">Among {positionRankings.length} qualifying defenses</div></div>
      <div className="metric"><div className="metric-label">{prop.toUpperCase()} ALLOWED TO {positionFilter} / GAME</div><div className="metric-value">{positionRankings.find(row => row.team === opponent)?.allowed.toFixed(1) ?? 'N/A'}</div><div className="metric-sub">Historical position totals, not a prediction</div></div>
    </div>}
    <div className="table-wrap"><table><thead><tr><th>RANK</th><th>DEFENSE</th><th>GAMES</th><th>{prop.toUpperCase()} / GAME</th></tr></thead><tbody>
      {positionRankings.map((row, i) => <tr key={row.team}><td>{i + 1}</td><td>{row.team}</td><td>{row.games}</td><td>{row.allowed.toFixed(1)}</td></tr>)}
      {!positionRankings.length && <tr><td colSpan={4} className="table-empty">Position data unavailable or insufficient for this selection.</td></tr>}
    </tbody></table></div>
  </section>
}
