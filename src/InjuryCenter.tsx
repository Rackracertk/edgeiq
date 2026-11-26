import { useEffect, useMemo, useState } from 'react'
import type { CheatSport } from './cheatSheetData'
import {
  loadInjuryReport, injuryAvailability, injurySourceUrl,
  type InjuryData, type InjuryReport,
} from './analytics/injuryCenter'
import './InjuryCenter.css'
import { teamsFor, teamFor, teamMatches, teamName, textMatches } from './analytics/teamDirectory'

const formatDate = (date: string) => {
  if (!date) return 'Update time not reported'
  const value = new Date(date)
  return Number.isFinite(value.getTime()) ? value.toLocaleString() : 'Update time not reported'
}

export default function InjuryCenter() {
  const [sport, setSport] = useState<CheatSport>('NBA')
  const [data, setData] = useState<InjuryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [selectedTeam, setSelectedTeam] = useState('all')
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setData(null)
    void loadInjuryReport(sport).then(report => {
      if (!cancelled) setData(report)
    }).catch(error => {
      if (!cancelled) setData({
        injuries: [], available: false, checkedAt: new Date().toISOString(), source: 'Unavailable',
        error: error instanceof Error ? error.message : 'Injury source unavailable',
      })
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [sport, reload])
  useEffect(() => {
    const interval = window.setInterval(() => setReload(v => v+1), 10 * 60 * 1000)
    const onFocus = () => setReload(v => v+1)
    window.addEventListener('focus', onFocus)
    return () => { window.clearInterval(interval); window.removeEventListener('focus',onFocus) }
  }, [])
  const injuries = data?.injuries ?? []
  const directory = teamsFor(sport)
  const teamRows = injuries.filter(row => selectedTeam === 'all' || teamFor(sport,row.team)?.code === selectedTeam)
  const counts = useMemo(() => ({
    out: teamRows.filter(row => injuryAvailability(row.status) === 'unavailable').length,
    risk: teamRows.filter(row => injuryAvailability(row.status) === 'risk').length,
    listed: teamRows.filter(row => injuryAvailability(row.status) === 'listed').length,
  }), [teamRows])
  const shown = teamRows.filter(row => {
    if (status !== 'all' && injuryAvailability(row.status) !== status) return false
    const query = search.trim().toLowerCase()
    if (query && !teamMatches(sport,row.team,query) && !textMatches(row.player + ' ' + row.reason + ' ' + row.status,query)) return false
    return true
  }).sort((a,b) => a.team.localeCompare(b.team) || a.player.localeCompare(b.player))
  return <div className="injury-page">
    <section className="hero injury-hero">
      <div className="eyebrow gold">EDGEIQ / PLAYER AVAILABILITY</div>
      <h1>Injury & <span className="gold">availability center.</span></h1>
      <p>Track reported injuries, injury designations and player availability so the daily research board can adjust when a featured player is ruled out or listed as questionable.</p>
    </section>
    <div className="injury-toolbar">
      <div className="cheat-tabs" role="group" aria-label="Sport">
        <button className={sport === 'NBA' ? 'cheat-tab on' : 'cheat-tab'} onClick={() => {setSport('NBA');setSearch('');setStatus('all');setSelectedTeam('all')}} aria-pressed={sport==='NBA'}>🏀 NBA</button>
        <button className={sport === 'NFL' ? 'cheat-tab on' : 'cheat-tab'} onClick={() => {setSport('NFL');setSearch('');setStatus('all');setSelectedTeam('all')}} aria-pressed={sport==='NFL'}>🏈 NFL</button>
      </div>
      <button className="market-refresh" disabled={loading} onClick={() => setReload(v => v+1)}>↻ Refresh injury feed</button>
    </div>
    <div className="cheat-info"><strong>Source:</strong> ESPN public injury feed. This is not a definitive active lineup or final game-day designation. For NBA, compare with the <a href={injurySourceUrl('NBA')} target="_blank" rel="noopener noreferrer">official NBA injury report</a>. For NFL, compare with the <a href={injurySourceUrl('NFL')} target="_blank" rel="noopener noreferrer">NFL injury listings</a>. Statuses can change close to tipoff or kickoff.</div>
    <div className="revamp-filter"><label>TEAM DIRECTORY<select value={selectedTeam} onChange={e=>setSelectedTeam(e.target.value)}><option value="all">All {sport} teams</option>{directory.map(t=><option key={t.code} value={t.code}>{t.name} · {t.code}</option>)}</select></label><label>FIND PLAYER OR TEAM<input value={search} onChange={e=>setSearch(e.target.value)} placeholder={sport==='NBA'?'Lakers, BOS, player…':'Packers, GB, player…'} /></label><label>AVAILABILITY<select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All statuses</option><option value="unavailable">Out / unavailable</option><option value="risk">Questionable / uncertain</option><option value="listed">Other listed</option></select></label><button className="nav" onClick={()=>{setSelectedTeam('all');setStatus('all');setSearch('')}}>Reset filters</button></div>
    <div className="injury-overview">
      <div><span>REPORTED OUT / UNAVAILABLE</span><strong>{data?.available ? counts.out : '—'}</strong></div>
      <div><span>QUESTIONABLE / DOUBTFUL / DAY-TO-DAY</span><strong>{data?.available ? counts.risk : '—'}</strong></div>
      <div><span>OTHER REPORTED STATUS</span><strong>{data?.available ? counts.listed : '—'}</strong></div>
    </div>
    {data?.available && <p className="injury-timestamp">Report checked {formatDate(data.checkedAt)} · {data.source} · Every 10 minutes while this page is open</p>}
    {loading ? <section className="panel injury-empty" role="status"><h3>Checking {sport} injury reports…</h3></section>
      : !data?.available ? <section className="panel injury-empty" role="alert">
        <h3>Injury verification temporarily unavailable</h3>
        <p>{data?.error ?? 'The injury feed did not return verified information.'} EDGEIQ will not label unreported players as healthy.</p>
        <button className="cta" onClick={() => setReload(v => v+1)}>Try again</button>
      </section>
      : <>
        <p className="injury-timestamp">{shown.length} matching reports · {selectedTeam==='all' ? 'All teams' : teamName(sport,selectedTeam)}</p>
        {shown.length ? <div className="injury-list">{shown.map((row: InjuryReport, idx) =>
          <article className="injury-row" key={(row.playerId || row.player) + '-' + row.team + '-' + idx}>
            <div className="injury-person"><strong>{row.player}</strong><span>{teamName(sport,row.team) || 'Team not reported'}{row.position ? ' · ' + row.position : ''} · {row.reason || 'Reason not supplied'}</span></div>
            <div className="injury-details">
              <span className={'injury-status ' + injuryAvailability(row.status)}>{row.status}</span>
              {row.note && <p>{row.note}</p>}
              {row.expectedReturn && <p>Expected return: {row.expectedReturn}</p>}
              <small>{formatDate(row.updatedAt)}</small>
            </div>
          </article>
        )}</div> : <section className="panel injury-empty"><h3>No matching injury entries</h3><p>No reported entries match this team or search. This does not establish that the roster is healthy or cleared to play.</p></section>}
      </>}
    <p className="footnote injury-footnote">Injury notes may be delayed or incomplete. Only athletes matching a reported player ID, or both a name and team, are automatically excluded from the cheat sheet. A missing listing does not guarantee that a player will start.</p>
  </div>
}
