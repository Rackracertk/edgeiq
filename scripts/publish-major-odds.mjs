import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
const football={"player_pass_yds":"Passing Yards","player_rush_yds":"Rushing Yards","player_reception_yds":"Receiving Yards","player_receptions":"Receptions","player_pass_tds":"Passing TDs","player_pass_completions":"Passing Completions","player_rush_attempts":"Rushing Attempts","player_sacks":"Sacks","player_pass_attempts":"Passing Attempts","player_pass_interceptions":"Interceptions Thrown","player_pass_longest_completion":"Longest Completion","player_rush_longest":"Longest Rush","player_reception_longest":"Longest Reception","player_rush_tds":"Rushing TDs","player_reception_tds":"Receiving TDs","player_pass_rush_yds":"Passing + Rushing Yards","player_rush_reception_yds":"Rushing + Receiving Yards","player_pass_rush_reception_yds":"Passing + Rushing + Receiving Yards","player_rush_reception_tds":"Rushing + Receiving TDs","player_pass_rush_reception_tds":"Passing + Rushing + Receiving TDs","player_pass_yds_q1":"1st Quarter Passing Yards","player_solo_tackles":"Solo Tackles","player_assists":"Assisted Tackles","player_tackles_assists":"Tackles","player_defensive_interceptions":"Defensive Interceptions","player_field_goals":"Field Goals Made","player_pats":"Extra Points Made","player_kicking_points":"Kicking Points"}
const basketball={"player_points":"Points","player_rebounds":"Rebounds","player_assists":"Assists","player_threes":"3-Pointers Made","player_points_rebounds_assists":"PRA","player_points_assists":"Points + Assists (PA)","player_points_rebounds":"Points + Rebounds (PR)","player_rebounds_assists":"Assists + Rebounds (AR)","player_steals":"Steals","player_blocks":"Blocks","player_blocks_steals":"Steals + Blocks (SB)","player_turnovers":"Turnovers","player_field_goals":"Field Goals Made","player_frees_made":"Free Throws Made","player_frees_attempts":"Free Throw Attempts","player_points_q1":"1st Quarter Points","player_rebounds_q1":"1st Quarter Rebounds","player_assists_q1":"1st Quarter Assists","player_fantasy_points":"Fantasy Points"}
const soccer={"player_shots":"Shots","player_shots_on_target":"Shots on Target","player_assists":"Assists"}
export const sports={
 NFL:{key:'americanfootball_nfl',markets:football},NBA:{key:'basketball_nba',markets:basketball},
 MLB:{key:'baseball_mlb',markets:{"batter_hits":"Hits","pitcher_strikeouts":"Pitcher Strikeouts","batter_total_bases":"Total Bases","batter_home_runs":"Home Runs","batter_rbis":"RBIs","pitcher_outs":"Pitcher Outs","batter_runs_scored":"Runs","batter_hits_runs_rbis":"Hits + Runs + RBIs","batter_singles":"Singles","batter_doubles":"Doubles","batter_triples":"Triples","batter_walks":"Batter Walks","batter_strikeouts":"Batter Strikeouts","batter_fantasy_score":"Batter Fantasy Points","pitcher_hits_allowed":"Pitcher Hits Allowed","pitcher_walks":"Pitcher Walks","pitcher_earned_runs":"Pitcher Earned Runs"}},
 NHL:{key:'icehockey_nhl',markets:{"player_shots_on_goal":"Shots on Goal","player_points":"Points","player_total_saves":"Goalie Saves","player_assists":"Assists","player_goals":"Goals","player_power_play_points":"Power Play Points","player_blocked_shots":"Blocked Shots","player_faceoffs_won":"Faceoffs Won","player_time_on_ice":"Time on Ice"}},
 NCAAF:{key:'americanfootball_ncaaf',markets:football},NCAAB:{key:'basketball_ncaab',markets:basketball},WNBA:{key:'basketball_wnba',markets:basketball},
 SOCCER:{keys:['soccer_epl','soccer_spain_la_liga','soccer_germany_bundesliga','soccer_italy_serie_a','soccer_france_ligue_one','soccer_usa_mls','soccer_uefa_champs_league'],markets:soccer},
 TENNIS:{markets:{}},MMA:{key:'mma_mixed_martial_arts',markets:{}}
}
const alternateKeys={"football":"player_assists player_field_goals player_kicking_points player_pass_attempts player_pass_completions player_pass_interceptions player_pass_longest_completion player_pass_rush_yds player_pass_rush_reception_tds player_pass_rush_reception_yds player_pass_tds player_pass_yds player_receptions player_reception_longest player_reception_tds player_reception_yds player_rush_attempts player_rush_longest player_rush_reception_tds player_rush_reception_yds player_rush_tds player_rush_yds player_sacks player_solo_tackles player_tackles_assists","basketball":"player_points player_rebounds player_assists player_blocks player_steals player_turnovers player_threes player_points_assists player_points_rebounds player_rebounds_assists player_points_rebounds_assists player_fantasy_points","baseball":"batter_total_bases batter_home_runs batter_hits batter_rbis batter_walks batter_strikeouts batter_runs_scored batter_hits_runs_rbis batter_singles batter_doubles batter_triples batter_fantasy_score pitcher_hits_allowed pitcher_walks pitcher_earned_runs pitcher_strikeouts pitcher_outs","hockey":"player_points player_assists player_power_play_points player_goals player_shots_on_goal player_blocked_shots player_total_saves player_faceoffs_won player_time_on_ice","soccer":"player_assists player_shots player_shots_on_target"}
const binaryMarkets={"player_anytime_td":"Anytime Touchdown","player_1st_td":"First Touchdown","player_last_td":"Last Touchdown","player_double_double":"Double-Double","player_triple_double":"Triple-Double","player_first_basket":"First Basket","player_first_team_basket":"First Team Basket","player_goal_scorer_anytime":"Anytime Goal","player_goal_scorer_first":"First Goal","player_goal_scorer_last":"Last Goal","player_first_goal_scorer":"First Goal","player_last_goal_scorer":"Last Goal","player_to_receive_card":"Yellow Cards","player_to_receive_red_card":"Red Cards"}
const extraBySport={"football":{"player_anytime_td":"Anytime Touchdown","player_1st_td":"First Touchdown","player_last_td":"Last Touchdown"},"basketball":{"player_double_double":"Double-Double","player_triple_double":"Triple-Double","player_first_basket":"First Basket","player_first_team_basket":"First Team Basket"},"hockey":{"player_goal_scorer_anytime":"Anytime Goal","player_goal_scorer_first":"First Goal","player_goal_scorer_last":"Last Goal"},"soccer":{"player_goal_scorer_anytime":"Anytime Goal","player_first_goal_scorer":"First Goal","player_last_goal_scorer":"Last Goal","player_to_receive_card":"Yellow Cards","player_to_receive_red_card":"Red Cards"}}
const familyBySport={"NFL":"football","NCAAF":"football","NBA":"basketball","WNBA":"basketball","NCAAB":"basketball","MLB":"baseball","NHL":"hockey","SOCCER":"soccer"}
for(const [sport,config] of Object.entries(sports)){const family=familyBySport[sport];Object.assign(config.markets,extraBySport[family]??{});for(const key of (alternateKeys[family]??'').split(' ')){if(config.markets[key])config.markets[key+'_alternate']=config.markets[key]}}
const gameMarkets={h2h:'Moneyline',spreads:'Spread',totals:'Game Total'}
const normalize=s=>String(s??'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g,'')
export function configurations(active,selection='ALL'){
 const known=new Set(active.filter(s=>s.active!==false).map(s=>s.key))
 return Object.entries(sports).filter(([sport])=>selection==='ALL'||sport===selection).flatMap(([sport,c])=>{
  const keys=sport==='TENNIS'?[...known].filter(k=>/^tennis_(atp|wta)_/.test(k)&&!/(winner|outright|doubles)/.test(k)):c.keys??[c.key]
  return keys.filter(k=>known.has(k)).map(key=>({sport,key,markets:sport==='SOCCER'&&key==='soccer_uefa_champs_league'?{}:c.markets}))
 })
}
export function normalizeQuotes(data,config,now=Date.now()){
 const result=[]
 for(const book of data.bookmakers??[])for(const market of book.markets??[]){
  const isGame=Object.hasOwn(gameMarkets,market.key),label=isGame?gameMarkets[market.key]:config.markets[market.key],stamp=market.last_update??book.last_update
  if(!label||!book.title||!Number.isFinite(Date.parse(stamp))||Date.parse(stamp)>now+60000||Date.parse(stamp)<now-15*60000)continue
  for(const row of market.outcomes??[]){
   if(!Number.isInteger(row.price)||Math.abs(row.price)<100)continue
   const participant=isGame?(market.key==='totals'?'Game total':row.name):row.description
   const binary=!isGame&&Object.hasOwn(binaryMarkets,market.key)
   if(typeof participant!=='string'||!participant.trim()||(!isGame&&!(binary?['Yes','No']:['Over','Under']).includes(row.name))||(!binary&&market.key!=='h2h'&&!Number.isFinite(row.point)))continue
   result.push({book:book.title,market:market.key,category:label,participant,participantId:'',side:isGame&&market.key!=='totals'?row.name:row.name.toLowerCase(),line:market.key==='h2h'||binary?null:row.point,odds:row.price,observedAt:stamp})
  }
 }
 return result
}
export function mergeSnapshots(old,newGames,now=Date.now()){
 const events=new Map()
 for(const game of [...old,...newGames]){
  if(Date.parse(game.time)<=now||!Array.isArray(game.quotes))continue
  const id=[game.sport,[normalize(game.home),normalize(game.away)].sort().join('|'),Date.parse(game.time)].join('|')
  const prior=events.get(id),quotes=new Map()
  for(const q of [...(prior?.quotes??[]),...game.quotes]){
   if(!Number.isFinite(Date.parse(q.observedAt))||Date.parse(q.observedAt)<now-15*60000||Date.parse(q.observedAt)>now+60000)continue
   const key=[q.book,q.market,q.participant,q.side,q.line].join('|'),previous=quotes.get(key)
   if(!previous||Date.parse(q.observedAt)>=Date.parse(previous.observedAt))quotes.set(key,q)
  }
  if(quotes.size)events.set(id,{...game,quotes:[...quotes.values()]})
 }
 return [...events.values()]
}
async function request(path,params={}){
 const url=new URL('https://api.the-odds-api.com/v4/'+path)
 for(const [k,v] of Object.entries(params))url.searchParams.set(k,v)
 const r=await fetch(url,{headers:{'x-api-key':process.env.EDGEIQ_ODDS_API_KEY,Accept:'application/json'},signal:AbortSignal.timeout(15000)}).catch(()=>null)
 if(!r)throw Error('Provider connection failed')
 if(!r.ok)throw Error('Odds API HTTP '+r.status)
 const read=k=>{const v=r.headers.get(k);return v!==null&&Number.isFinite(Number(v))?Number(v):null}
 return {body:await r.json(),remaining:read('x-requests-remaining'),cost:read('x-requests-last')}
}
async function main(){
 if(!process.env.EDGEIQ_ODDS_API_KEY)throw Error('Missing repository Actions secret EDGEIQ_ODDS_API_KEY')
 const selection=process.env.ODDS_SPORT||'ALL',mode=process.env.ODDS_MODE||'both'
 if(selection!=='ALL'&&!sports[selection])throw Error('Unknown sport')
 if(!['both','lines','props'].includes(mode))throw Error('Unknown mode')
 const discovery=await request('sports')
 console.log('Odds API authentication succeeded. Remaining credits:',discovery.remaining??'not reported')
 if(process.env.ODDS_CHECK_ONLY==='true')return
 if(process.env.ODDS_DISPLAY_CONFIRMED!=='true')throw Error('Confirm provider display rights before publishing')
 const requested=Number(process.env.ODDS_BUDGET||30)
 const cap=Number.isFinite(requested)?Math.max(1,Math.min(60,Math.floor(requested))):30
 let remaining=discovery.remaining,spent=0,reserved=0
 const query=(process.env.ODDS_TEAM||'').trim().toLowerCase(),now=Date.now()
 const upcoming=e=>Date.parse(e.commence_time)>now&&Date.parse(e.commence_time)<now+48*3600000&&(!query||(e.home_team+' '+e.away_team).toLowerCase().includes(query))
 const configs=configurations(discovery.body,selection)
 if(!configs.length)throw Error('No active covered leagues found')
 const issues=[],games=[],queues=[]
 const canPay=n=>Number.isFinite(remaining)&&remaining>=n&&reserved+n<=cap
 async function pay(path,markets){
  const cost=markets.length
  if(!canPay(cost))return null
  reserved+=cost // reserve maximum before request; failures never reopen the allowance
  try{
   const result=await request(path,{regions:'us',markets:markets.join(','),oddsFormat:'american',dateFormat:'iso'})
   remaining=result.remaining
   spent+=result.cost??cost
   return result.body
  }catch(e){issues.push(path.split('/').slice(0,2).join('/')+': '+e.message);return null}
 }
 const add=(config,e)=>{const quotes=normalizeQuotes(e,config);if(quotes.length)games.push({sport:config.sport,home:e.home_team,away:e.away_team,time:e.commence_time,quotes})}
 // League-wide moneylines first, then spread/total expansion; one league call covers all its games.
 if(mode!=='props')for(const config of configs){
  if(!canPay(1))break
  const list=await pay('sports/'+config.key+'/odds',['h2h'])
  if(Array.isArray(list))for(const event of list.filter(upcoming))add(config,event)
 }
 // Free event discovery, then rotate across sports rather than spending the entire budget on one.
 if(mode!=='lines')for(const config of configs.filter(c=>Object.keys(c.markets).length)){
  try{const r=await request('sports/'+config.key+'/events');remaining=r.remaining;queues.push({config,events:r.body.filter(upcoming).sort((a,b)=>a.commence_time.localeCompare(b.commence_time))})}catch(e){issues.push(config.key+': '+e.message)}
 }
 const modeMarkets=process.env.ODDS_MARKETS||'core'
 const customKeys=(process.env.ODDS_MARKET_KEYS||'').split(',').map(k=>k.trim()).filter(Boolean)
 const propCount=modeMarkets==='all'?60:modeMarkets==='expanded'?8:3
 for(let round=0;queues.some(q=>q.events.length>round);round++){
  let progressed=false
  for(const {config,events} of queues){
   const event=events[round],markets=(customKeys.length?[...new Set(customKeys)].filter(k=>Object.hasOwn(config.markets,k)):Object.keys(config.markets)).slice(0,Math.min(customKeys.length?60:propCount,cap-reserved))
   if(!event||!markets.length||!canPay(markets.length))continue
   progressed=true
   const response=await pay('sports/'+config.key+'/events/'+encodeURIComponent(event.id)+'/odds',markets)
   if(response&&response.id===event.id)add(config,response)
  }
  if(!progressed)break
 }
 if(mode!=='props')for(const config of configs){
  if(!canPay(2))break
  const list=await pay('sports/'+config.key+'/odds',['spreads','totals'])
  if(Array.isArray(list))for(const event of list.filter(upcoming))add(config,event)
 }
 let previous=[]
 try{const old=JSON.parse(await readFile('public/edgeiq-major-odds.json','utf8'));if(old.schemaVersion===1)previous=old.games}catch{}
 const merged=mergeSnapshots(previous,games)
 console.log('Credit ceiling:',cap,'reserved:',reserved,'provider-reported cost:',spent,'remaining:',remaining,'matches:',merged.length,'issues:',issues)
 if(!games.length)throw Error('No fresh matching offers received; check provider coverage, quota and event time')
 await mkdir('public',{recursive:true})
 await writeFile('public/edgeiq-major-odds.json',JSON.stringify({schemaVersion:1,source:'The Odds API',generatedAt:new Date().toISOString(),games:merged})+'\n')
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exitCode=1})
