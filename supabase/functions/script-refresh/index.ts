import {adminRequest,requireEnv} from '../_shared/core.ts'
import {sports,validSnapshot} from '../_shared/script-model.ts'
function equal(a:string,b:string){let n=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)n|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return n===0}
Deno.serve(async req=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405})
 try{
  if(!equal(req.headers.get('x-edgeiq-refresh-key')??'',requireEnv('RESEARCH_REFRESH_SECRET')))return new Response('Forbidden',{status:403})
  if(Deno.env.get('SPORTS_LICENSE_APPROVED')!=='true')return new Response('Licensing not confirmed',{status:503})
  const {sport}=await req.json();if(!sports.includes(sport))return new Response('Invalid sport',{status:400})
  const endpoint=new URL(requireEnv('SCRIPT_DATA_FEED_'+sport));if(endpoint.protocol!=='https:')return new Response('HTTPS required',{status:503})
  const res=await fetch(endpoint,{headers:{Authorization:'Bearer '+requireEnv('SPORTS_DATA_API_KEY')},signal:AbortSignal.timeout(20000),redirect:'error'})
  if(!res.ok)throw Error('Provider unavailable')
  const snapshots=await res.json();const now=Date.now()
  if(!Array.isArray(snapshots)||snapshots.length>300||!snapshots.every(s=>validSnapshot(s)&&s.sport===sport&&Date.parse(s.observedAt)<=now+60000&&now-Date.parse(s.observedAt)<6*3600000))return new Response('Invalid or stale provider payload',{status:422})
  const unique=[...new Map(snapshots.sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt)).map(s=>[s.league+'|'+s.eventId,s])).values()]
  for(const s of unique)await adminRequest('edgeiq_script_cache?on_conflict=sport,league,event_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({sport,league:s.league,event_id:s.eventId,payload:s,source_label:requireEnv('SPORTS_DATA_SOURCE_LABEL'),refreshed_at:new Date().toISOString()})})
  return Response.json({sport,refreshed:unique.length})
 }catch(e){console.error('Script refresh failed',e instanceof Error?e.message:'unknown');return new Response('Refresh failed',{status:503})}
})
