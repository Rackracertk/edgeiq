import {adminRequest,authorizedUser,preflight,respond} from '../_shared/core.ts'
import {buildReport,entitled,sports,validSnapshot} from '../_shared/script-model.ts'
Deno.serve(async req=>{
 const blocked=preflight(req);if(blocked)return blocked
 if(req.method!=='POST')return respond(req,{error:'Method not allowed'},405)
 let user;try{user=await authorizedUser(req)}catch{return respond(req,{error:'Sign in required'},401)}
 try{
  const rows=await adminRequest('subscriptions?user_id=eq.'+encodeURIComponent(user.id)+'&select=status,current_period_end') as {status:string;current_period_end:string|null}[]
  if(!entitled(rows[0]))return respond(req,{error:'Active EDGEIQ Pro subscription required'},403)
  if(Deno.env.get('SPORTS_LICENSE_APPROVED')!=='true')return respond(req,{error:'Licensed Script feed is not enabled'},503)
  const input=await req.json();const {sport,league,eventId}=input??{}
  if(!sports.includes(sport)||typeof league!=='string'||league.length>100||typeof eventId!=='string'||!/^[\w:-]{1,100}$/.test(eventId))return respond(req,{error:'Invalid matchup'},400)
  const query=new URLSearchParams({sport:'eq.'+sport,league:'eq.'+league,event_id:'eq.'+eventId,select:'payload,source_label,refreshed_at'})
  const cached=await adminRequest('edgeiq_script_cache?'+query.toString()) as {payload:unknown;source_label:string;refreshed_at:string}[]
  const row=cached[0];if(!row||!validSnapshot(row.payload)||Date.now()-Date.parse(row.refreshed_at)>6*3600000||Date.now()-Date.parse(row.payload.observedAt)>6*3600000||Date.parse(row.payload.observedAt)>Date.now()+60000)return respond(req,{error:'No fresh licensed intelligence snapshot for this matchup'},503)
  if(row.payload.sport!==sport||row.payload.league!==league||row.payload.eventId!==eventId)return respond(req,{error:'Snapshot identity mismatch'},503)
  return respond(req,{...buildReport(row.payload),source:row.source_label,refreshedAt:row.refreshed_at})
 }catch(e){console.error('Script report failed',e);return respond(req,{error:'Script intelligence temporarily unavailable'},503)}
})
