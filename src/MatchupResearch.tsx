import {useEffect,useState} from 'react'
import Home from './Home'
import PublicGameEvidence from './PublicGameEvidence'
import ScriptSlips from './ScriptSlips'
import {selectMajorOdds} from './analytics/majorOdds'
import {marketGroup,type Fixture,type ScriptSport} from './analytics/scriptSports'
import type {SlipQuote} from './analytics/slipResearch'
import './ScriptTerminal.css'
const odds=(v:number|null)=>v===null?'—':v>0?'+'+v:String(v)
export default function MatchupResearch({sport,mode,initialGame,onPlayers}:{sport:ScriptSport;mode:'lines'|'players';initialGame?:Fixture;onPlayers?:()=>void}){
 const [game,setGame]=useState<Fixture|null>(initialGame??null),[quotes,setQuotes]=useState<SlipQuote[]>([]),[book,setBook]=useState(''),[market,setMarket]=useState(''),[refresh,setRefresh]=useState(0),[busy,setBusy]=useState(false),[now,setNow]=useState(Date.now())
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),15000);return()=>clearInterval(timer)},[])
 useEffect(()=>{let active=true;setQuotes([]);setBook('');setMarket('');if(!game||mode!=='lines')return;setBusy(true);const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000)
 void fetch('/edgeiq-major-odds.json',{cache:'no-store',signal:controller.signal}).then(r=>{if(!r.ok)throw Error('Odds unavailable');return r.json()}).then(data=>{if(active)setQuotes(selectMajorOdds(data,game,sport,Date.now()))}).catch(()=>{}).finally(()=>{clearTimeout(timer);if(active)setBusy(false)});return()=>{active=false;controller.abort();clearTimeout(timer)}},[game,mode,sport,refresh])
 const fresh=quotes.filter(q=>Date.parse(q.observedAt)>=now-15*60000&&Date.parse(q.observedAt)<=now+60000&&game?.state==='pre'&&Date.parse(game.date)>now)
 const books=[...new Set(fresh.map(q=>q.book))].sort(),markets:string[]=[...new Set(fresh.map(q=>marketGroup(q.market)))].sort()
 const shown=fresh.filter(q=>(!books.includes(book)||q.book===book)&&(!markets.includes(market)||marketGroup(q.market)===market))
 return <div className="simple-matchup"><section className="hero"><span className="eyebrow gold">EDGEIQ · {sport}</span><h1>{mode==='lines'?'Game Lines':'Player Props'}</h1><p>{mode==='lines'?'Choose a matchup to compare current verified lines and recent team results.':'Choose a matchup to browse available player statistics.'}</p></section>
 {!game?<Home sport={sport} onOpen={setGame} picker/>:<><section className="panel"><div className="panel-title"><h2>Selected matchup</h2><button className="nav" onClick={()=>setGame(null)}>Change game</button></div><div className="st-teams st-matchup-logos">{game.participants.map(p=><div key={p.id}>{p.logo&&<img src={p.logo} alt={p.name+' logo'}/>}<strong>{p.name}</strong>{p.score!==null&&<b>{p.score}</b>}</div>)}<span className="st-versus">VS</span></div><p>{new Date(game.date).toLocaleString()} · {game.status}</p></section>
 {mode==='players'?<PublicGameEvidence key={game.path+game.id} game={game} showPlayers/>:<>
 <section className="panel"><div className="panel-title"><h2>Sportsbook odds</h2><button className="nav" disabled={busy} onClick={()=>setRefresh(r=>r+1)}>{busy?'Loading…':'Refresh snapshot'}</button></div>
 <div className="player-browser-filters"><label>Sportsbook<select value={books.includes(book)?book:''} onChange={e=>setBook(e.target.value)}><option value="">All books</option>{books.map(b=><option key={b}>{b}</option>)}</select></label><label>Market<select value={markets.includes(market)?market:''} onChange={e=>setMarket(e.target.value)}><option value="">All markets</option>{markets.map(m=><option key={m}>{m}</option>)}</select></label></div>
 {shown.length?<div className="table-wrap"><table><thead><tr><th>Player / Team</th><th>Market</th><th>Selection</th><th>Odds</th><th>Book</th></tr></thead><tbody>{shown.map((q,i)=><tr key={i}><td>{q.participant}</td><td>{q.category}</td><td>{q.side} {q.line??''}</td><td>{odds(q.odds)}</td><td>{q.book}</td></tr>)}</tbody></table></div>:<p role="status">{busy?'Checking available quotes…':'No fresh verified odds match this selection.'}</p>}<p className="footnote">The Odds API published snapshots; quotes expire after 15 minutes. Refresh reads the snapshot, not a new provider request.</p>{onPlayers&&<button className="nav" onClick={onPlayers}>Player research →</button>}</section>
 <details className="panel simple-extra"><summary>Betting slip research</summary><ScriptSlips key={game.id} game={game} quotes={fresh} evidence={[]} onRefresh={()=>setRefresh(r=>r+1)} busy={busy}/></details>
 <details className="panel simple-extra"><summary>Recent matchup results</summary><PublicGameEvidence key={game.path+game.id} game={game} showPlayers={false}/></details>
 </>}</>}
 </div>
}
