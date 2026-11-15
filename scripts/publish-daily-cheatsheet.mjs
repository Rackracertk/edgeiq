import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { buildNBAPicks, buildNFLPicks } from '../src/cheatSheetData.ts'
import { enrichElitePicks } from '../src/analytics/eliteResearch.ts'
import { extractNBAPlayerStats } from '../src/analytics/espnData.ts'
import { parseNFLBoxscore } from '../src/analytics/nflBoxscore.ts'
import { normalizeInjuries, findInjury, shouldExcludeInjury } from '../src/analytics/injuryStatus.ts'

// Data source: ESPN public, unofficial endpoints. Beta-only pending data rights review.
// Historical rates are NOT predictive probabilities. No betting prices are implied.
const CACHE_PATH = 'data/edgeiq-research-cache.json'
const OUTPUT_PATH = 'public/edgeiq-daily.json'
const BASE = 'https://site.api.espn.com/apis/site/v2/sports/'
const CURRENT_NBA_SEASON = new Date().getUTCMonth() >= 8 ? new Date().getUTCFullYear() + 1 : new Date().getUTCFullYear()
const CURRENT_NFL_SEASON = new Date().getUTCMonth() >= 7 ? new Date().getUTCFullYear() : new Date().getUTCFullYear() - 1
const TODAY = eastDate(new Date())
const failures = []

function eastDate(date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone:'America/New_York',
    year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(date)
  const get = key => parts.find(part => part.type === key)?.value ?? ''
  return get('year') + '-' + get('month') + '-' + get('day')
}
function addDays(date, offset) {
  const [y,m,d] = date.split('-').map(Number)
  return new Date(Date.UTC(y,m-1,d+offset)).toISOString().slice(0,10)
}
function dateLabel(date) {
  return new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'long',month:'short',day:'numeric'})
    .format(new Date(date + 'T18:00:00Z'))
}
function compact(date) { return date.replaceAll('-','') }
function sleep(ms) { return new Promise(resolve=>setTimeout(resolve,ms)) }
async function getJson(sport,path, attempts=2) {
  const route = sport === 'NBA' ? 'basketball/nba' : 'football/nfl'
  const url = BASE + route + path
  let last
  for(let tryNo=0;tryNo<attempts;tryNo++) {
    try {
      const res = await fetch(url, {
        headers:{Accept:'application/json','User-Agent':'EDGEIQ-Beta-Research/1.0'},
        signal:AbortSignal.timeout(17000),
      })
      if(!res.ok)throw new Error('HTTP '+res.status)
      const data=await res.json()
      if(!data || typeof data!=='object')throw new Error('Unrecognized provider response')
      return data
    }catch(error) {
      last = error
      if(tryNo + 1 < attempts) await sleep(600*(tryNo+1))
    }
  }
  throw Error(sport+' '+path+' failed: '+String(last))
}
async function batches(rows, size, task) {
  const all=[]
  for(let i=0;i<rows.length;i+=size) {
    const result=await Promise.all(rows.slice(i,i+size).map(task))
    all.push(...result)
  }
  return all
}
function parsedTeams(event) {
  const teams=event?.competitions?.[0]?.competitors
  if(!Array.isArray(teams) || teams.length!==2) return null
  const parsed=teams.map(row=>({
    id:String(row.team?.id??row.id??''),
    name:String(row.team?.displayName??''),
    abbreviation:String(row.team?.abbreviation??''),
    homeAway:row.homeAway,
  }))
  return parsed.every(x=>x.id && x.name && x.abbreviation) ? parsed : null
}
function upcomingEvent(event) {
  const date=String(event?.date??'')
  const teams=parsedTeams(event)
  if(!date || !teams || !event?.id || Date.parse(date)<=Date.now() ||
      event.status?.type?.completed===true) return null
  return {id:String(event.id),date,teams}
}
function completedEvent(event,sport) {
  const expected=sport==='NBA' ? CURRENT_NBA_SEASON:CURRENT_NFL_SEASON
  return !!event?.id && !!parsedTeams(event) && event.status?.type?.completed===true &&
    event.season?.type===2 && Number(event.season?.year)===expected
}
function uniqueEvents(events) {
  return Array.from(new Map(events.filter(x=>x?.id).map(x=>[String(x.id),x])).values())
}
function getBoards(events, sport) {
  const games=uniqueEvents(events).map(upcomingEvent).filter(Boolean)
    .sort((a,b)=>a.date.localeCompare(b.date))
  const grouped=new Map()
  for(const game of games) {
    const date=eastDate(new Date(game.date))
    if(!grouped.has(date))grouped.set(date,[])
    grouped.get(date).push(game)
  }
  // Today and the next available playing date; never invent a fixture.
  return Array.from(grouped.entries()).slice(0,2).map(([date,games])=>({
    date:compact(date),label:dateLabel(date),isToday:date===TODAY,
    games,source:'ESPN '+sport+' scoreboard',
  }))
}
async function readCache() {
  if(!existsSync(CACHE_PATH))return {version:1,nba:{},nfl:{},lastFullNBA:''}
  try {
    const data=JSON.parse(await readFile(CACHE_PATH,'utf8'))
    return data?.version===1 && data.nba && data.nfl
      ? data : {version:1,nba:{},nfl:{},lastFullNBA:''}
  }catch { return {version:1,nba:{},nfl:{},lastFullNBA:''} }
}

function transformNBA(event, summary) {
  const teams=parsedTeams(event)
  const playerGroups=summary?.boxscore?.players
  if(!teams||!Array.isArray(playerGroups)||playerGroups.length!==2)
    throw Error('NBA summary is missing complete team boxes')
  const rows=extractNBAPlayerStats(playerGroups).map(row=>{
    const team=teams.find(t=>t.id===row.teamId)
    const opponent=teams.find(t=>t.id!==row.teamId)
    return !team||!opponent ? null : {
      ...row,gameId:String(event.id),date:String(event.date),
      opponent:opponent.name,homeAway:team.homeAway,
    }
  }).filter(Boolean)
  if(rows.length<10 || new Set(rows.map(p=>p.teamId)).size<2)
    throw Error('NBA boxscore did not supply two credible team lineups')
  return {date:String(event.date),rows}
}
async function nbaHistory(cache) {
  const start=addDays(TODAY,-60)
  const seasonStart=(CURRENT_NBA_SEASON-1)+'-10-01'
  const lower=start>seasonStart?start:seasonStart
  const full=cache.lastFullNBA!==TODAY
  const days=[]
  for(let d=full?lower:addDays(TODAY,-3);d<=TODAY;d=addDays(d,1))days.push(d)
  const fetched=await batches(days,6,async date=>{
    try {
      const result=await getJson('NBA','/scoreboard?dates='+compact(date)+'&limit=100')
      return Array.isArray(result.events)?result.events:[]
    }catch(error){ failures.push(String(error)); return [] }
  })
  const completed=uniqueEvents(fetched.flat().filter(e=>completedEvent(e,'NBA')))
  const missing=completed.filter(game=>!cache.nba[String(game.id)])
  const incoming=await batches(missing,6,async game=>{
    try {
      const data=await getJson('NBA','/summary?event='+encodeURIComponent(game.id))
      return [String(game.id),transformNBA(game,data)]
    }catch(error){failures.push(String(error));return null}
  })
  for(const entry of incoming)if(entry)cache.nba[entry[0]]=entry[1]
  for(const [key,stored] of Object.entries(cache.nba))
    if(!stored?.date || eastDate(new Date(stored.date))<lower)delete cache.nba[key]
  if(full && !failures.length)cache.lastFullNBA=TODAY
  const history={}
  const latestPlayers=new Map()
  for(const game of Object.values(cache.nba))for(const row of game.rows??[]) {
    const playerId=String(row.id)
    if(!history[playerId])history[playerId]=[]
    history[playerId].push(row)
    const existing=latestPlayers.get(playerId)
    if(!existing || row.date>existing.date)latestPlayers.set(playerId,{...row})
  }
  for(const records of Object.values(history))records.sort((a,b)=>b.date.localeCompare(a.date))
  const players=Array.from(latestPlayers.values()).map(row=>({
    id:String(row.id),name:row.name,team:row.team,teamId:String(row.teamId),position:row.position,
    points:row.points,rebounds:row.rebounds,assists:row.assists,threes:row.threes,
    steals:row.steals,blocks:row.blocks,
  }))
  return {history,players,completedGames:Object.keys(cache.nba).length}
}
async function nflPositions(cache, events) {
  if(cache.lastNFLRosterET===TODAY && Object.keys(cache.nflPositions??{}).length)
    return cache.nflPositions
  const teams=new Map()
  for(const event of events)for(const team of parsedTeams(event)??[])
    teams.set(team.id,team)
  const entries=await batches([...teams.values()],6,async team=>{
    try {
      const data=await getJson('NFL','/teams/'+encodeURIComponent(team.id)+'/roster')
      if(!Array.isArray(data.athletes))throw Error('NFL roster shape unavailable')
      const players=data.athletes.flatMap(group=>Array.isArray(group.items)?group.items:[])
      return players.flatMap(athlete=>{
        const position=String(athlete.position?.abbreviation??'').toUpperCase()
        const id=String(athlete.id??'')
        return id&&position?[[id,position]]:[]
      })
    }catch(error){failures.push('NFL roster '+team.abbreviation+': '+String(error));return []}
  })
  const mapped=Object.fromEntries(entries.flat())
  if(Object.keys(mapped).length > 100){
    cache.nflPositions=mapped
    cache.lastNFLRosterET=TODAY
  }
  return Object.keys(mapped).length?mapped:cache.nflPositions??{}
}
async function nflHistory(cache, events, positions) {
  const completed=uniqueEvents(events.filter(e=>completedEvent(e,'NFL')))
  const missing=completed.filter(game=>!cache.nfl[String(game.id)])
  const incoming=await batches(missing,6,async event=>{
    try {
      const teams=parsedTeams(event)
      const score=await getJson('NFL','/summary?event='+encodeURIComponent(event.id))
      const game={id:String(event.id),date:String(event.date),teams}
      const rows=parseNFLBoxscore(score,game)
      if(rows.length<12)throw Error('NFL boxscore contains too few athletes')
      return [String(event.id),{date:String(event.date),rows}]
    }catch(error){failures.push(String(error));return null}
  })
  for(const entry of incoming)if(entry)cache.nfl[entry[0]]=entry[1]
  for(const [key,stored] of Object.entries(cache.nfl)) {
    if(!stored?.date || !eastDate(new Date(stored.date)).startsWith(String(CURRENT_NFL_SEASON)))
      delete cache.nfl[key]
  }
  const rows=Object.values(cache.nfl).flatMap(game=>game.rows??[]).map(row=>({
    ...row,position:row.position||positions[row.playerId]||'',
  }))
  return {rows,completedGames:Object.keys(cache.nfl).length}
}
async function injuries(sport) {
  try {
    const result=await getJson(sport,'/injuries')
    if(!Array.isArray(result.injuries))throw Error('Unsupported injury response shape')
    const rows=normalizeInjuries(result)
    if(result.injuries.length && !rows.length)throw Error('Injury status not interpretable')
    return {available:true,injuries:rows,checkedAt:new Date().toISOString(),source:'ESPN '+sport+' injury feed'}
  } catch(error) {
    return {available:false,injuries:[],checkedAt:new Date().toISOString(),
      source:'Unavailable',error:String(error)}
  }
}
function makeBoard(sport, slate, history, report) {
  const unavailable=(id,name,team,teamId)=>
    shouldExcludeInjury(findInjury(report.injuries,String(id),name,team,String(teamId)))
  const candidates=sport==='NBA'
    ? buildNBAPicks(slate,history.history,history.players,report.available?unavailable:undefined)
    : buildNFLPicks(slate,history.rows,report.available?unavailable:undefined)
  const researched=enrichElitePicks(candidates,sport,slate,
    sport==='NBA'?history.history:{},sport==='NFL'?history.rows:[],
    sport==='NBA'?history.players:[])
  return {
    ...slate,
    report,
    picks:researched,
    generatedAt:new Date().toISOString(),
    sourceCompleteness: failures.length ? 'PARTIAL' : 'COMPLETE',
    historicalGames:history.completedGames,
    publishedBy:'EDGEIQ unattended research publisher',
  }
}
async function run() {
  const cache=await readCache()
  const nbaDates=Array.from({length:10},(_,i)=>addDays(TODAY,i))
  const nbaFuture=await batches(nbaDates,5,async date=>{
    try {
      const data=await getJson('NBA','/scoreboard?dates='+compact(date)+'&limit=100')
      return data.events??[]
    }catch(error){failures.push(String(error));return []}
  })
  let nflEvents=[]
  try {
    const data=await getJson('NFL','/scoreboard?dates='+CURRENT_NFL_SEASON+'&seasontype=2&limit=300')
    nflEvents=Array.isArray(data.events)?data.events:[]
  }catch(error){failures.push(String(error))}
  const nbaSlates=getBoards(nbaFuture.flat(),'NBA')
  const nflSlates=getBoards(nflEvents,'NFL')
  const [nbaReport,nflReport]=await Promise.all([injuries('NBA'),injuries('NFL')])
  const nbaData=nbaSlates.length?await nbaHistory(cache):{history:{},players:[],completedGames:0}
  const nflPositionsMap=nflSlates.length?await nflPositions(cache,nflEvents):{}
  const nflData=nflSlates.length?await nflHistory(cache,nflEvents,nflPositionsMap):{rows:[],completedGames:0}
  const boards={
    NBA:nbaSlates.map(slate=>makeBoard('NBA',slate,nbaData,nbaReport)),
    NFL:nflSlates.map(slate=>makeBoard('NFL',slate,nflData,nflReport)),
  }
  const totalPicks=Object.values(boards).flat().reduce((sum,board)=>sum+board.picks.length,0)
  const result={
    schemaVersion:1,generatedAt:new Date().toISOString(),
    publishedDateET:TODAY,
    publisher:'GitHub Actions scheduled daily',
    disclaimer:'Public ESPN game summaries are unofficial, potentially incomplete, not licensed sportsbook lines. Historical hit rates are not forecast win probabilities. Data use subject to provider terms.',
    dataStatus:failures.length?'PARTIAL':'OK',
    failures:failures.slice(0,12),
    boards,
  }
  if(!Object.values(boards).flat().length)
    throw Error('No upcoming verified NBA or NFL slate; refusing to overwrite current publication')
  if(failures.length > Math.max(20,Math.floor(nbaData.completedGames*.15))) {
    throw Error('Too many upstream source failures ('+failures.length+'); retaining prior publication')
  }
  await mkdir('public',{recursive:true})
  await mkdir('data',{recursive:true})
  // The player research screen needs the complete pooled NBA history, not
  // per-browser scraping; publish it separately so the cheat sheet stays small.
  if(nbaData.completedGames >= 3 && nbaData.players.length) {
    const nextOpponents={}
    const teamAbbreviations={}
    for(const slate of nbaSlates)for(const game of slate.games) {
      for(const team of game.teams) {
        teamAbbreviations[team.name]=team.abbreviation
        const other=game.teams.find(row=>row.id!==team.id)
        if(other && !nextOpponents[team.name])nextOpponents[team.name]=other.name
      }
    }
    const nbaResearchPublication={
      schemaVersion:1,generatedAt:result.generatedAt,publishedDateET:TODAY,
      source:'ESPN public completed game summaries; unofficial research',
      players:nbaData.players,history:nbaData.history,nextOpponents,teamAbbreviations,
    }
    await writeFile('public/edgeiq-nba-history.json',JSON.stringify(nbaResearchPublication)+'\n')
  }
  await writeFile(OUTPUT_PATH,JSON.stringify(result,null,2)+'\n')
  await writeFile(CACHE_PATH,JSON.stringify(cache)+'\n')
  console.log(JSON.stringify({
    publishedDate:TODAY,generatedAt:result.generatedAt,dataStatus:result.dataStatus,
    nbaBoards:boards.NBA.map(b=>({date:b.date,games:b.games.length,picks:b.picks.length,history:b.historicalGames,injuries:b.report.available})),
    nflBoards:boards.NFL.map(b=>({date:b.date,games:b.games.length,picks:b.picks.length,history:b.historicalGames,injuries:b.report.available})),
    sourceFailures:failures.length,
  }))
  if(totalPicks===0)console.warn('No verified elite picks qualified; an empty research board is intentionally published')
}
await run().catch(error=>{console.error('Publisher failed:',error);process.exitCode=1})
