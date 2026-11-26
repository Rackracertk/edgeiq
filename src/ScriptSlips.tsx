import {useEffect,useState} from 'react'
import {researchCandidates,buildResearchSlips,type SlipQuote,type SlipEvidence} from './analytics/slipResearch'
import type {Fixture} from './analytics/scriptSports'
const odds=(n:number|null)=>n===null?'—':n>0?'+'+n:String(n)
export default function ScriptSlips({game,quotes,evidence,onRefresh,busy}:{game:Fixture;quotes:SlipQuote[];evidence:SlipEvidence[];onRefresh:()=>void;busy:boolean}){
 const [book,setBook]=useState('')
 const [now,setNow]=useState(Date.now())
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),15000);return()=>clearInterval(timer)},[])
 const candidates=researchCandidates(quotes,evidence,now)
 const books=[...new Set(candidates.map(c=>c.quote.book))].sort()
 const chosen=books.includes(book)?book:books.find(b=>new Set(candidates.filter(c=>c.quote.book===b).map(c=>c.quote.participant.toLowerCase())).size>=2)??books[0]??''
 const slips=game.state==='pre'&&Date.parse(game.date)>now?buildResearchSlips(candidates,chosen):[]
 return <section className="panel st-slip-panel"><div className="panel-title"><div><span className="eyebrow gold">EDGEIQ · RESEARCH COMBINATIONS</span><h2>Betting slips</h2></div><button type="button" className="nav" disabled={busy} onClick={()=>{setNow(Date.now());onRefresh()}}>{busy?'Refreshing…':'Refresh lines'}</button></div>
 <p>Explore a couple of example combinations from current individual player markets. All legs use the same sportsbook; availability and acceptance as a same-game parlay must be checked with that book.</p>
 {game.state!=='pre'||Date.parse(game.date)<=now?<p role="status">Pregame combinations are available only before the event starts.</p>:!books.length?<p className="st-slip-empty" role="status">No fresh verified player-prop lines for this matchup. A licensed odds feed is required; historical thresholds cannot be used as sportsbook offers.</p>:<>
 <label className="st-slip-book">Sportsbook<select value={chosen} onChange={e=>setBook(e.target.value)}>{books.map(b=><option key={b}>{b}</option>)}</select></label>
 {!slips.length?<p role="status">Not enough distinct players with current lines at this book to form a combination.</p>:<div className="st-slip-grid">{slips.map(s=><article className="st-slip" key={s.label}><div className="eyebrow gold">{chosen} · {s.legs.length} LEGS</div><h3>{s.label}</h3>{s.legs.map((l,i)=><div className="st-slip-leg" key={i}><span className="st-slip-number">{i+1}</span><div><strong>{l.quote.participant}</strong><p>{l.quote.category} · {l.quote.side} {l.quote.line}</p><small>{l.evidence?'Historical: '+l.evidence.hits+'/'+l.evidence.games+' hits · '+l.evidence.pushes+' pushes':'No matched historical evidence'} </small><small>Observed {new Date(l.quote.observedAt).toLocaleTimeString()}</small></div><b>{odds(l.quote.odds)}</b></div>)}<p className="footnote">Combined odds: not supplied. Joint probability and compatibility are unverified.</p></article>)}</div>}
 </>}
 <p className="footnote">These are illustrative research combinations, not guaranteed picks or executable bets. More legs can increase risk, and same-game outcomes can be correlated. No stake or automatic betting is provided.</p></section>
}
