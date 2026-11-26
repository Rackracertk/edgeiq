// Deterministic observed evidence. No future probabilities until calibrated.
export const sports=['NBA','NFL','MLB','NHL','NCAAF','NCAAB','WNBA','SOCCER','TENNIS','MMA']
export const modelVersion='script-evidence-1'
export type Log={gameId:string;date:string;value:number;opponentId?:string;homeAway?:string;minutes?:number}
export type Quote={book:string;market:string;category:string;participantId:string;participant:string;side:string;line:number|null;odds:number|null;observedAt:string;openingLine?:number;openingObservedAt?:string;openingOdds?:number}
export type Player={id:string;name:string;teamId:string;position:string;headshot?:string;category:string;logs:Log[];injury?:string;role?:string}
export type Past={id:string;date:string;aId:string;bId:string;aScore:number;bScore:number}
export type Snapshot={schemaVersion:1;sport:string;league:string;eventId:string;startsAt:string;observedAt:string;participants:{id:string;name:string}[];completed:Past[];players:Player[];quotes:Quote[];injuries?:{playerId:string;name:string;status:string;observedAt:string;note?:string}[];context?:{label:string;value:string;observedAt:string}[];live?:{observedAt:string;status:string;period:string;scores:number[]};}
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)
const str=(s:unknown):s is string=>typeof s==='string'&&s.length>0&&s.length<=240
const time=(s:unknown)=>str(s)&&Number.isFinite(Date.parse(s))
const recent=(s:string,now:number,age:number)=>Date.parse(s)<=now+60000&&now-Date.parse(s)<=age
const round=(x:number)=>Math.round(x*100)/100
const mean=(xs:number[])=>xs.length?round(xs.reduce((a,b)=>a+b,0)/xs.length):null
export function entitled(row:{status:string;current_period_end:string|null}|undefined,now=Date.now()){return !!row&&['active','trialing'].includes(row.status)&&!!row.current_period_end&&Date.parse(row.current_period_end)>now}
export function validSnapshot(x:any):x is Snapshot{
 if(!x||x.schemaVersion!==1||!sports.includes(x.sport)||!str(x.league)||!str(x.eventId)||!time(x.startsAt)||!time(x.observedAt)||!Array.isArray(x.participants)||x.participants.length!==2||!x.participants.every((p:any)=>str(p.id)&&str(p.name))||x.participants[0].id===x.participants[1].id)return false
 return Array.isArray(x.completed)&&x.completed.length<=5000&&x.completed.every((g:any)=>str(g.id)&&time(g.date)&&str(g.aId)&&str(g.bId)&&g.aId!==g.bId&&finite(g.aScore)&&g.aScore>=0&&finite(g.bScore)&&g.bScore>=0)
 &&Array.isArray(x.players)&&x.players.length<=3000&&x.players.every((p:any)=>str(p.id)&&str(p.name)&&str(p.teamId)&&str(p.category)&&typeof p.position==='string'&&Array.isArray(p.logs)&&p.logs.length<=500&&p.logs.every((l:any)=>str(l.gameId)&&time(l.date)&&finite(l.value)))
 &&Array.isArray(x.quotes)&&x.quotes.length<=10000&&x.quotes.every((q:any)=>str(q.book)&&str(q.market)&&str(q.category)&&typeof q.participantId==='string'&&typeof q.participant==='string'&&str(q.side)&&(q.line===null||finite(q.line))&&(q.odds===null||Number.isInteger(q.odds)&&Math.abs(q.odds)>=100)&&time(q.observedAt))
 &&(x.injuries===undefined||Array.isArray(x.injuries)&&x.injuries.length<=300&&x.injuries.every((i:any)=>str(i.playerId)&&str(i.name)&&str(i.status)&&time(i.observedAt)))
 &&(x.context===undefined||Array.isArray(x.context)&&x.context.length<=100&&x.context.every((c:any)=>str(c.label)&&str(c.value)&&time(c.observedAt)))
 &&(x.live===undefined||time(x.live.observedAt)&&str(x.live.status)&&typeof x.live.period==='string'&&Array.isArray(x.live.scores)&&x.live.scores.length===2&&x.live.scores.every((v:unknown)=>finite(v)&&v>=0))
}
export function uniqueLogs(logs:Log[],before:number){return [...new Map(logs.filter(l=>finite(l.value)&&Date.parse(l.date)<before).map(l=>[l.gameId,l])).values()].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date))}
export function summarize(logs:Log[],line:number|null,side:string){const values=logs.map(l=>l.value);const avg=mean(values);return {games:logs.length,average:avg,hits:line===null||!['over','under'].includes(side)?null:values.filter(v=>side==='over'?v>line:v<line).length,pushes:line===null?null:values.filter(v=>v===line).length,sd:avg===null?null:round(Math.sqrt(values.reduce((s,v)=>s+(v-avg)**2,0)/values.length))}}
export function scoreEvidence(logs:Log[],injury:string,quote:boolean){const sample=Math.min(30,logs.length*1.5);const recent=logs.slice(0,10);const m=summarize(recent,null,'');const consistency=m.average!==null&&m.sd!==null&&recent.length>=5?Math.max(0,20*(1-Math.min(1,m.sd/Math.max(1,Math.abs(m.average))))):0;const role=logs.filter(l=>finite(l.minutes)).length>=5?15:0;const availability=/^(active|available|healthy)$/i.test(injury)?15:0;const market=quote?20:0;const parts={sample:round(sample),consistency:round(consistency),playingTimeCoverage:role,confirmedAvailability:availability,currentMarket:market};return {score:Math.round(Object.values(parts).reduce((a,b)=>a+b,0)),parts}}
function pastFor(games:Past[],id:string){return games.filter(g=>g.aId===id||g.bId===id).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date))}
function form(games:Past[],id:string){const rows=pastFor(games,id).slice(0,10);const points=rows.map(g=>g.aId===id?[g.aScore,g.bScore]:[g.bScore,g.aScore]);return {games:rows.length,scored:mean(points.map(p=>p[0])),allowed:mean(points.map(p=>p[1])),wins:points.filter(p=>p[0]>p[1]).length,draws:points.filter(p=>p[0]===p[1]).length,restFrom:rows[0]?.date??null}}
function baseline(games:Past[],a:string,b:string){const x=form(games,a),y=form(games,b);return x.games>=5&&y.games>=5&&x.scored!==null&&y.scored!==null&&x.allowed!==null&&y.allowed!==null?[round((x.scored+y.allowed)/2),round((y.scored+x.allowed)/2)]:null}
export function buildReport(s:Snapshot,now=Date.now()){
 const before=Math.min(now,Date.parse(s.startsAt));const games=[...new Map(s.completed.filter(g=>Date.parse(g.date)<before&&g.id!==s.eventId).map(g=>[g.id,g])).values()]
 const [a,b]=s.participants;const combat=['MMA','TENNIS'].includes(s.sport);const projection=combat?null:baseline(games,a.id,b.id)
 const validation:{samples:number;mae:number|null}={samples:0,mae:null};const errors:number[]=[]
 if(!combat){for(const g of games.slice().sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,200)){const p=baseline(games.filter(h=>Date.parse(h.date)<Date.parse(g.date)),g.aId,g.bId);if(p)errors.push((Math.abs(p[0]-g.aScore)+Math.abs(p[1]-g.bScore))/2)}validation.samples=errors.length;validation.mae=mean(errors)}
 const quotes=[...new Map(s.quotes.filter(q=>recent(q.observedAt,now,15*60000)).sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt)).map(q=>[[q.book,q.market,q.category,q.participantId,q.participant,q.side,q.line].join('|'),q])).values()]
 const injuries=(s.injuries??[]).filter(i=>recent(i.observedAt,now,15*60000))
 const players=[...new Map(s.players.map(p=>[p.id+'|'+p.category,p])).values()].filter(p=>[a.id,b.id].includes(p.teamId)).map(p=>{
  const logs=uniqueLogs(p.logs,before);const opp=p.teamId===a.id?b.id:a.id;const injury=injuries.find(i=>i.playerId===p.id)?.status??'Unverified';const offers=quotes.filter(q=>q.participantId===p.id&&q.category===p.category&&q.line!==null&&['over','under'].includes(q.side.toLowerCase()))
  const history=logs.slice(0,20);const estimate=logs.length>=10?mean(logs.slice(0,10).map(l=>l.value)):null
  const markets=offers.map(q=>{const side=q.side.toLowerCase();const splits=Object.fromEntries([5,10,15,20].map(n=>['L'+n,summarize(logs.slice(0,n),q.line,side)]));return {quote:q,splits,observed:summarize(logs,q.line,side),home:summarize(logs.filter(l=>l.homeAway==='home'),q.line,side),away:summarize(logs.filter(l=>l.homeAway==='away'),q.line,side),h2h:summarize(logs.filter(l=>l.opponentId===opp),q.line,side),difference:estimate===null||q.line===null?null:round(estimate-q.line)}})
  return {id:p.id,name:p.name,teamId:p.teamId,position:p.position,category:p.category,history,observed:summarize(logs,null,''),estimate,markets,injury,minutes:mean(logs.slice(0,10).flatMap(l=>finite(l.minutes)?[l.minutes]:[])),intelligence:scoreEvidence(logs,injury,offers.length>0)}
 }).filter(p=>p.observed.games>0||p.markets.length>0)
 return {modelVersion,observedAt:s.observedAt,startsAt:s.startsAt,participants:s.participants,form:[form(games,a.id),form(games,b.id)],projection,validation,probability:null,players,quotes,injuries,context:(s.context??[]).filter(c=>recent(c.observedAt,now,24*3600000)),live:s.live&&recent(s.live.observedAt,now,120000)?s.live:null}
}
