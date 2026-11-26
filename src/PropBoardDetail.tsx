import {useEffect,useState} from 'react'
import PlayerResearchCard from './PlayerResearchCard'
import {getNBAGamePropValue,NBA_PROP_CATEGORIES,type NBAPlayerGame} from './analytics/nbaData'
import {extractNBAPlayerStats} from './analytics/espnData'
import {parseNFLBoxscore} from './analytics/nflBoxscore'
import {eligibleHistory,parseBox,groupObservations} from './analytics/publicGameEvidence'
import {normalizeEvents,type Fixture,type ScriptSport} from './analytics/scriptSports'
import {nbaCategory,nflCategory,normalizedName,type BoardOffer,type RosterPlayer} from './analytics/propBoard'
type Rows={value:number;date:string;gameId?:string}[]
type Hist=Record<string,Rows>
const date=(t:number)=>new Date(t).toISOString().slice(0,10).replaceAll('-','')
async function get(url:string,signal:AbortSignal){const r=await fetch(url,{signal});if(!r.ok)throw Error('Unavailable');return r.json()}
export default function PropBoardDetail({sport,game,offer,side='over',player}:{sport:ScriptSport;game:Fixture;offer?:BoardOffer;side?:'over'|'under';player?:RosterPlayer}){
 const [hist,setHist]=useState<Hist>({}),[status,setStatus]=useState('Loading recorded game history…'),[stat,setStat]=useState('')
 const name=offer?.player??player?.name??''
 const wanted=offer?(sport==='NBA'?nbaCategory[offer.market]:sport==='NFL'?nflCategory[offer.market]:undefined):undefined
 useEffect(()=>{let active=true;const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),25000)
 const run=async()=>{
 setHist({});setStatus('Loading recorded game history…');const cutoff=Math.min(Date.now(),Date.parse(game.date)),result:Hist={};let available=false
 const push=(cat:string,value:number,date:string,gameId?:string)=>{if(Number.isFinite(value)&&Date.parse(date)<cutoff){(result[cat]??=[]).push({value,date,gameId})}}
 if(sport==='NBA'){try{const data=await get('/edgeiq-nba-history.json',controller.signal);if(data.schemaVersion===1){available=true;const matches=(data.players??[]).filter((p:{id:string;name:string})=>normalizedName(p.name)===normalizedName(name));const id=player?.id??(matches.length===1?String(matches[0].id):'');const games: NBAPlayerGame[]=data.history?.[id]??[];if(Array.isArray(games))for(const g of games)for(const cat of NBA_PROP_CATEGORIES){const value=getNBAGamePropValue(g,cat);if(value!==null)push(cat,value,g.date,g.gameId)}}}catch{}}
 if(sport==='NFL'){try{const data=await get('/edgeiq-nfl-history.json',controller.signal);if(data.schemaVersion===1&&data.players){available=true;const records=Object.entries(data.players) as [string,{name:string;games:{date:string;gameId:string;stats:Record<string,number>}[]}][];const matches=records.filter(([,p])=>normalizedName(p.name)===normalizedName(name));const id=player?.id??(matches.length===1?matches[0][0]:'');for(const g of data.players[id]?.games??[])for(const [cat,v] of Object.entries(g.stats as Record<string,number>))push(cat,v,g.date,g.gameId)}}catch{}}
 if(!Object.keys(result).length){
  const root='https://site.api.espn.com/apis/site/v2/sports/'+game.path
  const intervals=Array.from({length:4},(_,i)=>[date(cutoff-(i+1)*7*86400000),date(cutoff-i*7*86400000)])
  let response=await Promise.allSettled((sport==='NFL'?[String(new Date(cutoff).getUTCMonth()>=7?new Date(cutoff).getUTCFullYear():new Date(cutoff).getUTCFullYear()-1)+'&seasontype=2&limit=300']:intervals.map(([a,b])=>a+'-'+b+'&limit=1000')).map(q=>get(root+'/scoreboard?dates='+q,controller.signal)))
  const extract=()=>eligibleHistory(response.flatMap(r=>r.status==='fulfilled'?normalizeEvents(r.value,game.league,game.path):[]),game,Date.now())
  let eligible=extract()
  if(!eligible.length&&sport==='NFL'){
   const days=Array.from({length:35},(_,i)=>date(cutoff-(i+1)*86400000))
   for(let i=0;i<days.length;i+=7){if(controller.signal.aborted)break;const r=await Promise.allSettled(days.slice(i,i+7).map(d=>get(root+'/scoreboard?dates='+d+'&limit=100',controller.signal)));response=[...response,...r]}
   eligible=extract()
  }
  available=available||response.some(r=>r.status==='fulfilled')
  const teams=player?[player.teamId]:game.participants.map(p=>p.id),samples=[...new Map(teams.flatMap(t=>eligible.filter(g=>g.participants.some(p=>p.id===t)).slice(0,5)).map(g=>[g.id,g])).values()]
  const boxes=await Promise.allSettled(samples.map(async g=>({g,data:await get(root+'/summary?event='+encodeURIComponent(g.eventId),controller.signal)})))
  const rows=boxes.flatMap(b=>b.status==='fulfilled'?[b.value]:[])
  if(sport==='NBA'){for(const {g,data} of rows)for(const p of extractNBAPlayerStats(data.boxscore?.players??[])){if(player?p.id!==player.id:normalizedName(p.name)!==normalizedName(name))continue;for(const cat of NBA_PROP_CATEGORIES){const v=getNBAGamePropValue({...p,date:g.date,gameId:g.id},cat);if(v!==null)push(cat,v,g.date,g.id)}}}
  else if(sport==='NFL'){for(const {g,data} of rows)for(const p of parseNFLBoxscore(data,{id:g.id,date:g.date})){if(player?p.playerId!==player.id:normalizedName(p.player)!==normalizedName(name))continue;for(const [cat,v] of Object.entries(p.stats))push(cat,v,p.date,p.gameId)}}
  else {const series=groupObservations(rows.flatMap(({g,data})=>parseBox(data,g,new Set(teams))));const matching=series.filter(s=>player?s.id===player.id:normalizedName(s.name)===normalizedName(name));if(new Set(matching.map(s=>s.id)).size===1)for(const s of matching)for(const v of s.values)push(s.category,v.value,v.date,v.gameId)}
 }
 if(!active)return;setHist(result);setStatus(Object.keys(result).length?'Recorded historical games':available?'No recorded statistics for this player in the available games.':'Historical data source unavailable. Retry or choose another player.')
 }
 void run().catch(()=>{if(active)setStatus('Player history unavailable.')}).finally(()=>clearTimeout(timeout));return()=>{active=false;clearTimeout(timeout);controller.abort()}
 },[sport,game.id,game.path,game.date,name,player?.id])
 const categories=Object.keys(hist).sort(),category=wanted??(categories.includes(stat)?stat:categories[0]??offer?.category??'Recorded stats')
 const line=offer&&wanted===category?offer.line:null
 const archived=!!offer&&Date.now()-Date.parse((offer[side]??offer.over??offer.under)?.observedAt??'')>15*60000
 return <div className="prop-inline-detail"><p className="footnote" role="status">{status}</p>{!wanted&&categories.length>0&&<label>Recorded stat<select value={category} onChange={e=>setStat(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>}{offer&&!wanted&&<p className="footnote">Exact historical market mapping unavailable. Recorded statistics are displayed separately, without applying the sportsbook line to another stat.</p>}{hist[category]?.length?<PlayerResearchCard name={name} category={category} rows={hist[category]} line={line} direction={side} lineSource={line!==null?offer?.book+(archived?' · expired observed line':' · observed line'):'Verified sportsbook line'}/>:Object.keys(hist).length>0&&<p className="footnote">No recorded observations for this exact market.</p>}</div>
}
