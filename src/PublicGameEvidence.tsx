import {useEffect,useMemo,useState} from 'react'
import {clean,normalizeEvents,type Fixture} from './analytics/scriptSports'
import {eligibleHistory,parseBox,groupObservations,historicalScoreBaseline,type Observation} from './analytics/publicGameEvidence'
const endpoint='https://site.api.espn.com/apis/site/v2/sports/'
async function get(url:string,signal:AbortSignal){const r=await fetch(url,{signal});if(!r.ok)throw Error('Source HTTP '+r.status);return r.json()}
const date=(n:number)=>new Date(n).toISOString().slice(0,10).replaceAll('-','')
const mean=(values:number[])=>values.length?(values.reduce((a,b)=>a+b,0)/values.length).toFixed(2):'—'
export default function PublicGameEvidence({game,showPlayers}:{game:Fixture;showPlayers:boolean}){
 const [history,setHistory]=useState<Fixture[]>([]);const [rows,setRows]=useState<Observation[]>([]);const [state,setState]=useState('Loading observed results…');const [query,setQuery]=useState('');const [stat,setStat]=useState('');const [limit,setLimit]=useState(24)
 useEffect(()=>{
  const controller=new AbortController();let active=true
  const run=async()=>{
   const cutoff=Math.min(Date.now(),Date.parse(game.date));const ids=new Set(game.participants.map(p=>p.id))
   try{
    // Query smaller windows rather than one large response for dense college schedules.
    const batches=Array.from({length:4},(_,i)=>[date(cutoff-(i+1)*7*86400000),date(cutoff-i*7*86400000)])
    const responses=await Promise.allSettled(batches.map(([start,end])=>get(endpoint+game.path+'/scoreboard?dates='+start+'-'+end+'&limit=1000',controller.signal)))
    const valid=responses.flatMap(r=>r.status==='fulfilled'?normalizeEvents(r.value,game.league,game.path):[])
    const games=eligibleHistory(valid,game,Date.now())
    if(!active)return
    setHistory(games)
    if(!responses.some(r=>r.status==='fulfilled')){setState('Historical source unavailable.');return}
    if(!showPlayers){setState(games.length?'Observed completed games, up to 28 days.':'No matching completed games in the available source window.');return}
    const selected=[...new Map(game.participants.flatMap(p=>games.filter(g=>g.participants.some(t=>t.id===p.id)).slice(0,5)).map(g=>[g.id,g])).values()]
    const boxes=await Promise.allSettled(selected.map(g=>get(endpoint+g.path+'/summary?event='+encodeURIComponent(g.eventId),controller.signal).then(data=>parseBox(data,g,ids))))
    if(!active)return
    setRows(boxes.flatMap(r=>r.status==='fulfilled'?r.value:[]))
    setState('Recorded numeric box-score fields from up to five recent games per participant. Coverage varies; missing fields are not zero.')
   }catch{if(active)setState('Historical source unavailable.')}
  }
  void run();return()=>{active=false;controller.abort()}
 },[game.id,game.path,game.date,game.league,showPlayers])
 const baseline=useMemo(()=>historicalScoreBaseline(history,game),[history,game]);
 const series=useMemo(()=>groupObservations(rows),[rows]);const categories=[...new Set(series.map(s=>s.category))].sort()
 const shown=series.filter(s=>(!stat||s.category===stat)&&(!query||clean(s.name+' '+s.category+' '+(game.participants.find(p=>p.id===s.team)?.name??'')).includes(clean(query))))
 return <section className="panel"><span className="eyebrow gold">OBSERVED GAME RESEARCH</span><h2>{showPlayers?'Recent player box scores':'Recent matchup evidence'}</h2><p role="status">{state}</p><p className="footnote">Unofficial ESPN public source; completed games only, before this matchup. Not odds, projected statistics or calibrated probabilities.</p>
 {!showPlayers&&baseline&&<><h3>Recent scoring baseline</h3><div className="st-kpis">{game.participants.map((p,i)=><div key={p.id}><small>{p.name}</small><strong>{baseline[i]}</strong></div>)}<div><small>Combined</small><strong>{(baseline[0]+baseline[1]).toFixed(2)}</strong></div></div><p className="footnote">Mean of each participant’s scoring and opponent’s scoring allowed over five prior finals. This is an uncalibrated descriptive baseline, not a forecast or betting line.</p></>}
 {!showPlayers?<div className="script-columns">{game.participants.map(p=>{const sample=history.filter(g=>g.participants.some(t=>t.id===p.id)).slice(0,5);const scoring=sample.map(g=>g.participants.find(t=>t.id===p.id)?.score).filter((v):v is number=>v!==null&&v!==undefined);const opposing=sample.map(g=>g.participants.find(t=>t.id!==p.id)?.score).filter((v):v is number=>v!==null&&v!==undefined);return <article key={p.id} className="st-player"><h3>{p.name}</h3><p>{sample.length} completed matches · reported score average {mean(scoring)} · opponent {mean(opposing)}</p>{sample.map(g=><p key={g.id}>{new Date(g.date).toLocaleDateString()} · {g.participants.map(t=>t.name+' '+t.score).join(' / ')}</p>)}</article>})}</div>:<>
 <div className="revamp-filter"><label>PLAYER / TEAM<input value={query} onChange={e=>{setQuery(e.target.value);setLimit(24)}} placeholder="Name or team"/></label><label>OBSERVED STAT<select value={stat} onChange={e=>{setStat(e.target.value);setLimit(24)}}><option value="">All recorded stats</option>{categories.map(s=><option key={s}>{s}</option>)}</select></label></div>
 <div className="st-player-grid">{shown.slice(0,limit).map(s=><article className="st-player" key={s.team+'|'+s.id+'|'+s.category}><small>{game.participants.find(p=>p.id===s.team)?.name} · {s.position||'Position not reported'}</small><h3>{s.name}</h3><p>{s.category} · {s.values.length} observed games · average {mean(s.values.map(v=>v.value))}</p><div className="st-splits">{s.values.map(v=><span key={v.gameId}>{new Date(v.date).toLocaleDateString()}: {v.value}</span>)}</div></article>)}</div>
 {!shown.length&&<p>No supported numeric player box-score fields for this filter. Athlete-level feeds for some sports are incomplete.</p>}{shown.length>limit&&<button className="nav" onClick={()=>setLimit(n=>n+24)}>Show more recorded stats</button>}</>}
 </section>
}
