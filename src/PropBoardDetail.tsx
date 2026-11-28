import {historicalMarket,propGroups} from './analytics/propCatalog'
import {addFootballCombinations} from './analytics/combinedHistory'
import {useEffect,useState} from 'react'
import PlayerResearchCard from './PlayerResearchCard'
import {parseCustomLine,parseAmericanOdds,impliedProbability} from './analytics/customProp'
import {getNBAGamePropValue,NBA_PROP_CATEGORIES,type NBAPlayerGame} from './analytics/nbaData'
import {extractNBAPlayerStats} from './analytics/espnData'
import {parseNFLBoxscore} from './analytics/nflBoxscore'
import {eligibleHistory,parseBox,groupObservations} from './analytics/publicGameEvidence'
import {normalizeEvents,type Fixture,type ScriptSport} from './analytics/scriptSports'
import {normalizedName,type BoardOffer,type RosterPlayer} from './analytics/propBoard'
type Rows={value:number;date:string;gameId?:string}[]
type Hist=Record<string,Rows>
const date=(t:number)=>new Date(t).toISOString().slice(0,10).replaceAll('-','')
async function get(url:string,signal:AbortSignal){const r=await fetch(url,{signal});if(!r.ok)throw Error('Unavailable');return r.json()}
export default function PropBoardDetail({sport,game,offer,side='over',player,requestedStat}:{sport:ScriptSport;game:Fixture;offer?:BoardOffer;side?:'over'|'under';player?:RosterPlayer;requestedStat?:string}){
 const [hist,setHist]=useState<Hist>({}),[status,setStatus]=useState('Loading recorded game history…'),[stat,setStat]=useState(''),[custom,setCustom]=useState(false),[customLine,setCustomLine]=useState(''),[customOdds,setCustomOdds]=useState(''),[customSide,setCustomSide]=useState<'over'|'under'>(side)
 const name=offer?.player??player?.name??''
 const wanted=offer?historicalMarket(sport,offer.market):undefined
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
 if(sport==='NFL'||sport==='NCAAF')addFootballCombinations(result);if(!active)return;setHist(result);setStatus(Object.keys(result).length?'Recorded historical games':available?'No recorded statistics for this player in the available games.':'Historical data source unavailable. Retry or choose another player.')
 }
 void run().catch(()=>{if(active)setStatus('Player history unavailable.')}).finally(()=>clearTimeout(timeout));return()=>{active=false;clearTimeout(timeout);controller.abort()}
 },[sport,game.id,game.path,game.date,name,player?.id])
 const categories=Object.keys(hist).sort(),category=stat||wanted||requestedStat||categories[0]||offer?.category||'Recorded stats'
 const observedLine=offer&&wanted===category&&(sport==='NBA'||sport==='NFL')?offer.line:null
 const observedOdds=observedLine!==null?offer?.[side]?.odds??null:null
 const line=custom?parseCustomLine(customLine):observedLine
 const direction=custom?customSide:side
 const hypotheticalOdds=parseAmericanOdds(customOdds)
 const implied=hypotheticalOdds===null?null:impliedProbability(hypotheticalOdds)
 function resetCustom(){setCustom(false);setCustomLine('');setCustomOdds('');setCustomSide(side)}
 function startCustom(){setCustomLine(observedLine===null?'':String(observedLine));setCustomOdds(observedOdds===null?'':String(observedOdds));setCustomSide(side);setCustom(true)}
 const archived=!!offer&&Date.now()-Date.parse((offer[side]??offer.over??offer.under)?.observedAt??'')>15*60000
 return <div className="prop-inline-detail"><p className="footnote" role="status">{status}</p>{(categories.length>0||requestedStat)&&<label>Stat / prop<select value={category} onChange={e=>{setStat(e.target.value);resetCustom()}}>{Object.entries(propGroups(sport)).map(([group,items])=><optgroup key={group} label={group}>{items.map(c=><option key={c} value={c}>{c}{categories.includes(c)?'':' · no history'}</option>)}</optgroup>)}{[...new Set([category,...categories])].filter(c=>!Object.values(propGroups(sport)).flat().includes(c)).map(c=><option key={c}>{c}</option>)}</select></label>}{offer?.binary&&<p className="footnote">Yes/no market: when the exact event history exists, 1 means yes and 0 means no. The 0.5 analysis threshold separates these outcomes; it is not a quoted sportsbook line.</p>}{offer&&!wanted&&<p className="footnote">Exact historical market mapping unavailable. Recorded statistics are displayed separately, without applying the sportsbook line to another stat.</p>}{hist[category]?.length>0&&<div className="prop-custom"><div className="prop-custom-heading"><button type="button" className="nav" onClick={custom?resetCustom:startCustom}>{custom?'Reset to published line':observedLine===null?'Enter a custom line / odds':'Adjust line / odds'}</button>{custom&&<small>Custom analysis only</small>}</div>{custom&&<><div className="prop-custom-inputs"><label>Prop line<div className="prop-stepper"><button type="button" aria-label="Decrease line by 0.5" onClick={()=>setCustomLine(String((parseCustomLine(customLine)??0)-0.5))}>−</button><input type="number" step="any" value={customLine} onChange={e=>setCustomLine(e.target.value)} placeholder="Enter line"/><button type="button" aria-label="Increase line by 0.5" onClick={()=>setCustomLine(String((parseCustomLine(customLine)??0)+0.5))}>+</button></div></label><label>Direction<select value={customSide} onChange={e=>setCustomSide(e.target.value as 'over'|'under')}><option value="over">Over</option><option value="under">Under</option></select></label><label>American odds (optional)<input type="text" inputMode="text" placeholder="e.g. -110 or +150" value={customOdds} onChange={e=>setCustomOdds(e.target.value)}/></label></div>{customLine.trim()&&line===null&&<p className="footnote">Enter a valid numeric line.</p>}{customOdds.trim()&&hypotheticalOdds===null&&<p className="footnote">Enter American odds of +100 or higher, or -100 or lower.</p>}{implied!==null&&<p className="prop-custom-implied">Implied probability at entered odds: <strong>{implied.toFixed(1)}%</strong></p>}<p className="footnote">The chart and historical hit rates use your custom line and direction. Changing the price only changes the implied probability; it does not change historical results or create a sportsbook offer.</p></>}</div>}{hist[category]?.length?<PlayerResearchCard name={name} category={category} rows={hist[category]} line={line} direction={direction} lineSource={custom?'Custom analysis line':line!==null?offer?.book+(offer?.binary?' · Yes/No analysis threshold':archived?' · expired observed line':' · observed line'):'Verified sportsbook line'}/>:Object.keys(hist).length>0&&<p className="footnote">No recorded observations for this stat. It requires additional source data; no hit rate or chart is invented.</p>}</div>
}
