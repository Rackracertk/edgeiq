import {useEffect,useMemo,useState} from 'react'
import type {CheatSport,Slate} from './cheatSheetData'
import type {ElitePick} from './analytics/eliteResearch'
import {easternDate,loadInjuryReport,type InjuryData} from './analytics/injuryCenter'
import {injuryAvailability,findInjury,shouldExcludeInjury} from './analytics/injuryStatus'
import {teamFor,teamName,teamMatches} from './analytics/teamDirectory'

type Board=Slate & {picks:ElitePick[];allPicks?:ElitePick[];report:InjuryData;sourceCompleteness:string;historicalGames:number;marketStatus?:string}
type Publication={schemaVersion:number;generatedAt:string;boards:Record<CheatSport,Board[]>}
const format=(date:string)=>Number.isFinite(Date.parse(date))?new Date(date).toLocaleString():'Unknown'
const rate=(pick:ElitePick)=>pick.recentGames>0?Math.round(pick.recentHits/pick.recentGames*100):0
const threshold=(pick:ElitePick)=>pick.direction.toUpperCase()+' '+pick.line+' '+pick.category
export default function TheScript({onCheat,onInjuries,onLive}:{onCheat:()=>void;onInjuries:()=>void;onLive:()=>void}){
 const [sport,setSport]=useState<CheatSport>('NBA')
 const [day,setDay]=useState('today')
 const [query,setQuery]=useState('')
 const [selected,setSelected]=useState('')
 const [pub,setPub]=useState<Publication|null>(null)
 const [report,setReport]=useState<InjuryData|null>(null)
 const [busy,setBusy]=useState(true)
 const [error,setError]=useState('')
 const [refresh,setRefresh]=useState(0)
 useEffect(()=>{
  let active=true
  setBusy(true);setError('')
  async function load(){
   try{const res=await fetch('/edgeiq-daily.json?updated='+Date.now(),{cache:'no-store'});if(!res.ok)throw Error('Published research unavailable');const data=await res.json() as Publication;if(data.schemaVersion!==1||!data.boards||!Number.isFinite(Date.parse(data.generatedAt)))throw Error('Invalid research snapshot');if(active)setPub(data)}
   catch(e){if(active){setPub(null);setError(e instanceof Error?e.message:'Research unavailable')}}
   finally{if(active)setBusy(false)}
  }
  void load()
  const timer=window.setInterval(()=>void load(),600000)
  return()=>{active=false;window.clearInterval(timer)}
 },[refresh])
 useEffect(()=>{let active=true;setReport(null);void loadInjuryReport(sport).then(r=>{if(active)setReport(r)}).catch(()=>{});const timer=window.setInterval(()=>{void loadInjuryReport(sport).then(r=>{if(active)setReport(r)}).catch(()=>{})},600000);return()=>{active=false;window.clearInterval(timer)}},[sport,refresh])
 const fresh=!!pub&&Date.now()-Date.parse(pub.generatedAt)<18*3600000
 const today=easternDate(new Date()).replaceAll('-','')
 const board=fresh?(pub?.boards[sport]??[]).filter(b=>day==='today'?b.date===today:b.date>today).find(b=>b.games.some(g=>Date.parse(g.date)>Date.now())):undefined
 const games=(board?.games??[]).filter(g=>Date.parse(g.date)>Date.now()&&g.teams.some(t=>teamMatches(sport,t.abbreviation,query)||teamMatches(sport,t.name,query)))
 const game=games.find(g=>g.id===selected)??games[0]
 const gameTeams=game?.teams??[]
 const reportCurrent=report?.available===true&&Date.now()-Date.parse(report.checkedAt)<15*60000
 const injuries=reportCurrent?report!.injuries:[]
 const relevant=injuries.filter(r=>gameTeams.some(t=>r.teamId===t.id||teamFor(sport,r.team)?.code===teamFor(sport,t.abbreviation)?.code&&!!teamFor(sport,r.team)))
 const evidence=useMemo(()=>{
  if(!game||!board)return []
  const teams=new Set(game.teams.map(t=>t.abbreviation))
  const seen=new Set<string>()
  return [...(board.allPicks??board.picks??[])].filter(p=>teams.has(p.team)&&p.gameTime===game.date&&p.recentGames>0&&!shouldExcludeInjury(findInjury(injuries,p.playerId,p.player,p.team,game.teams.find(t=>t.abbreviation===p.team)?.id??'')))
   .sort((a,b)=>Number(!!b.defense)-Number(!!a.defense)||b.researchScore-a.researchScore||b.recentGames-a.recentGames)
   .filter(p=>{const k=p.playerId;if(seen.has(k))return false;seen.add(k);return true}).slice(0,6)
 },[game,board,injuries])
 return <div className="script-page">
  <section className="hero script-hero"><div className="eyebrow gold">EDGEIQ INTELLIGENCE / PUBLIC-DATA BRIEFING</div><h1>The <span className="gold">Script.</span></h1><p>A game-by-game briefing on the matchup, player trends, availability, and what could change the story. Evidence first. Scenarios, not promises.</p><div className="script-hero-meta"><span>01 / MATCHUP</span><span>02 / AVAILABILITY</span><span>03 / PLAYER EVIDENCE</span></div></section>
  <div className="revamp-filter"><label>LEAGUE<select value={sport} onChange={e=>{setSport(e.target.value as CheatSport);setSelected('');setQuery('')}}><option>NBA</option><option>NFL</option></select></label><label>SLATE<select value={day} onChange={e=>{setDay(e.target.value);setSelected('')}}><option value="today">Today (ET)</option><option value="next">Next scheduled slate</option></select></label><label>FIND A MATCHUP<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Team, city or abbreviation"/></label><button className="cta" onClick={()=>setRefresh(x=>x+1)} disabled={busy}>Refresh briefing</button></div>
  <p className="footnote" role="status">{busy?'Checking published research…':error||(!fresh?'Research snapshot expired or unavailable. No current briefing can be verified.':'Published '+format(pub!.generatedAt))} · {reportCurrent?'Injuries checked '+format(report!.checkedAt):'Current injury verification unavailable'} · Public research, not private insider information.</p>
  {!game?<section className="panel"><h2>{busy?'Loading briefing':'No verified upcoming matchup'}</h2><p>Try another team or slate. Stale or absent research is not replaced with invented game information.</p><button className="nav" onClick={onCheat}>Open Daily Cheat Sheet</button></section>:<>
  <div className="script-games" role="group" aria-label="Choose matchup">{games.map(g=><button className={'nav '+(g.id===game.id?'active':'')} key={g.id} onClick={()=>setSelected(g.id)}>{g.teams.map(t=>t.abbreviation).join(' vs ')}<small>{format(g.date)}</small></button>)}</div>
  <section className="panel script-match"><div className="eyebrow gold">MATCHUP BRIEFING · {sport}</div><h2>{gameTeams.map(t=>t.name||teamName(sport,t.abbreviation)).join(' vs ')}</h2><p>{format(game.date)} · {board?.sourceCompleteness==='COMPLETE'?'Published source coverage complete':'Published source coverage partial'} · {board?.historicalGames??0} historical games in publication</p><div className="script-kpis"><div><small>RESEARCHED PLAYERS</small><strong>{evidence.length}</strong></div><div><small>REPORTED OUT / RISK</small><strong>{reportCurrent?relevant.filter(r=>shouldExcludeInjury(r)).length:'—'}</strong></div><div><small>MARKET COVERAGE</small><strong className="script-small">{board?.marketStatus==='VERIFIED_QUOTES'?'Published quotes*':'Not verified here'}</strong></div></div><p className="footnote">*Check Game Lines for actual current offers; publication status alone does not establish a current price.</p></section>
  <div className="script-columns"><section className="panel"><span className="eyebrow gold">01 · WHAT COULD CHANGE THE GAME</span><h3>Availability watch</h3>{!reportCurrent?<p>Current injuries cannot be verified. Do not infer that any player is available.</p>:relevant.length?relevant.map((r,i)=><div className="script-line" key={r.playerId+'-'+i}><div><strong>{r.player}</strong><small>{teamName(sport,r.team)} · {r.reason||'Reason not supplied'}</small></div><span className={'injury-status '+injuryAvailability(r.status)}>{r.status}</span></div>):<p>No matching injury entries. This does not establish an active lineup.</p>}<button className="nav" onClick={onInjuries}>Open Injury Center ↗</button></section>
  <section className="panel"><span className="eyebrow gold">02 · SCENARIO MAP</span><h3>How to read this matchup</h3>{evidence.some(p=>p.defense)?<p>Position-matched historical evidence exists for {evidence.filter(p=>p.defense).length} featured players. Review the opponent sample below and compare it with current roles.</p>:<p>Opponent-position evidence is limited for this matchup. Historical player thresholds alone cannot establish a likely game script.</p>}{relevant.some(r=>shouldExcludeInjury(r))?<p><strong>Availability scenario:</strong> If listed unavailable or uncertain players miss the game, roles may shift. Confirm the actual lineup and minutes or snaps; no replacement usage is assumed.</p>:<p><strong>Lineup scenario:</strong> Recheck starters and roles before using historical comparisons.</p>}<p><strong>In-game scenario:</strong> Once play begins, compare live production with elapsed game time and role changes. Do not assume first-half pace repeats.</p><button className="nav" onClick={onLive}>Open Halftime Edge ↗</button></section></div>
  <section className="panel"><div className="panel-title"><div><span className="eyebrow gold">03 · PLAYER EVIDENCE</span><h3>Research watchlist</h3></div><button className="cta" onClick={onCheat}>Full cheat sheet ↗</button></div><p className="footnote">One reference threshold per featured player, ordered by evidence score and matchup coverage. These are historical observations, not offered lines, win probabilities or predictions.</p>{evidence.length?<div className="script-evidence-grid">{evidence.map(p=><article className="script-evidence" key={p.id}><small>{teamName(sport,p.team)} · {p.researchGrade}</small><h3>{p.player}</h3><strong>{threshold(p)}</strong><div className="script-line"><span>Recent completed games</span><b>{p.recentHits}/{p.recentGames} · {rate(p)}%</b></div><div className="script-line"><span>Last 5</span><b>{p.l5Hits}/{p.l5Games}</b></div><p>{p.defense?'Opponent position: '+p.defense.hits+'/'+p.defense.games+' appearances across '+p.defense.distinctGames+' games.':'Opponent-position sample unavailable.'}</p><p>{p.headToHead?'Head-to-head: '+p.headToHead.hits+'/'+p.headToHead.games:'Head-to-head evidence limited.'}</p><small>Risk: {reportCurrent?'Confirm active role and market line.':'Current injury verification unavailable.'}</small></article>)}</div>:<p>No qualifying player evidence is published for this game.</p>}</section>
  </>}
 </div>
}
