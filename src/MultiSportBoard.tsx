import { useEffect, useMemo, useState } from 'react';
import './MultiSportBoard.css';

export type AddedSport = 'MLB'|'NHL'|'NCAAF'|'NCAAB'|'SOCCER';
const SPORT_NAMES: Record<AddedSport,string> = {
  MLB:'MLB',NHL:'NHL',NCAAF:'College Football',NCAAB:'College Basketball',SOCCER:'Soccer'
};
const SPORT_IDS = Object.keys(SPORT_NAMES) as AddedSport[];
type Form = { games:number;wins:number;draws:number;losses:number;scoredAvg:number|null;
  concededAvg:number|null;results:string[] };
type Team = {id:string;name:string;short:string;score:number|null};
type Market = {id:string;market:string;category:string;participant:string;side:string;line:number|null;
  odds:number;sportsbook:string;books:number;noVigProbability:number|null;
  breakEvenProbability:number|null;priceComparison:number|null;observedAt:string};
type Context = {daysSinceLastGame:{home:number|null;away:number|null};
  homeVenue:Form;awayVenue:Form;headToHead:{games:number;homeWins:number;awayWins:number;
    draws:number;avgCombinedScore:number|null;latest:{time:string;homeTeam:string;
    homeScore:number;awayTeam:string;awayScore:number}|null}};
type Match = {id:string;league:string;time:string;home:Team;away:Team;
  form:{home:Form;away:Form;context?:Context}|null;markets:Market[];marketSource:string;source:string};
type League = {league:string;games:Match[];completedSamples:number;oddsConfigured:boolean;updatedAt:string};
type Publication = {schemaVersion:number;generatedAt:string;oddsStatus:string;
  researchWindow:string;methodology:string;sports:Record<AddedSport,{label:string;leagues:League[]}>;issues:string[]};
type Selection = {eventId:string;marketId:string;market:Market;match:Match};

const eastTime = (value:string) => {
 try{return new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',
  weekday:'short',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(value))}
 catch {return 'Time unavailable'}
};
const oddsFormat = (price:number) => price>0?'+'+price:String(price);
const pct = (value:number|null) => value===null?'N/A':value.toFixed(1)+'%';
const isPlayerProp = (market:Market) => market.market!=='h2h' && market.market!=='spreads' &&
 market.market!=='totals';
const freshOdds = (market:Market,now:number) =>
 Number.isFinite(Date.parse(market.observedAt)) && now-Date.parse(market.observedAt)<120*60000 &&
 Date.parse(market.observedAt)<=now+60000;
function FormSummary({form,title}:{form:Form|undefined;title:string}) {
 if(!form || !form.games)return <div className="multi-form"><strong>{title}</strong><small>Recent form unavailable</small></div>;
 return <div className="multi-form"><strong>{title}</strong>
   <span>{form.wins}W · {form.draws}D · {form.losses}L <small>last {form.games} final games</small></span>
   <span className="multi-result-line">{form.results.map((result,i)=><b key={i} className={'multi-result multi-result-'+result}>{result}</b>)}</span>
   <small>Scored {form.scoredAvg ?? '—'} / allowed {form.concededAvg ?? '—'} per game</small>
 </div>
}
function MatchCard({match}:{match:Match}) {
 return <article className="multi-match">
   <div className="multi-match-head"><span>{match.league}</span><span>{eastTime(match.time)}</span></div>
   <h3>{match.away.name} <span className="multi-at">@</span> {match.home.name}</h3>
   <div className="multi-form-grid">
     <FormSummary title={match.away.short||match.away.name} form={match.form?.away}/>
     <FormSummary title={match.home.short||match.home.name} form={match.form?.home}/>
   </div>
   {match.form?.context&&<details className="multi-context">
     <summary>Rest, venue splits &amp; head-to-head</summary>
     <div className="multi-context-grid">
      <p><strong>${match.away.short||match.away.name}:</strong> ${match.form.context.daysSinceLastGame.away??"N/A"} full days since last recorded final. On the road: ${match.form.context.awayVenue.wins}W–${match.form.context.awayVenue.draws}D–${match.form.context.awayVenue.losses}L (last ${match.form.context.awayVenue.games} qualifying road games).</p>
      <p><strong>${match.home.short||match.home.name}:</strong> ${match.form.context.daysSinceLastGame.home??"N/A"} full days since last recorded final. At home: ${match.form.context.homeVenue.wins}W–${match.form.context.homeVenue.draws}D–${match.form.context.homeVenue.losses}L (last ${match.form.context.homeVenue.games} qualifying home games).</p>
     </div>
     {match.form.context.headToHead.games>0?<p>Recent head-to-head, last ${match.form.context.headToHead.games} within the observed 20-day history: home side ${match.form.context.headToHead.homeWins}W, away side ${match.form.context.headToHead.awayWins}W, ${match.form.context.headToHead.draws} draws. Average combined score: ${match.form.context.headToHead.avgCombinedScore}. These are earlier matchups, not predicted scores.</p>:<p>No completed head-to-head meetings found in the limited 20-day observation window.</p>}
    </details>}

   <p className="multi-caption">Observed scores only · recent results are not a predicted outcome. {match.markets.length>0?'Bookmaker markets in the cheat-sheet tab.':'No verified odds attached to this matchup.'}</p>
 </article>
}
export default function MultiSportBoard({initialSport='NHL',compact=false}:{initialSport?:AddedSport;compact?:boolean}) {
 const [sport,setSport]=useState<AddedSport>(initialSport);
 const [data,setData]=useState<Publication|null>(null);
 const [issue,setIssue]=useState('');
 const [loading,setLoading]=useState(true);
 const [retry,setRetry]=useState(0);
 const [league,setLeague]=useState('All leagues');
 const [view,setView]=useState<'cheatsheet'|'matchups'>('cheatsheet');
 const [marketFilter,setMarketFilter]=useState<'props'|'game'|'all'>('props');
 const [shortlist,setShortlist]=useState<Selection[]>([]);
 const [copyState,setCopyState]=useState('');
 useEffect(()=>{setSport(initialSport);setLeague('All leagues')},[initialSport]);
 useEffect(()=>{
   let cancelled=false;
   async function load(){
     try{
       const response=await fetch('/edgeiq-multisport.json?version='+Date.now(),{cache:'no-store'});
       if(!response.ok)throw Error('Research publication unavailable (HTTP '+response.status+').');
       const result=await response.json() as Publication;
       if(result.schemaVersion!==1 || !result.sports ||
          !Number.isFinite(Date.parse(result.generatedAt)) ||
          Date.parse(result.generatedAt)>Date.now()+120000 ||
          Date.now()-Date.parse(result.generatedAt)>36*3600000)throw Error('Research publication missing or expired.');
       if(!cancelled){setData(result);setIssue('')}
     }catch(error){if(!cancelled){setData(null);setIssue(error instanceof Error?error.message:'Data not connected')}}
     finally{if(!cancelled)setLoading(false)}
   }
   void load();
   const interval=window.setInterval(()=>void load(),10*60000);
   const focus=()=>void load();
   window.addEventListener('focus',focus);
   return()=>{cancelled=true;window.clearInterval(interval);window.removeEventListener('focus',focus)};
 },[retry]);
 const dataAge=data?Date.now()-Date.parse(data.generatedAt):Infinity;
 const leagueData=data?.sports?.[sport]?.leagues??[];
 const leagues=leagueData.map(row=>row.league);
 const allGames=useMemo(()=>leagueData.filter(row=>league==='All leagues'||row.league===league)
   .flatMap(row=>row.games).filter(game=>Date.parse(game.time)>Date.now()-600000)
   .sort((a,b)=>a.time.localeCompare(b.time)),[leagueData,league]);
 const currentTime=Date.now();
 const markets=useMemo(()=>allGames.flatMap(match=>match.markets
   .filter(row=>freshOdds(row,currentTime))
   .filter(row=>marketFilter==='all'||(marketFilter==='props'?isPlayerProp(row):!isPlayerProp(row)))
   .map(market=>({eventId:match.id,marketId:market.id,match,market})))
   .sort((a,b)=> {
      const qualityA=Number(a.market.books>=2 && a.market.priceComparison!==null && a.market.priceComparison>0);
      const qualityB=Number(b.market.books>=2 && b.market.priceComparison!==null && b.market.priceComparison>0);
      return qualityB-qualityA || b.market.books-a.market.books ||
        (b.market.priceComparison??-999)-(a.market.priceComparison??-999);
   }),[allGames,marketFilter,currentTime]);
 const topMarkets=markets.slice(0,compact?8:36);
 const hasFeed=data?.oddsStatus==='PROVIDER_SNAPSHOT';
 const isOld=dataAge>16*3600000;
 function toggle(row:Selection) {
  setCopyState('');
  setShortlist(prev=>prev.some(p=>p.eventId===row.eventId && p.marketId===row.marketId)
    ?prev.filter(p=>!(p.eventId===row.eventId&&p.marketId===row.marketId)):[...prev,row]);
 }
 function copy() {
  const content=shortlist.map(p=>p.match.away.name+' @ '+p.match.home.name+' | '+
    (p.market.participant?p.market.participant+' | ':'')+p.market.category+' | '+
    p.market.side+' '+(p.market.line??'')+' | '+oddsFormat(p.market.odds)+' ('+p.market.sportsbook+')').join('\n');
  if(!navigator.clipboard?.writeText){setCopyState('Clipboard not available in this browser.');return}
  void navigator.clipboard.writeText(content).then(()=>setCopyState('Copied research list.'),
    ()=>setCopyState('Clipboard permission denied.'));
 }
 return <div className={'multi-board'+(compact?' multi-compact':'')}>
   <section className="multi-head">
    <span className="eyebrow gold">EDGEIQ MULTI-SPORT INTELLIGENCE</span>
    <h2>Research the <span className="gold">real markets.</span></h2>
    <p>Five new sports. Matchup form from recorded final scores, plus authenticated sportsbook lines and player props when available. Historical form and bookmaker implied rates are <strong>not</strong> predicted hit rates.</p>
   </section>
   <div className="multi-tabs" role="group" aria-label="Choose sport">
    {SPORT_IDS.map(id=><button key={id} className={sport===id?'multi-selected':''}
      aria-pressed={sport===id} onClick={()=>{setSport(id);setLeague('All leagues');setCopyState('')}}>{SPORT_NAMES[id]}</button>)}
   </div>
   <div className="multi-toolbar">
    <div className="multi-tabs" role="group" aria-label="Choose research view">
      <button className={view==='cheatsheet'?'multi-selected':''} onClick={()=>setView('cheatsheet')}>Actual-Market Cheat Sheet</button>
      <button className={view==='matchups'?'multi-selected':''} onClick={()=>setView('matchups')}>Matchup Research</button>
    </div>
    {leagues.length>1&&<label className="multi-league">League <select value={league} onChange={e=>setLeague(e.target.value)}>
      <option>All leagues</option>{leagues.map(v=><option key={v}>{v}</option>)}</select></label>}
   </div>
   <div className="multi-status" role="status">
    {loading?'Loading published research…':issue?'Research unavailable: '+issue:
     (isOld?'Research snapshot is older than 16 hours · verify schedules independently. ':'')+
     'Published '+eastTime(data!.generatedAt)+' · '+allGames.length+' upcoming matches · '+
     (hasFeed?'Authorized bookmaker snapshot present':'Sportsbook feed not connected')}
   </div>
   {issue&&<button className="cta" onClick={()=>{setLoading(true);setRetry(x=>x+1)}}>Retry published data</button>}
   {!issue&&view==='matchups'&&<div className="multi-grid">
    {allGames.length?allGames.slice(0,compact?8:36).map(match=><MatchCard key={match.id+match.league} match={match}/>):
      <div className="multi-empty">No upcoming verified {SPORT_NAMES[sport]} fixtures in the published window. This can happen outside the season or during a data outage.</div>}
   </div>}
   {!issue&&view==='cheatsheet'&&<>
     <div className="multi-tabs multi-market-filters" role="group" aria-label="Select market category">
       <button className={marketFilter==='props'?'multi-selected':''} onClick={()=>setMarketFilter('props')}>Player Props</button>
       <button className={marketFilter==='game'?'multi-selected':''} onClick={()=>setMarketFilter('game')}>Game Lines</button>
       <button className={marketFilter==='all'?'multi-selected':''} onClick={()=>setMarketFilter('all')}>All Available</button>
     </div>
     <p className="multi-explainer">Only offered bookmaker lines are displayed. The percentage shown is a <strong>market-implied, margin-adjusted price</strong> when two-sided quotes exist—not an AI prediction. Books and lines can change; confirm directly before acting.</p>
     {topMarkets.length?<div className="multi-grid">{topMarkets.map(row=>{
       const m=row.market,selected=shortlist.some(p=>p.eventId===row.eventId&&p.marketId===row.marketId);
       return <article key={row.eventId+m.id} className="multi-pick">
         <div className="multi-match-head"><span>{row.match.league} · {m.books} {m.books===1?'book':'books'}</span><span>{eastTime(row.match.time)}</span></div>
         <p className="multi-venue">{row.match.away.name} @ {row.match.home.name}</p>
         <h3>{m.participant||'Game'} <span>{m.category}</span></h3>
         <div className="multi-line"><strong>{m.side} {m.line===null?'':m.line}</strong><strong>{oddsFormat(m.odds)}</strong></div>
         <p className="multi-caption">Best observed: {m.sportsbook} · updated {eastTime(m.observedAt)}</p>
         <div className="multi-metrics">
           <span>Break-even <b>{pct(m.breakEvenProbability)}</b></span>
           <span>No-vig market <b>{pct(m.noVigProbability)}</b></span>
           <span>Price difference <b>{m.priceComparison===null?'N/A':(m.priceComparison>0?'+':'')+m.priceComparison.toFixed(1)+' pts'}</b></span>
         </div>
         <p className="multi-caption">Comparison is price-only, not model-based EV or a win-probability forecast.</p>
         <button className={selected?'multi-save selected':'multi-save'} aria-pressed={selected}
           onClick={()=>toggle(row)}>{selected?'✓ In research list':'+ Save to research list'}</button>
       </article>
     })}</div>:<div className="multi-empty">
       <strong>No current verified {marketFilter==='props'?'player props':marketFilter==='game'?'game lines':'markets'}.</strong>
       <p>{!hasFeed?'A server-side sportsbook API key and display-rights authorization are required before EDGEIQ can display real book lines.':'No valid, recent bookmaker prices were published for this sport and filter. Individual leagues, seasons and books vary.'}</p>
       <button onClick={()=>setView('matchups')}>See verified schedules &amp; team form</button>
     </div>}
     {shortlist.length>0&&<div className="multi-shortlist"><span>{shortlist.length} verified-line research selections (not a bet slip)</span>
       <div><button onClick={copy}>Copy research list</button><button onClick={()=>setShortlist([])}>Clear</button></div>
       {copyState&&<p role="status">{copyState}</p>}</div>}
   </>}
   <p className="multi-legal">Data transparency: recorded final scores from an unofficial ESPN public source; market snapshots only from owner-authorized The Odds API access. Timezone: ET. Offseason sports may have no fixtures. Scores may be delayed; a 5-game trend, bookmaker consensus or favorable quoted price does not establish a profitable bet. No guaranteed results. 18+ where legal.</p>
 </div>;
}
