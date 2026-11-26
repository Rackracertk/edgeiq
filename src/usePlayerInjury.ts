import {useEffect,useState} from 'react'
import {loadInjuryReport} from './analytics/injuryCenter'
import {findInjury} from './analytics/injuryStatus'
export function usePlayerInjury(sport:'NBA'|'NFL',playerId:string|undefined,name:string|undefined,team:string|undefined){
 const [result,setResult]=useState<{id:string;status:string}|null>(null)
 useEffect(()=>{let active=true;setResult(null);if(!playerId||!name)return;void loadInjuryReport(sport).then(r=>{if(!active||!r.available||Date.now()-Date.parse(r.checkedAt)>15*60000||!Number.isFinite(Date.parse(r.checkedAt)))return;const item=findInjury(r.injuries,playerId,name,team??'');setResult({id:playerId,status:item?.status??'No listing; availability unconfirmed'})}).catch(()=>{});return()=>{active=false}},[sport,playerId,name,team])
 return result?.id===playerId?result.status:undefined
}
