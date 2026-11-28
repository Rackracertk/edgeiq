import PlayerBrowser from './PlayerBrowser'
import PlayerResearchCard from './PlayerResearchCard'
import {useEffect,useMemo,useState} from 'react'
import {normalizeEvents,type Fixture} from './analytics/scriptSports'
import {eligibleHistory,parseBox,groupObservations,historicalScoreBaseline,matchupNarrative,baselineBacktest,phaseEvidence,conditionalGameFlow,type Observation} from './analytics/publicGameEvidence'
const endpoint='https://site.api.espn.com/apis/site/v2/sports/'
async function get(url:string,signal:AbortSignal){const r=await fetch(url,{signal});if(!r.ok)throw Error('Source HTTP '+r.status);return r.json()}
const date=(n:number)=>new Date(n).toISOString().slice(0,10).replaceAll('-','')
const mean=(values:number[])=>values.length?(values.reduce((a,b)=>a+b,0)/values.length).toFixed(2):'—'
export default function PublicGameEvidence({game,showPlayers,narrative=false,accuracy=false}:{game:Fixture;showPlayers:boolean;narrative?:boolean;accuracy?:boolean}){
 const [leagueHistory,setLeagueHistory]=useState<Fixture[]>([])
 const [history,setHistory]=useState<Fixture[]>([]);const [rows,setRows]=useState<Observation[]>([]);const [state,setState]=useState('Loading observed results…');const [stat,setStat]=useState('');const [selectedPlayer,setSelectedPlayer]=useState('')
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
    setHistory(games);setLeagueHistory(valid)
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
 const story=useMemo(()=>matchupNarrative(history,game,Date.now()),[history,game]);
 const flow=useMemo(()=>conditionalGameFlow(history,game,Date.now()),[history,game]);
 const observedPhases=useMemo(()=>phaseEvidence(history,game,Date.now()),[history,game]);
 const validation=useMemo(()=>accuracy?baselineBacktest(leagueHistory,game,Date.now()):null,[accuracy,leagueHistory,game]);
 const kind=game.path.split('/')[0];
 const phases:Record<string,[string,string][]>={
 football:[['Q1','Opening drives: early-down efficiency and possession.'],['Q2','Defensive adjustments and scoring opportunities before halftime.'],['Q3','Halftime adjustments; a deficit can shift play calling toward passing.'],['Q4','Clock management, turnovers and score-dependent rushing or passing volume.']],
 basketball:game.path.includes('mens-college')?[['1H','Opening rotations, pace, shot distribution and fouls.'],['2H','Halftime adjustments, bench usage and closing rotations.']]:[['Q1','Opening rotation, shot distribution and early fouls.'],['Q2','Bench rotations and pace before halftime.'],['Q3','Halftime adjustments and changes in usage.'],['Q4','Close games may preserve starters; a large margin may shorten minutes.']],
 baseball:[['1–3','Starter command and early baserunners.'],['4–6','Pitching changes and hitter matchups.'],['7–9','Bullpen availability and score margin.']],
 hockey:[['P1','Shot volume and early penalties.'],['P2','Special teams and tactical adjustments.'],['P3','Trailing teams may increase shots; an empty net can alter scoring.']],
 soccer:[['1H','Possession, chances and defensive shape.'],['2H','Substitutions, cards and score-dependent attacking volume.']],
 tennis:[['SET 1','Service holds and break chances.'],['LATER','Fatigue and return effectiveness.']],
 mma:[['R1','Early striking versus grappling establishes the pace.'],['LATER','Sustained pressure and fatigue may alter volume; a finish ends the action.']]
 };

 const series=useMemo(()=>groupObservations(rows),[rows]);const directory=useMemo(()=>[...new Map(series.map(s=>[s.id,{id:s.id,name:s.name,team:game.participants.find(p=>p.id===s.team)?.name,position:s.position}])).values()].sort((a,b)=>a.name.localeCompare(b.name)),[series,game]);useEffect(()=>{if(directory.length&&!directory.some(p=>p.id===selectedPlayer))setSelectedPlayer(directory[0].id)},[directory,selectedPlayer])
 const playerSeries=series.filter(s=>s.id===selectedPlayer);const categories=[...new Set(playerSeries.map(s=>s.category))].sort();const selectedStat=categories.includes(stat)?stat:categories[0];const shown=playerSeries.filter(s=>s.category===selectedStat).slice(0,1)
 return <section className="panel"><span className="eyebrow gold">OBSERVED GAME RESEARCH</span><h2>{accuracy?'Accuracy Tracker':showPlayers?'Recent player box scores':'Recent matchup evidence'}</h2><p role="status">{state}</p><p className="footnote">Unofficial ESPN public source; completed games only, before this matchup. Not odds, projected statistics or calibrated probabilities.</p>
 {validation&&<div className="st-narrative"><h3>Historical baseline evaluation</h3><p>{validation.samples} qualifying completed games · mean absolute score error {validation.mae===null?'Unavailable':validation.mae.toFixed(2)}</p><p className="footnote">Reconstructed using earlier completed games only. Limited 28-day sample, not an archived forecast ledger or betting returns. All qualifying results are included.</p><details><summary>View evaluated games</summary>{validation.examples.map(r=><p key={r.id}>{r.names.join(' vs ')} · baseline {r.baseline.join(' – ')} · actual {r.actual.join(' – ')} · error {r.error.toFixed(2)}</p>)}</details></div>}
 {!showPlayers&&narrative&&<div className="st-narrative"><span className="eyebrow gold">THE GAME SCRIPT</span><h3>{game.state==='post'?'What the pregame evidence showed':game.state==='in'?'Game in progress — context':'Pregame outlook'}</h3>{story.rows.every(r=>r.n>0)?<p>{story.rows.map(r=>r.name+' won '+r.wins+' of '+r.n+' observed matches'+(r.scored!==null?' and averaged '+r.scored.toFixed(1)+' reported score units':'')).join('; ')}. {story.baseline?'The recent scoring baseline is '+story.baseline.map((v,i)=>story.rows[i].name+' '+v).join(' – ')+'. This is a descriptive estimate, not a predicted result.':'There is not enough comparable history for a numerical baseline.'}</p>:<p>Comparable recent history is incomplete. A game-specific forecast cannot be responsibly established.</p>}{story.latest&&<p>Most recent observed meeting: {story.latest.participants.map(p=>p.name+' '+p.score).join(' – ')}.</p>}{flow&&<><h3>What the matchup suggests</h3><p>{flow.context} {flow.scenario}</p><p className="footnote">{flow.reversal}</p></>}<h3>Projected game flow — conditional scenarios</h3>{observedPhases.some(p=>p.teams.every(t=>t.n>=3))&&<details><summary>Recent scoring by phase</summary><div className="table-wrap"><table><thead><tr><th>Phase</th>{game.participants.map(p=><th key={p.id}>{p.name}</th>)}</tr></thead><tbody>{observedPhases.map(p=><tr key={p.phase}><td>{p.phase}</td>{p.teams.map(t=><td key={t.name}>{t.n>=3?t.mean?.toFixed(1)+' ('+t.n+' games)':'Insufficient history'}</td>)}</tr>)}</tbody></table></div><p className="footnote">Recorded period scoring, not a projected period score.</p></details>}{(phases[kind]??[['EARLY','Watch early results and score changes.'],['LATER','Availability and adjustments can change the outcome.']]).map(([label,description])=><div className="st-story-phase" key={label}><span>{label}</span><p>{description}</p></div>)}<h3>What could change the script?</h3><p>Unexpected injuries, score changes, tactical adjustments and the available player roles can invalidate the scenario.</p><p className="footnote">These are conditional sport-specific scenarios, not confirmed future actions. No insider access or guaranteed results.</p></div>}
 {!showPlayers&&baseline&&<><h3>Recent scoring baseline</h3><div className="st-kpis">{game.participants.map((p,i)=><div key={p.id}><small>{p.name}</small><strong>{baseline[i]}</strong></div>)}<div><small>Combined</small><strong>{(baseline[0]+baseline[1]).toFixed(2)}</strong></div></div><p className="footnote">Mean of each participant’s scoring and opponent’s scoring allowed over five prior finals. This is an uncalibrated descriptive baseline, not a forecast or betting line.</p></>}
 {!showPlayers?<div className="script-columns">{game.participants.map(p=>{const sample=history.filter(g=>g.participants.some(t=>t.id===p.id)).slice(0,5);const scoring=sample.map(g=>g.participants.find(t=>t.id===p.id)?.score).filter((v):v is number=>v!==null&&v!==undefined);const opposing=sample.map(g=>g.participants.find(t=>t.id!==p.id)?.score).filter((v):v is number=>v!==null&&v!==undefined);return <article key={p.id} className="st-player"><h3>{p.name}</h3><p>{sample.length} completed matches · reported score average {mean(scoring)} · opponent {mean(opposing)}</p>{sample.map(g=><p key={g.id}>{new Date(g.date).toLocaleDateString()} · {g.participants.map(t=>t.name+' '+t.score).join(' / ')}</p>)}</article>})}</div>:<>
 <PlayerBrowser players={directory} selectedId={selectedPlayer} onSelect={p=>{setSelectedPlayer(String(p.id));setStat('')}} loading={state.includes('Loading')} title="Matchup players"/>
 {categories.length>0&&<div className="revamp-filter"><label>Recorded stat<select value={selectedStat} onChange={e=>setStat(e.target.value)}>{categories.map(s=><option key={s}>{s}</option>)}</select></label></div>}
 <div className="st-player-grid">{shown.map(s=><PlayerResearchCard key={s.team+'|'+s.id+'|'+s.category} name={s.name} category={s.category} rows={s.values} line={null} lineSource="Verified sportsbook line"><details><summary>Game log · {s.values.length} observations</summary><p>{game.participants.find(p=>p.id===s.team)?.name} · {s.position||'Position not reported'}</p>{s.values.map(v=><p key={v.gameId}>{new Date(v.date).toLocaleDateString()}: {v.value}</p>)}</details></PlayerResearchCard>)}</div>
 {!shown.length&&<p>No supported numeric player box-score fields for this filter. Athlete-level feeds for some sports are incomplete.</p>}</>}
 </section>
}
