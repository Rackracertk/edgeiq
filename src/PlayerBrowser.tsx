import {useEffect,useMemo,useState} from 'react'
type Player={id:string|number;name:string;team?:string;position?:string}
type Props={players:Player[];selectedId:string;onSelect:(player:Player)=>void;loading?:boolean;title?:string;teamLabel?:string}
export default function PlayerBrowser({players,selectedId,onSelect,loading=false,title='Browse players',teamLabel='Team'}:Props){
 const [query,setQuery]=useState('')
 const [team,setTeam]=useState('')
 const [limit,setLimit]=useState(24)
 const teams=useMemo(()=>[...new Set(players.map(p=>p.team).filter((t):t is string=>!!t))].sort(),[players])
 useEffect(()=>{if(team&&!teams.includes(team))setTeam('')},[team,teams])
 const filtered=players.filter(p=>(!team||p.team===team)&&(!query||[p.name,p.team,p.position].join(' ').toLowerCase().includes(query.trim().toLowerCase())))
 return <section className="panel player-browser" aria-label={title}>
 <div className="player-browser-heading"><div><span className="eyebrow gold">PLAYER DIRECTORY</span><h2>{title}</h2></div><span className="small-tag">{filtered.length} available</span></div>
 <div className="player-browser-filters"><label>{teamLabel}<select value={team} onChange={e=>{setTeam(e.target.value);setLimit(24)}}><option value="">All {teamLabel.toLowerCase()}s</option>{teams.map(t=><option key={t}>{t}</option>)}</select></label><label>Search (optional)<input value={query} onChange={e=>{setQuery(e.target.value);setLimit(24)}} placeholder="Find a player…"/></label></div>
 <div className="player-browser-grid">{filtered.slice(0,limit).map(p=><button type="button" key={String(p.id)} aria-pressed={selectedId===String(p.id)} className={'player-browser-item '+(selectedId===String(p.id)?'selected':'')} onClick={()=>onSelect(p)}><span className="player-browser-initials" aria-hidden="true">{p.name.split(/\s+/).filter(Boolean).slice(0,2).map(v=>v[0]).join('').toUpperCase()}</span><span><strong>{p.name}</strong><small>{[p.team,p.position].filter(Boolean).join(' · ')||'Recorded player'}</small></span><span aria-hidden="true">›</span></button>)}</div>
 {!filtered.length&&<p role="status">{loading?'Loading available players…':players.length?'No players match these filters.':'No verified players available for this selection.'}</p>}
 {filtered.length>limit&&<button className="nav player-browser-more" type="button" onClick={()=>setLimit(n=>n+24)}>Show more players ({filtered.length-limit} remaining)</button>}
 </section>
}
