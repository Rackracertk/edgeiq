import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { usingLicensedFeed } from './verifiedFeed'
import type { Direction } from './analytics/hitRates'

type Group = { games: number; hits: number; rate: number; average: number } | null
type Insights = {
  sampleSize: number; season: Group; L5: Group; L10: Group; L20: Group;
  home: Group; away: Group; opponents: { opponent: string; games: number; hits: number; rate: number; average: number }[];
  refreshedAt: string;
}
type Props = {
  sport: 'NBA' | 'NFL'; playerId: string | null | undefined; playerName: string | null | undefined;
  prop: string; line: number; direction: Direction; onUpgrade: () => void
}

export default function ProInsights({ sport, playerId, playerName, prop, line, direction, onUpgrade }: Props) {
  const [report, setReport] = useState<Insights | null>(null)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => { setReport(null); setMessage('') }, [sport, playerId, prop, line, direction])

  async function load() {
    if (!supabase || !playerId || working) return
    setWorking(true)
    setMessage('')
    try {
      const { data: identity } = await supabase.auth.getUser()
      if (!identity.user) {
        setMessage('Sign in and activate EDGEIQ Pro to unlock these comparisons.')
        return
      }
      const { data, error } = await supabase.functions.invoke('pro-insights', {
        body: { sport, playerId, prop, line, direction },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      if (!data || typeof data.sampleSize !== 'number') throw new Error('Premium data is unavailable')
      setReport(data as Insights)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Premium analysis is unavailable')
    } finally {
      setWorking(false)
    }
  }

  return (
    <section className="panel log-panel" style={{ margin: '24px 0' }}>
      <div className="panel-title">
        <div><span className="eyebrow gold">EDGEIQ PRO · VERIFIED COMPARISONS</span><h3>Advanced research splits</h3></div>
        <span className="small-tag">SUBSCRIBERS</span>
      </div>
      <p className="footnote">Historical season, home/away and opponent hit rates, computed server-side from the approved research feed. Not predictions or guaranteed outcomes.</p>
      {!playerId ? <p className="footnote">Choose a player to begin.</p> : !usingLicensedFeed || !supabase ?
        <p className="info-note">Advanced research will activate once the licensed data feed and customer accounts are connected.</p> : <>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="cta" disabled={working} onClick={() => void load()}>{working ? 'Checking subscription…' : 'Load Pro comparisons for ' + (playerName ?? 'selected player')}</button>
          <button className="nav" onClick={onUpgrade}>View Pro membership</button>
        </div>
        {message && <p role="status" className="info-note">{message}</p>}
        {report && <>
          <div className="metrics" style={{ marginTop: 24 }}>
            {(['L5','L10','L20','season','home','away'] as const).map(key => {
              const g = report[key]
              return <div className="metric" key={key}>
                <div className="metric-label">{key === 'season' ? 'SEASON' : key === 'home' ? 'HOME' : key === 'away' ? 'AWAY' : key} HIT RATE</div>
                <div className="metric-value">{g ? g.rate + '%' : 'N/A'}</div>
                <div className="metric-sub">{g ? g.hits + ' / ' + g.games + ' · average ' + g.average : 'Not enough verified games'}</div>
              </div>
            })}
          </div>
          <div className="panel-title" style={{ marginTop: 24 }}><h3>Opponent splits</h3><span className="small-tag">{report.sampleSize} verified games</span></div>
          <div className="table-wrap"><table><thead><tr><th>OPPONENT</th><th>GAMES</th><th>HITS</th><th>HIT RATE</th><th>AVERAGE</th></tr></thead><tbody>
            {report.opponents.map(o => <tr key={o.opponent}><td>{o.opponent}</td><td>{o.games}</td><td>{o.hits}</td><td>{o.rate}%</td><td>{o.average}</td></tr>)}
            {!report.opponents.length && <tr><td colSpan={5}>No valid opponent splits yet.</td></tr>}
          </tbody></table></div>
          <p className="footnote">Verified feed refreshed {new Date(report.refreshedAt).toLocaleString()}. Small samples can be highly misleading; evaluate playing time, injuries and context separately.</p>
        </>}
      </>}
    </section>
  )
}
