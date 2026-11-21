import { mkdir, writeFile } from 'node:fs/promises';
import { SPORTS, parseESPNEvent, recentForm, matchupEvidence, pairMarketQuotes, matchByFixture } from './multisport-core.mjs';

const TODAY = new Date();
const DAY = 86400000;
const API_KEY = process.env.EDGEIQ_ODDS_API_KEY || '';
// Opt-in to use a provider key ONLY after verifying the account's commercial display rights.
const RIGHTS = process.env.EDGEIQ_ODDS_DISPLAY_AUTHORIZED === 'true';
const ENABLE_PROPS = process.env.EDGEIQ_PROPS_ENABLED === 'true';
const MAX_PROPS = Math.min(40,Math.max(0,Number(process.env.EDGEIQ_MAX_PROP_EVENTS||'8')));
const START = Date.now();
const issues = [];
const dateUTC = (shift) => new Date(TODAY.getTime()+shift*DAY).toISOString().slice(0,10).replaceAll('-','');
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function json(url,headers={}) {
  for(let attempt=0;attempt<2;attempt++){
    try{
      const response=await fetch(url,{headers:{Accept:'application/json',...headers},signal:AbortSignal.timeout(13000)});
      if(response.status===429 && attempt===0){await sleep(900);continue}
      if(!response.ok)throw Error('HTTP '+response.status);
      return await response.json();
    }catch(err){if(attempt===1)throw err;await sleep(200)}
  }
}
async function grouped(items,parallel,callback) {
  const results=[];
  for(let start=0;start<items.length;start+=parallel) {
    results.push(...await Promise.all(items.slice(start,start+parallel).map(callback)));
  }
  return results;
}
function toTeamGame(game) {
  return {id:game.id,league:game.league,time:game.time,home:game.home,away:game.away,
    form:null,markets:[],marketSource:'No authenticated sportsbook snapshot',source:'ESPN public scoreboard (unofficial)'};
}
// ESPN date queries group by league-local calendar day, while kickoff timestamps are UTC.
// Do not drop cross-midnight games; deduplicate by the stable ESPN event ID.
async function fetchESPN(feed) {
  const dates=Array.from({length:30},(_,i)=>i-20);
  const collected=await grouped(dates,9,async shift=>{
    const date=dateUTC(shift);
    try {
      const data=await json('https://site.api.espn.com/apis/site/v2/sports/'+feed.espn+'/scoreboard?dates='+date+'&limit=500');
      return (Array.isArray(data.events)?data.events:[])
        .map(e=>parseESPNEvent(e,feed.league)).filter(Boolean);
    } catch(error) {
      issues.push(feed.league+' schedule '+date+': '+String(error));
      return [];
    }
  });
  const map=new Map();
  for(const event of collected.flat())map.set(event.id,event);
  const all=[...map.values()].sort((a,b)=>a.time.localeCompare(b.time));
  const completed=all.filter(e=>e.completed && Date.parse(e.time)<START);
  const future=all.filter(e=>!e.completed && Date.parse(e.time)>START-10*60000 &&
    Date.parse(e.time)<START+10*DAY);
  return {completed,future};
}
function namesMatch(oddsGame,espnGame) {
  return matchByFixture([espnGame],oddsGame.home_team,oddsGame.away_team,oddsGame.commence_time);
}
function validOddsEvent(game) {
 return !!game?.id && !!game.home_team && !!game.away_team &&
    Date.parse(game.commence_time)>START-10*60000 &&
    Date.parse(game.commence_time)<START+14*DAY;
}
async function fetchOdds(feed) {
  const url='https://api.the-odds-api.com/v4/sports/'+encodeURIComponent(feed.odds)+'/odds?regions=us&markets=h2h,spreads,totals&oddsFormat=american&dateFormat=iso';
  try {
    const list=await json(url,{'x-api-key':API_KEY});
    return Array.isArray(list)?list.filter(validOddsEvent):[];
  } catch(error) {
    issues.push(feed.league+' odds: '+String(error));
    return [];
  }
}
let propCalls=0;
async function fetchProps(feed,event) {
  if(!ENABLE_PROPS || propCalls>=MAX_PROPS) return [];
  if(!SPORTS[feed.sport].props.length)return [];
  propCalls++;
  const url='https://api.the-odds-api.com/v4/sports/'+encodeURIComponent(feed.odds)+
    '/events/'+encodeURIComponent(event.id)+'/odds?regions=us&markets='+
    encodeURIComponent(SPORTS[feed.sport].props.join(','))+'&oddsFormat=american';
  try {
    const result=await json(url,{'x-api-key':API_KEY});
    return pairMarketQuotes(result.bookmakers,new Date());
  } catch(error) {
    // Not all providers/bookmakers support each listed prop in every sport.
    issues.push(feed.league+' prop market unavailable: '+String(error));
    return [];
  }
}
async function main() {
  const allowed=Boolean(API_KEY && RIGHTS);
  const results={};
  for (const [sport,config] of Object.entries(SPORTS)) {
    const leagues=[];
    for (const feedConfig of config.feeds) {
      const feed={...feedConfig,sport};
      const source=await fetchESPN(feed);
      let games=source.future.map(toTeamGame);
      for(const game of games)game.form={
        home:recentForm(source.completed,game.home.id),
        away:recentForm(source.completed,game.away.id),
        context:matchupEvidence(source.completed,game)};
      if(allowed) {
        const odds=await fetchOdds(feed);
        // Limit market comparisons to validated odds events; do not create
        // synthetic thresholds from historical player performance.
        for(const oddsEvent of odds) {
          let match=games.find(game=>namesMatch(oddsEvent,game));
          if(!match){
            match={
              id:'odds:'+oddsEvent.id,league:feed.league,time:oddsEvent.commence_time,
              home:{id:'',name:oddsEvent.home_team,short:'',score:null},
              away:{id:'',name:oddsEvent.away_team,short:'',score:null},
              form:null,markets:[],marketSource:'The Odds API (snapshot)',source:'The Odds API (bookmaker fixture)'};
            games.push(match);
          }
          match.marketSource='The Odds API (bookmaker snapshot)';
          match.markets=pairMarketQuotes(oddsEvent.bookmakers,new Date());
          match.providerEventId=oddsEvent.id;
          if(ENABLE_PROPS && Date.parse(oddsEvent.commence_time)<START+3*DAY)
            match.markets.push(...await fetchProps(feed,oddsEvent));
        }
      }
      games=games.filter(g=>Date.parse(g.time)>START-10*60000)
        .sort((a,b)=>a.time.localeCompare(b.time)).slice(0,85);
      leagues.push({league:feed.league,games,completedSamples:source.completed.length,
        oddsConfigured:allowed,updatedAt:new Date().toISOString()});
      console.log(sport,feed.league, 'upcoming',games.length,
        'recent completed',source.completed.length,'with markets',games.filter(g=>g.markets.length).length);
    }
    results[sport]={label:config.label,leagues};
  }
  const publication={
    schemaVersion:1,generatedAt:new Date().toISOString(),
    oddsStatus:allowed?'PROVIDER_SNAPSHOT':'NOT_CONFIGURED',
    methodology:'Displayed team form is observed completed-game history, not a predictive win rate. Bookmaker markets are displayed only with owner-authorized The Odds API access; no synthetic prop lines. Market-implied/no-vig percentages are not model-calibrated probabilities or guaranteed outcomes.',
    researchWindow:'ESPN public completed scoreboards in the preceding 20 days. Fewer than 5 samples are labeled as such.',
    sports:results,issues:issues.slice(0,35),
  };
  await mkdir('public',{recursive:true});
  const path='public/edgeiq-multisport.json';
  await writeFile(path,JSON.stringify(publication,null,2)+'\n');
  console.log('Published',path,'size',JSON.stringify(publication).length,'issues',issues.length,
    'props requests',propCalls,'elapsedSeconds',Math.round((Date.now()-START)/1000));
}
main().catch(error=>{console.error(error);process.exitCode=1});
