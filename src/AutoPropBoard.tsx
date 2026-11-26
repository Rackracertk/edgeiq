import {propGroups,propCatalog} from './analytics/propCatalog'
import {useEffect,useMemo,useState} from 'react'
import {leagues,normalizeEvents,clean,type Fixture,type ScriptSport} from './analytics/scriptSports'
import {buildPropBoard,groupPlayerBoard,type RosterPlayer} from './analytics/propBoard'
import {selectMajorOdds} from './analytics/majorOdds'
import PublicGameEvidence from './PublicGameEvidence'
import PlayerBoardTile from './PlayerBoardTile'
import './AutoPropBoard.css'
type Snapshot=Parameters<typeof selectMajorOdds>[0]
type BoardMode='current'|'past'|'all'
const dayET=(date:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(date)
const time=(v:string)=>new Date(v).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})
const positionKey=(p:string)=>p.trim().toUpperCase().replace(/[- ]/g,'')
function relevantPosition(sport:string,stat:string,p:string){
 if(!['NFL','NCAAF'].includes(sport)||!stat)return true
 const q=positionKey(p), skill=['QB','RB','FB','HB','WR','TE'], rush=['QB','RB','FB','HB'], receive=['WR','TE','RB','FB','HB'], defense=['DE','DT','DL','NT','LB','ILB','OLB','MLB','EDGE','CB','DB','S','FS','SS','SAF']
 let allowed:string[]|undefined
 if(/Field Goal|Extra Points|Kicking/.test(stat))allowed=['K','PK']
 else if(/Tackles|Sacks|Forced Fumbles|Defensive Interceptions/.test(stat))allowed=defense
 else if(/Passing \+ Rushing \+ Receiving|Touchdown|Fantasy Points/.test(stat))allowed=skill
 else if(/Passing/.test(stat)||/Interceptions Thrown|Longest Completion/.test(stat))allowed=['QB']
 else if(/Rushing \+ Receiving/.test(stat))allowed=skill
 else if(/Rushing|Longest Rush/.test(stat))allowed=rush
 else if(/Receiving|Reception/.test(stat))allowed=receive
 return !allowed||allowed.includes(q)
}
export default function AutoPropBoard({sport,initialGame}:{sport:ScriptSport;initialGame?:Fixture}){
 const [day,setDay]=useState(dayET(initialGame?new Date(initialGame.date):new Date())),[league,setLeague]=useState(initialGame?.league??leagues[sport][0][0]),[games,setGames]=useState<Fixture[]>(initialGame?[initialGame]:[]),[gameId,setGameId]=useState(initialGame?.id??''),[query,setQuery]=useState(''),[category,setCategory]=useState(''),[book,setBook]=useState(''),[team,setTeam]=useState(''),[position,setPosition]=useState('auto'),[limit,setLimit]=useState(24),[snapshot,setSnapshot]=useState<Snapshot|null>(null),[roster,setRoster]=useState<RosterPlayer[]>([]),[loading,setLoading]=useState(true),[issue,setIssue]=useState(''),[refresh,setRefresh]=useState(0),[now,setNow]=useState(Date.now()),[selected,setSelected]=useState(''),[mode,setMode]=useState<BoardMode|null>(null)
 const feed=leagues[sport].find(l=>l[0]===league)??leagues[sport][0]
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),15000);return()=>clearInterval(t)},[])
 useEffect(()=>{let active=true;const c=new AbortController();setLoading(true);setIssue('');setGames([]);const timer=setTimeout(()=>c.abort(),15000)
 void fetch('https://site.api.espn.com/apis/site/v2/sports/'+feed[1]+'/scoreboard?dates='+day.replaceAll('-','')+'&limit=500',{signal:c.signal,cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Schedule unavailable');return r.json()}).then(data=>{if(!active)return;const list=normalizeEvents(data,feed[0],feed[1]).sort((a,b)=>a.date.localeCompare(b.date));setGames(list);setGameId(id=>list.some(g=>g.id===id)?id:'')}).catch(()=>{if(active)setIssue('Game schedule unavailable. Try refreshing.')}).finally(()=>{clearTimeout(timer);if(active)setLoading(false)});return()=>{active=false;clearTimeout(timer);c.abort()}},[sport,feed[0],feed[1],day,refresh])
 useEffect(()=>{let active=true;const c=new AbortController();const load=()=>void fetch('/edgeiq-major-odds.json',{signal:c.signal,cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{if(active&&data.schemaVersion===1)setSnapshot(data)}).catch(()=>{});load();const timer=setInterval(load,60000);return()=>{active=false;clearInterval(timer);c.abort()}},[refresh])
 useEffect(()=>{let active=true;setRoster([]);if(sport!=='NBA'&&sport!=='NFL')return;void fetch('/edgeiq-current-rosters.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{if(!active||data.schemaVersion!==1||!Number.isFinite(Date.parse(data.generatedAt))||Date.now()-Date.parse(data.generatedAt)>18*3600000||Date.parse(data.generatedAt)>Date.now()+60000)return;const records=Object.entries(data[sport]??{}) as [string,{name?:string;teamId?:string;teamName?:string;team?:string;position?:string}][];setRoster(records.flatMap(([id,p])=>p.name&&p.teamId?[{id,name:p.name,teamId:p.teamId,team:p.teamName??p.team??'',position:p.position??''}]:[]))}).catch(()=>{});return()=>{active=false}},[sport,refresh])
 const slate=games.filter(g=>!gameId||g.id===gameId)
 const offers=useMemo(()=>buildPropBoard(snapshot,slate,sport,now),[snapshot,slate,sport,now])
 const archivedOffers=useMemo(()=>buildPropBoard(snapshot,slate,sport,now,48*60).filter(o=>!offers.some(f=>f.key===o.key)),[snapshot,slate,sport,now,offers])
 const boardMode=mode??(offers.length?'current':archivedOffers.length?'past':'all')
 const boardOffers=boardMode==='current'?offers:boardMode==='past'?archivedOffers:[...offers,...archivedOffers]
 const groups=useMemo(()=>groupPlayerBoard(boardOffers,roster,slate).filter(g=>boardMode==='all'||g.offers.length>0),[boardOffers,roster,slate,boardMode])
 const categories=[...new Set([...propCatalog(sport),...boardOffers.map(o=>o.category)])],books=[...new Set(boardOffers.map(o=>o.book))].sort(),teams=[...new Map(slate.flatMap(g=>g.participants).map(t=>[t.id,t])).values()]
 const positions=[...new Set(groups.filter(g=>!team||g.player?.teamId===team).map(g=>positionKey(g.player?.position??'')).filter(Boolean))].sort()
 const filtered=groups.flatMap(g=>{
  if(team&&g.player?.teamId!==team)return []
  if(position!=='auto'&&position!=='all'&&positionKey(g.player?.position??'')!==position)return []
  const nameMatch=!query||clean(g.name+' '+(g.player?.team??'')+' '+(g.player?.position??'')).includes(clean(query))
  const available=g.offers.filter(o=>(!categories.includes(category)||o.category===category)&&(!books.includes(book)||o.book===book)&&(nameMatch||clean(o.category+' '+o.game.participants.map(t=>t.name).join(' ')).includes(clean(query))))
  if(available.length)return [{...g,offers:available}]
  return boardMode==='all'&&!book&&nameMatch&&(position!=='auto'||relevantPosition(sport,category,g.player?.position??''))?[{...g,offers:[]}]:[]
 })
 const fallbackGame=slate.find(g=>g.id===gameId)??slate[0]
 function reset(){setLimit(24);setSelected('')}
 function changeMode(value:BoardMode){setMode(value);setBook('');setCategory('');setPosition('auto');reset()}
 function clearFilters(){setQuery('');setCategory('');setPosition('auto');setBook('');setTeam('');setPosition('auto');reset()}
 return <div className="auto-props">
 <section className="prop-board-hero"><h1>{sport} Player Props</h1><p>Choose a matchup, find a player, compare lines.</p></section>
 <section className="panel prop-board-games"><div className="panel-title"><h2>Games</h2><button className="nav" onClick={()=>setRefresh(v=>v+1)}>Refresh</button></div>
 <div className="prop-board-date"><label>Date (ET)<input type="date" value={day} onChange={e=>{if(e.target.value){setDay(e.target.value);setGameId('');setTeam('');setPosition('auto');reset()}}}/></label>{leagues[sport].length>1&&<label>League<select value={league} onChange={e=>{setLeague(e.target.value);setGameId('');setTeam('');setPosition('auto');reset()}}>{leagues[sport].map(l=><option key={l[0]}>{l[0]}</option>)}</select></label>}</div>
 <div className="prop-game-strip"><button className={'prop-game '+(!gameId?'active':'')} aria-pressed={!gameId} onClick={()=>{setGameId('');setTeam('');setPosition('auto');reset()}}><strong>All games</strong><small>{games.length} matchups</small></button>{games.map(g=><button className={'prop-game '+(gameId===g.id?'active':'')} key={g.id} aria-pressed={gameId===g.id} onClick={()=>{setGameId(g.id);setTeam('');setPosition('auto');reset()}}><div className="prop-game-teams">{g.participants.map(p=><span key={p.id}>{p.logo&&<img src={p.logo} alt="" loading="lazy"/>}<b>{p.short||p.name}</b></span>)}</div><small>{time(g.date)} · {g.status}</small></button>)}</div>
 {loading?<p role="status">Loading games…</p>:issue?<p role="status">{issue}</p>:!games.length?<p>No games found for this date. Choose another date.</p>:null}</section>
 <section className="panel prop-board-controls"><div className="panel-title"><h2>Players</h2><span className="small-tag">{filtered.length} players</span></div>
 <div className="prop-mode-strip" aria-label="Line availability">{([['current','Current lines',offers.length],['past','Past lines',archivedOffers.length],['all','All players',null]] as const).map(([value,label,count])=><button type="button" key={value} aria-pressed={boardMode===value} onClick={()=>changeMode(value)}>{label}{count!==null&&<small> {count}</small>}</button>)}</div>
 <p className="prop-mode-note" role="status">{boardMode==='current'?(offers.length?'Published quotes observed within the last 15 minutes.':'No current prices published. Try Past lines or All players.') : boardMode==='past'?'Historical quotes only — not currently offered prices.':'Includes players without sportsbook lines for historical research.'}</p>
 <div className="prop-board-search"><label>Search<input value={query} onChange={e=>{setQuery(e.target.value);reset()}} placeholder="Player, team or stat…"/></label><label>Stat<select value={categories.includes(category)?category:''} onChange={e=>{setCategory(e.target.value);setPosition('auto');reset()}}><option value="">All props</option>{Object.entries(propGroups(sport)).map(([label,items])=><optgroup key={label} label={label}>{items.map(m=><option key={m}>{m}</option>)}</optgroup>)}{categories.filter(m=>!propCatalog(sport).includes(m)).map(m=><option key={m}>{m}</option>)}</select></label>{roster.length>0&&<label>Team<select value={teams.some(t=>t.id===team)?team:''} onChange={e=>{setTeam(e.target.value);setPosition('auto');reset()}}><option value="">All teams</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}{positions.length>0&&<label>Position<select value={position} onChange={e=>{setPosition(e.target.value);reset()}}><option value="auto">Auto (by stat)</option><option value="all">All positions</option>{positions.map(p=><option key={p} value={p}>{p}</option>)}</select></label>}</div>
 {(query||category||book||team||position!=='auto')&&<button type="button" className="prop-clear" onClick={clearFilters}>Clear filters</button>}
 <details className="prop-more-filters"><summary>More filters</summary><div className="prop-board-search"><label>Sportsbook<select value={books.includes(book)?book:''} onChange={e=>{setBook(e.target.value);reset()}}><option value="">All sportsbooks</option>{books.map(b=><option key={b}>{b}</option>)}</select></label></div></details>
 {filtered.length?<div className="prop-board-grid">{filtered.slice(0,limit).map(g=><PlayerBoardTile key={g.key} group={g} sport={sport} now={now} requestedStat={category||undefined} open={selected===g.key} onOpen={()=>setSelected(s=>s===g.key?'':g.key)}/>)}</div>:<p role="status">{loading?'Loading players…':groups.length?'No players match these filters.':boardMode==='all'?'No published players for these games.':'No lines in this view. Switch availability above to explore other research.'}</p>}
 {filtered.length>limit&&<button className="nav" onClick={()=>setLimit(n=>n+24)}>Show more players ({filtered.length-limit} remaining)</button>}
 <p className="footnote">Stat categories are research options. A line or historical sample is shown only when available. Expired lines are historical only.</p></section>
 {boardMode==='all'&&!groups.length&&fallbackGame&&!loading&&<PublicGameEvidence key={fallbackGame.path+fallbackGame.id} game={fallbackGame} showPlayers/>}
 </div>
}
