import type { Fixture } from './scriptSports'
export type Observation={id:string;name:string;team:string;position:string;category:string;value:number;date:string;gameId:string}
export type EvidenceSeries={id:string;name:string;team:string;position:string;category:string;values:{date:string;value:number;gameId:string}[]}
export function eligibleHistory(fixtures:Fixture[],game:Fixture,now:number){
 const cutoff=Math.min(now,Date.parse(game.date))
 const ids=new Set(game.participants.map(p=>p.id))
 return [...new Map(fixtures.filter(g=>g.id!==game.id&&g.state==='post'&&Date.parse(g.date)<cutoff&&g.participants.some(p=>ids.has(p.id))&&g.participants.every(p=>p.score!==null)).map(g=>[g.id,g])).values()].sort((a,b)=>b.date.localeCompare(a.date))
}
export function parseBox(payload:any,game:Fixture,ids:Set<string>):Observation[]{
 const out:Observation[]=[]
 for(const group of Array.isArray(payload?.boxscore?.players)?payload.boxscore.players:[]){
  const team=String(group.team?.id??'')
  if(!ids.has(team))continue
  for(const section of Array.isArray(group.statistics)?group.statistics:[]){
   const labels=Array.isArray(section.labels)?section.labels:Array.isArray(section.names)?section.names:[]
   for(const row of Array.isArray(section.athletes)?section.athletes:[]){
    if(row.didNotPlay||row.inactive||!row.athlete?.id||!row.athlete?.displayName||!Array.isArray(row.stats))continue
    for(let i=0;i<labels.length;i++){
     const raw=row.stats[i];const label=String(labels[i]??'').trim()
     // Keep the provider's exact label and group. Never split composite strings or coerce missing cells.
     if(!label||typeof raw!=='string'&&typeof raw!=='number'||!/^[-+]?\d+(\.\d+)?$/.test(String(raw).trim()))continue
     const value=Number(raw);if(!Number.isFinite(value))continue
     const prefix=String(section.name??section.type??'').trim()
     out.push({id:String(row.athlete.id),name:String(row.athlete.displayName),team,position:String(row.athlete.position?.abbreviation??row.position?.abbreviation??''),category:prefix?prefix+' · '+label:label,value,date:game.date,gameId:game.id})
    }
   }
  }
 }
 return out
}
export function groupObservations(rows:Observation[]):EvidenceSeries[]{
 const result=new Map<string,EvidenceSeries>()
 for(const row of rows){
  const key=[row.team,row.id,row.category].join('|')
  if(!result.has(key))result.set(key,{id:row.id,name:row.name,team:row.team,position:row.position,category:row.category,values:[]})
  const series=result.get(key)!
  if(!series.values.some(v=>v.gameId===row.gameId))series.values.push({date:row.date,value:row.value,gameId:row.gameId})
 }
 return [...result.values()].map(s=>({...s,values:s.values.sort((a,b)=>b.date.localeCompare(a.date))})).sort((a,b)=>b.values.length-a.values.length||a.name.localeCompare(b.name)||a.category.localeCompare(b.category))
}
