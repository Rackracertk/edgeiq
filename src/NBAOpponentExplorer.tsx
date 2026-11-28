import { useEffect, useMemo, useState } from 'react'
import { type NBAPlayerGame } from './analytics/nbaData'
import {
  asDefensePosition, buildDefenseRankings, type DefensePosition,
} from './analytics/defensiveMatchups'
import { usingLicensedFeed } from './verifiedFeed'

type Player = { id?: string | number; name?: string; team?: string; position?: string }
type History = Record<string, (NBAPlayerGame & { gameId?: string; team?: string; position?: string })[]>
type Props = {
  selected?: Player
  history: History
  prop: string
  line: number
  direction: 'over' | 'under'
  nextOpponents?: Record<string, string>
  teamLabels?: Record<string, string>
}

const positions: { id: DefensePosition; label: string; detail: string }[] = [
  { id: 'G', label: 'Guards (G)', detail: 'Point guards (PG) + shooting guards (SG)' },
  { id: 'F', label: 'Forwards (F)', detail: 'Small forwards (SF) + power forwards (PF)' },
  { id: 'C', label: 'Centers (C)', detail: 'Centers only (C)' },
]
const usDate = (date: Date) => {
  const p = new Intl.DateTimeFormat('en-US',{
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const get = (key: string) => p.find(piece => piece.type === key)?.value ?? ''
  return get('year')+get('month')+get('day')
}
function nextGamesQuery(team: string) {
  return async () => {
    const names: Record<string, string> = {}
    const scheduled: { date: string; opponent: string }[] = []
    let responses = 0
    for (let offset = 0; offset < 14; offset += 7) {
      const results = await Promise.all(Array.from({length:7},(_,i) => {
        const today = new Date()
        today.setUTCDate(today.getUTCDate()+offset+i)
        return fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates='+usDate(today))
          .then(response => response.ok ? response.json() : null).catch(() => null)
      }))
      for (const data of results) {
        if (!data) continue
        responses++
        for (const event of data.events ?? []) {
          const entries = event.competitions?.[0]?.competitors ?? []
          for (const entry of entries) if (entry.team?.displayName && entry.team?.abbreviation)
            names[String(entry.team.displayName)]=String(entry.team.abbreviation)
          if (event.status?.type?.completed || Date.parse(String(event.date)) <= Date.now()) continue
          const teams = entries.map((entry: any) => String(entry.team?.displayName ?? ''))
          if (!teams.includes(team) || teams.length !== 2) continue
          const opponent = teams.find((name: string) => name !== team)
          if (opponent) scheduled.push({date:String(event.date),opponent})
        }
      }
      if (scheduled.length) break
    }
    scheduled.sort((a,b)=>a.date.localeCompare(b.date))
    return {opponent: scheduled[0]?.opponent ?? '', names,
      status: scheduled.length ? 'Next upcoming scheduled opponent' :
        responses ? 'No upcoming opponent was found within the next 14 days.' : 'Schedule provider temporarily unavailable.'}
  }
}

export default function NBAOpponentExplorer({
  selected, history, prop, line, direction, nextOpponents, teamLabels,
}: Props) {
  const [manualOpponent, setManualOpponent] = useState('auto')
  const [nextOpponent, setNextOpponent] = useState('')
  const [scheduleStatus, setScheduleStatus] = useState('')
  const [teamNames, setTeamNames] = useState<Record<string,string>>({})
  const [positionFilter, setPositionFilter] = useState<DefensePosition>('G')

  useEffect(() => {
    setPositionFilter(asDefensePosition(selected?.position) ?? 'G')
    setManualOpponent('auto')
  }, [selected?.id, selected?.position])
  const rankings = useMemo(
    () => buildDefenseRankings(history,prop,line,direction),
    [history,prop,line,direction],
  )
  useEffect(() => {
    let cancelled = false
    setNextOpponent('')
    setScheduleStatus('')
    setTeamNames(teamLabels??{})
    if (!selected?.team) return
    const provided = nextOpponents?.[selected.team]
    if (provided) {
      setNextOpponent(provided)
      setScheduleStatus('Upcoming opponent from daily published schedule')
      return
    }
    if (usingLicensedFeed) {
      setScheduleStatus('No upcoming opponent provided by the licensed feed.')
      return
    }
    void nextGamesQuery(selected.team)().then(result=>{
      if (cancelled) return
      setNextOpponent(result.opponent)
      setScheduleStatus(result.status)
      setTeamNames(previous=>({...previous,...result.names}))
    }).catch(()=>{
      if (!cancelled) setScheduleStatus('Upcoming schedule could not be verified.')
    })
    return () => {cancelled=true}
  },[selected?.team,nextOpponents,teamLabels])

  const opponent = manualOpponent === 'auto' ? nextOpponent : manualOpponent
  const overallIndex = rankings.overall.findIndex(row=>row.team===opponent)
  const overall = overallIndex >= 0 ? rankings.overall[overallIndex] : undefined
  const difficulty = !overall || rankings.overall.length < 3 ? 'NOT RATED' :
    overallIndex < rankings.overall.length/3 ? 'TOUGH' :
      overallIndex >= rankings.overall.length*2/3 ? 'FAVORABLE' : 'AVERAGE'
  const positionRows = rankings.byPosition[positionFilter]
  const positionIndex = positionRows.findIndex(row=>row.team===opponent)
  const positionMatch = positionRows[positionIndex]
  const posName = positions.find(row=>row.id===positionFilter)!
  const short = (name: string) => teamNames[name] ?? name
  const lineLabel = (direction==='over'?'over ':'under ')+line

  return <section className="panel log-panel">
    <div className="panel-title"><div>
      <span className="eyebrow">NBA OPPONENT RESEARCH</span>
      <h3>Opponent matchup explorer</h3>
    </div><span className="small-tag">2026–27 VERIFIED GAME LOGS</span></div>
    <p className="footnote">
      Compare how defenses performed against actual players in completed games.
      The team-wide section measures cumulative team stats allowed per game.
      The position section measures opposing player appearances at the selected prop line.
      These are historical matchups, not predictions.
    </p>
    <div className="field" style={{maxWidth:420,marginBottom:20}}>
      <label htmlFor="nba-opponent">DEFENSE TO ANALYZE</label>
      <select id="nba-opponent" value={manualOpponent} onChange={event=>setManualOpponent(event.target.value)}>
        <option value="auto">Next scheduled opponent (automatic)</option>
        {rankings.overall.map(row=><option value={row.team} key={row.team}>{row.team}</option>)}
      </select>
    </div>
    {selected ? <div className="metrics" style={{marginBottom:20}}>
      <div className="metric"><div className="metric-label">UPCOMING MATCHUP</div>
        <div className="metric-value" style={{fontSize:24}}>{short(selected.team??'—')} vs {opponent?short(opponent):'—'}</div>
        <div className="metric-sub">{manualOpponent==='auto'?scheduleStatus:'Manually selected opponent'}</div></div>
      <div className="metric"><div className="metric-label">OVERALL {prop.toUpperCase()} DEFENSE RANK</div>
        <div className="metric-value">{overall?'#'+(overallIndex+1):'Not rated'}</div>
        <div className="metric-sub">{rankings.overall.length} qualifying defenses · lower points/stats allowed is tougher</div></div>
      <div className="metric"><div className="metric-label">TEAM {prop.toUpperCase()} ALLOWED / GAME</div>
        <div className="metric-value">{overall?overall.allowedPerGame.toFixed(1):'No sample'}</div>
        <div className="metric-sub">{overall?overall.games+' completed games':'Requires at least three validated games'}</div></div>
      <div className="metric gold-metric"><div className="metric-label">TEAM MATCHUP DIFFICULTY</div>
        <div className="metric-value" style={{fontSize:25}}>{difficulty}</div>
        <div className="metric-sub">Rank is relative to the loaded defensive samples, not an outcome probability</div></div>
    </div>:<p className="footnote">Select a player above to see their next opponent. You can also choose a defense manually.</p>}

    <div className="panel-title"><div><span className="eyebrow">TEAM DEFENSE</span><h3>{prop} allowed per game — whole team</h3></div>
      <span className="small-tag">LOWEST = TOUGHEST</span></div>
    <p className="footnote">This leaderboard sums the selected statistic across all recorded opposing players in each completed game. It is NOT the average stat line for one player.</p>
    <div className="table-wrap"><table><thead><tr><th>RANK</th><th>DEFENSE</th><th>GAMES</th><th>OPPONENT TEAM {prop.toUpperCase()} / GAME</th></tr></thead><tbody>
      {rankings.overall.map((row,index)=><tr key={row.team}><td>{index+1}</td><td>{row.team}</td><td>{row.games}</td><td>{row.allowedPerGame.toFixed(1)}</td></tr>)}
      {!rankings.overall.length && <tr><td colSpan={4} className="table-empty">Full opposing team box scores are insufficient for this statistic.</td></tr>}
    </tbody></table></div>

    <div className="panel-title" style={{marginTop:32}}><div>
      <span className="eyebrow">DEFENSE BY PLAYER POSITION</span>
      <h3>{prop} allowed to {posName.label}</h3>
    </div><span className="small-tag">SAME-STAT LINE COMPARISON</span></div>
    <div className="cheat-info" role="note" style={{marginBottom:20}}>
      <strong>Why PG, SG, SF and PF previously showed N/A:</strong> The public NBA box scores label players as G (guard), F (forward), or C (center).
      EDGEIQ now uses those actual categories: <b>G includes PG + SG</b>, <b>F includes SF + PF</b>, and <b>C is centers</b>.
      Breaking guards or forwards into exact subpositions would require a more detailed verified data provider.
    </div>
    <div className="field" style={{maxWidth:340,marginBottom:20}}>
      <label htmlFor="nba-position">OPPOSING PLAYER POSITION</label>
      <select id="nba-position" value={positionFilter} onChange={event=>setPositionFilter(event.target.value as DefensePosition)}>
        {positions.map(position=><option key={position.id} value={position.id}>{position.label} — {position.detail}</option>)}
      </select>
    </div>
    {selected && <div className="metrics" style={{marginBottom:20}}>
      <div className="metric"><div className="metric-label">{short(opponent||'OPPONENT')} VS {positionFilter} RANK</div>
        <div className="metric-value">{positionMatch?'#'+(positionIndex+1):'No sample'}</div>
        <div className="metric-sub">{positionRows.length} qualifying defenses ranked by {prop} allowed per qualifying player appearance</div></div>
      <div className="metric"><div className="metric-label">{prop.toUpperCase()} / QUALIFYING {positionFilter} APPEARANCE</div>
        <div className="metric-value">{positionMatch?.allowedPerAppearance?.toFixed(1)??'No sample'}</div>
        <div className="metric-sub">{positionMatch?positionMatch.appearances+' player appearances, '+positionMatch.distinctGames+' games':'At least 8 appearances in 3 games required'}</div></div>
      <div className="metric"><div className="metric-label">{positionFilter} PLAYERS HITTING {lineLabel.toUpperCase()}</div>
        <div className="metric-value">{positionMatch?positionMatch.hits+'/'+positionMatch.appearances:'No sample'}</div>
        <div className="metric-sub">{positionMatch?'Verified appearances with 18+ minutes':'Unavailable at this line/position'}</div></div>
      <div className="metric gold-metric"><div className="metric-label">HISTORICAL {lineLabel.toUpperCase()} RATE</div>
        <div className="metric-value">{positionMatch?positionMatch.hitRate+'%':'No sample'}</div>
        <div className="metric-sub">Past hit frequency against this defense, not the player’s predicted win probability</div></div>
    </div>}
    <div className="table-wrap"><table><thead><tr><th>RANK</th><th>DEFENSE</th><th>GAMES</th><th>{prop.toUpperCase()} / PLAYER</th><th>HITS {lineLabel.toUpperCase()}</th></tr></thead><tbody>
      {positionRows.map((row,index)=><tr key={row.team}><td>{index+1}</td><td>{row.team}</td><td>{row.games}</td><td>{row.allowedPerAppearance?.toFixed(1)}</td><td>{row.hits}/{row.appearances} ({row.hitRate}%)</td></tr>)}
      {!positionRows.length && <tr><td colSpan={5} className="table-empty">Not enough position-matched appearances at this stat line. Try another prop, or check after more completed games.</td></tr>}
    </tbody></table></div>
    <p className="footnote">
      Analysis includes completed games with at least five valid player stat records per team. Position comparisons require at least
      eight opposing player appearances across three games; each player must have played at least 18 minutes.
      Different players share these samples, and the same opponent can contribute multiple appearances in one game.
      Game logs may be delayed or incomplete. All historical rates are descriptive.
    </p>
  </section>
}
