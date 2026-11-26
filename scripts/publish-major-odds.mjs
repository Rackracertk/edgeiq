import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
export const sports={NFL:{key:'americanfootball_nfl',markets:{player_pass_yds:'Passing Yards',player_rush_yds:'Rushing Yards',player_reception_yds:'Receiving Yards'}},NBA:{key:'basketball_nba',markets:{player_points:'Points',player_rebounds:'Rebounds',player_assists:'Assists'}}}
export function normalizeQuotes(data,config,now=Date.now()){
 const result=[]
 for(const book of data.bookmakers??[])for(const market of book.markets??[]){
  const label=config.markets[market.key],stamp=market.last_update
  if(!label||!book.title||!Number.isFinite(Date.parse(stamp))||Date.parse(stamp)>now+60000||Date.parse(stamp)<now-15*60000)continue
  for(const row of market.outcomes??[]){
   if(typeof row.description!=='string'||!row.description.trim()||!['Over','Under'].includes(row.name)||!Number.isFinite(row.point)||!Number.isInteger(row.price)||Math.abs(row.price)<100)continue
   result.push({book:book.title,market:market.key,category:label,participant:row.description,participantId:'',side:row.name.toLowerCase(),line:row.point,odds:row.price,observedAt:stamp})
  }
 }
 return result
}
async function request(path,params={}){
 const url=new URL('https://api.the-odds-api.com/v4/'+path)
 for(const [k,v] of Object.entries(params))url.searchParams.set(k,v)
 const r=await fetch(url,{headers:{'x-api-key':process.env.EDGEIQ_ODDS_API_KEY,Accept:'application/json'},signal:AbortSignal.timeout(15000)}).catch(()=>null)
 if(!r)throw Error('Provider connection failed')
 if(!r.ok)throw Error('Odds API HTTP '+r.status+' (check key, plan and remaining quota)')
 const remaining=r.headers.get('x-requests-remaining')
 return {body:await r.json(),remaining:remaining===null?null:Number(remaining)}
}
async function main(){
 if(!process.env.EDGEIQ_ODDS_API_KEY)throw Error('Missing repository Actions secret EDGEIQ_ODDS_API_KEY')
 const sport=process.env.ODDS_SPORT||'NFL',config=sports[sport]
 if(!config)throw Error('Choose NBA or NFL')
 const events=await request('sports/'+config.key+'/events')
 console.log('Odds API authentication succeeded. Remaining credits:',events.remaining??'not reported')
 if(process.env.ODDS_CHECK_ONLY==='true')return
 if(process.env.ODDS_DISPLAY_CONFIRMED!=='true')throw Error('Confirm provider display rights before publishing')
 const query=(process.env.ODDS_TEAM||'').trim().toLowerCase()
 const now=Date.now(), upcoming=events.body.filter(e=>Date.parse(e.commence_time)>now&&Date.parse(e.commence_time)<now+48*3600000&&(!query||(e.home_team+' '+e.away_team).toLowerCase().includes(query))).sort((a,b)=>a.commence_time.localeCompare(b.commence_time)).slice(0,2)
 if(!upcoming.length)throw Error('No upcoming matching games in next 48 hours')
 let remaining=events.remaining
 const games=[]
 for(const event of upcoming){
  if(remaining===null||!Number.isFinite(remaining)||remaining<3)throw Error('Insufficient or unknown quota; stopped before spending credits')
  const response=await request('sports/'+config.key+'/events/'+encodeURIComponent(event.id)+'/odds',{regions:'us',markets:Object.keys(config.markets).join(','),oddsFormat:'american',dateFormat:'iso'})
  remaining=response.remaining
  const quotes=normalizeQuotes(response.body,config)
  games.push({sport,home:event.home_team,away:event.away_team,time:event.commence_time,quotes})
  console.log(event.home_team,'vs',event.away_team,quotes.length,'fresh quotes; remaining credits',remaining)
 }
 let previous=[]
 try{const old=JSON.parse(await readFile('public/edgeiq-major-odds.json','utf8'));if(old.schemaVersion===1)previous=old.games.filter(g=>g.sport!==sport&&Date.parse(g.time)>now&&g.quotes.some(q=>Date.parse(q.observedAt)>=now-15*60000))}catch{}
 await mkdir('public',{recursive:true})
 await writeFile('public/edgeiq-major-odds.json',JSON.stringify({schemaVersion:1,source:'The Odds API',generatedAt:new Date().toISOString(),games:[...previous,...games]})+'\n')
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exitCode=1})
