const CRON_KEY_SHA256='19216d307f28f435f54ef4327e3ab56c73cd027c9fff297ffba8d2299db6a1ee'
const SOURCES={NBA:'basketball/nba',NFL:'football/nfl'}
type Sport='NBA'|'NFL'
const str=(v:unknown)=>typeof v==='string'?v.trim():typeof v==='number'?String(v):''
function todayET():string {
 const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date())
 const g=(k:string)=>p.find(x=>x.type===k)?.value??''
 return g('year')+'-'+g('month')+'-'+g('day')
}
function plusDay(date:string,offset:number):string {
 const [y,m,d]=date.split('-').map(Number)
 return new Date(Date.UTC(y,m-1,d+offset)).toISOString().slice(0,10)
}
async function fetchESPN(sport:Sport,path:string):Promise<any>{
 const controller=new AbortController()
 const timer=setTimeout(()=>controller.abort(),8500)
 try {
  const response=await fetch('https://site.api.espn.com/apis/site/v2/sports/'+SOURCES[sport]+path,{signal:controller.signal,headers:{Accept:'application/json'}})
  if(!response.ok)throw Error('ESPN '+response.status)
  return await response.json()
 }finally{clearTimeout(timer)}
}
function parseInjuries(data:any):any[]{
 const rows:any[]=[]
 for(const g of Array.isArray(data?.injuries)?data.injuries:[]){
  const groupTeam=g?.team??{}
  for(const x of Array.isArray(g?.injuries)?g.injuries:(g?.athlete?[g]:[])){
   const athlete=x?.athlete??x?.player??{}
   const team=x?.team??groupTeam
   const playerId=str(athlete.id)
   const player=str(athlete.displayName||athlete.fullName||athlete.name)
   const status=str(typeof x.status==='string'?x.status:(x.status?.name||x.status?.description||x.status?.type||x.fantasyStatus?.name))
   if((!playerId&&!player)||!status)continue
   const reason=str(x.type?.name||x.type?.description||x.details?.type||x.details?.detail||x.injury?.description)
   const note=str(x.details?.shortComment||x.details?.description||x.shortComment||x.details?.detail)
   rows.push({playerId,player,teamId:str(team.id),team:str(team.abbreviation),status,reason,note:note.slice(0,240),updatedAt:str(x.date||x.lastUpdated)})
  }
 }
 const unique=new Map<string,any>()
 for(const x of rows)unique.set(x.playerId||(x.team+'-'+x.player),x)
 return [...unique.values()]
}
function parseGames(data:any):any[]{
 return (Array.isArray(data?.events)?data.events:[]).flatMap((e:any)=>{
  const teams=e?.competitions?.[0]?.competitors
  const start=Date.parse(str(e?.date))
  if(!e?.id||!Number.isFinite(start)||start<=Date.now()||e.status?.type?.completed===true||!Array.isArray(teams)||teams.length!==2)return []
  const parts=teams.map((t:any)=>({
   id:str(t.team?.id??t.id),abbreviation:str(t.team?.abbreviation),name:str(t.team?.displayName||t.team?.name),
   homeAway:t.homeAway==='home'?'home':t.homeAway==='away'?'away':''
  }))
  if(parts.some((t:any)=>!t.id||!t.abbreviation||!t.homeAway))return []
  return [{id:str(e.id),date:str(e.date),teams:parts}]
 })
}
async function digest(v:string):Promise<string>{
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))
 return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('')
}
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405})
 if(!req.headers.get('x-edgeiq-cron-key')||await digest(req.headers.get('x-edgeiq-cron-key')??'')!==CRON_KEY_SHA256)
  return new Response('Unauthorized',{status:401})
 const url=Deno.env.get('SUPABASE_URL')??''
 const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??''
 if(!url||!service)return new Response('Service configuration unavailable',{status:503})
 const today=todayET()
 const results:any[]=[]
 for(const sport of ['NBA','NFL'] as Sport[]){
  let injuries:any[]=[]
  let injuriesAvailable=false
  try{
   const response=await fetchESPN(sport,'/injuries')
   if(!Array.isArray(response?.injuries))throw Error('Unsupported injuries response')
   injuries=parseInjuries(response)
   injuriesAvailable=true
  }catch(e){console.warn('Injuries unavailable',sport,String(e))}
  let saved=0,failed=0
  const limit=sport==='NFL'?11:5
  for(let i=0;i<limit;i+=4){
   const days=Array.from({length:Math.min(4,limit-i)},(_,j)=>i+j)
   await Promise.all(days.map(async offset=>{
    const date=plusDay(today,offset)
    try{
     const response=await fetchESPN(sport,'/scoreboard?dates='+date.replaceAll('-','')+'&limit=100')
     const games=parseGames(response)
     if(!games.length)return
     const upsert=await fetch(url.replace(/\/$/,'')+'/rest/v1/edgeiq_slate_snapshots?on_conflict=sport,slate_date',{
       method:'POST',
       headers:{
         'Content-Type':'application/json',
         apikey:service,Authorization:'Bearer '+service,
         Prefer:'resolution=merge-duplicates,return=minimal',
       },
       body:JSON.stringify({
         sport,slate_date:date,games,injuries,injuries_available:injuriesAvailable,
         source_status:injuriesAvailable?'ok':'injuries_unavailable',generated_at:new Date().toISOString()
       })
     })
     if(!upsert.ok)throw Error('Snapshot write HTTP '+upsert.status)
     saved++
    }catch(e){failed++;console.warn('Slate unavailable',sport,date,String(e))}
   }))
  }
  results.push({sport,saved,failed,injuriesAvailable,injuryCount:injuries.length})
 }
 const ok=results.some(r=>r.saved>0)
 return new Response(JSON.stringify({ok,todayET:today,results}),{
  status:ok?200:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}
 })
})
