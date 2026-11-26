import type {ReactNode} from 'react'
import {calculateAverage,calculateRecentHitRates,type Direction} from './analytics/hitRates'
import './PlayerResearchCard.css'
type Row={value:number;date?:string;gameId?:string}
type Props={name:string;category:string;rows:Row[];line:number|null;direction?:Direction;lineSource?:string;defense?:ReactNode;injury?:string;children?:ReactNode}
const windows=['L5','L10','L15','L20'] as const
const fmt=(n:number)=>Number(n.toFixed(2)).toString()
export default function PlayerResearchCard({name,category,rows,line,direction='over',lineSource='Analysis line (not a sportsbook quote)',defense,injury,children}:Props){
 const threshold=line!==null&&Number.isFinite(line)?line:null
 const seen=new Set<string>()
 const valid=rows.filter(r=>{if(!Number.isFinite(r.value)||r.gameId&&seen.has(r.gameId))return false;if(r.gameId)seen.add(r.gameId);return true}).sort((a,b)=>(b.date??'').localeCompare(a.date??''))
 const values=valid.map(r=>r.value)
 const rates=threshold===null?null:calculateRecentHitRates(values,threshold,direction)
 const avg=calculateAverage(values.slice(0,10))
 const recent=valid.slice(0,10).reverse()
 const minimum=Math.min(0,threshold??0,...recent.map(r=>r.value)),maximum=Math.max(1,threshold??0,...recent.map(r=>r.value))
 const y=(n:number)=>18+(maximum-n)/(maximum-minimum)*104
 const barWidth=Math.min(30,288/Math.max(recent.length,1)*.7)
 const result=(v:number)=>threshold===null?'neutral':v===threshold?'push':(direction==='over'?v>threshold:v<threshold)?'hit':'miss'
 return <article className="pr-card" aria-label={name+' '+category+' research'}>
 <div className="pr-kicker">PLAYER RESEARCH</div><div className="pr-name">{name}</div><h3>{category}{threshold!==null?' — '+fmt(threshold):''}</h3>
 <div className="pr-windows">{windows.map(w=>{const n=Number(w.slice(1));const rate=rates?.[w]??null;return <div key={w}><span>{w}</span><strong className={rate===null?'pr-na':rate>=50?'pr-positive':'pr-negative'}>{rate===null?'—':rate+'%'}</strong><small>{threshold===null?'No verified line':values.length<n?values.length+'/'+n+' games':values.slice(0,n).filter(v=>result(v)==='hit').length+'/'+n+' hits'}</small></div>})}</div>
 {recent.length?<><div className="pr-chart"><svg viewBox="0 0 320 153" role="img" aria-label={'Last '+recent.length+' games, oldest to newest'+(threshold===null?'':'; '+direction+' '+threshold)}>{recent.map((r,i)=>{const x=16+(i+.5)*288/recent.length;return <g key={r.gameId??i}><rect className={'pr-bar-'+result(r.value)} x={x-barWidth/2} y={Math.min(y(0),y(r.value))} width={barWidth} height={Math.max(1,Math.abs(y(r.value)-y(0)))} rx="4"><title>{r.date??'Game '+(i+1)}: {r.value} ({result(r.value)})</title></rect><text x={x} y={Math.max(10,y(r.value)-5)} textAnchor="middle" className="pr-value">{fmt(r.value)}</text><text x={x} y="143" textAnchor="middle" className="pr-index">{i+1}</text></g>})}{threshold!==null&&<line x1="9" x2="311" y1={y(threshold)} y2={y(threshold)} className="pr-line"/>}</svg></div><p className="pr-legend">Oldest → newest · {threshold===null?'Recorded values; no verified line.':'Green = hit · Red = miss · Gray = push · Gold = line'}</p></>:<p className="pr-legend">No completed game history available.</p>}
 <div className="pr-summary"><div><span>Recent average</span><strong>{avg===null?'—':avg} {avg!==null&&<small>({Math.min(values.length,10)} games)</small>}</strong></div><div><span>{lineSource}</span><strong>{threshold===null?'Not available':direction+' '+fmt(threshold)}</strong></div><div><span>Opponent defense</span><strong>{defense??'Not verified'}</strong></div><div><span>Projected playing time</span><strong>Not verified</strong></div><div><span>Injury status</span><strong>{injury??'Not verified'}</strong></div></div>
 <p className="pr-legend">Historical hit rates are not future probabilities. Pushes are not hits; incomplete windows are left blank.</p>{children}
 </article>
}
