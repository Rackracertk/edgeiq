import {useState} from 'react'
import type {PlayerBoardGroup} from './analytics/propBoard'
import type {ScriptSport} from './analytics/scriptSports'
import PropBoardDetail from './PropBoardDetail'
const money=(n:number|null|undefined)=>n==null?'—':n>0?'+'+n:String(n)
export default function PlayerBoardTile({group,sport,open,onOpen,now}:{group:PlayerBoardGroup;sport:ScriptSport;open:boolean;onOpen:()=>void;now:number}){
 const [market,setMarket]=useState(''),[quoteKey,setQuoteKey]=useState(''),[side,setSide]=useState<'over'|'under'>('over')
 const markets=[...new Set(group.offers.map(o=>o.category))],category=markets.includes(market)?market:markets[0]
 const offers=group.offers.filter(o=>o.category===category).sort((a,b)=>{
  const age=(o:typeof a)=>now-Math.max(...[o.over,o.under].filter(Boolean).map(q=>Date.parse(q!.observedAt)))
  return Number(age(a)>900000)-Number(age(b)>900000)||Number(!!b.over&&!!b.under)-Number(!!a.over&&!!a.under)||a.book.localeCompare(b.book)||a.line-b.line
 })
 const offer=offers.find(o=>o.key===quoteKey)??offers[0]
 const selectedSide=offer?(offer[side]?side:offer.over?'over':'under'):side
 const observation=offer?.[selectedSide]
 const expired=!!observation&&now-Date.parse(observation.observedAt)>900000
 const p=group.player
 return <article className={'prop-tile '+(open?'selected':'')}><button type="button" className="prop-roster-button" onClick={onOpen} aria-expanded={open}>
 {p&&['NBA','NFL'].includes(sport)?<img className="prop-headshot" src={'https://a.espncdn.com/i/headshots/'+sport.toLowerCase()+'/players/full/'+encodeURIComponent(p.id)+'.png'} alt="" loading="lazy" onError={e=>{e.currentTarget.style.display='none'}}/>:<span className="prop-avatar">{group.name.split(' ').map(s=>s[0]).slice(0,2).join('')}</span>}
 <span><strong>{group.name}</strong><small>{p?[p.team,p.position].filter(Boolean).join(' · '):group.game.participants.map(t=>t.short||t.name).join(' vs ')}</small></span></button>
 {offer?<>{open&&<div className="single-prop-controls"><label>Stat<select value={category} onChange={e=>{setMarket(e.target.value);setQuoteKey('')}}>{markets.map(m=><option key={m}>{m}</option>)}</select></label><label>Book / line<select value={offer.key} onChange={e=>setQuoteKey(e.target.value)}>{offers.map(o=><option key={o.key} value={o.key}>{o.book} · {o.line}</option>)}</select></label></div>}<div className="prop-tile-number"><strong>{offer.line}</strong><span>{offer.category}</span></div><span className="prop-book">{expired?'Expired · '+new Date(observation!.observedAt).toLocaleString():offer.book}</span><div className="prop-sides">{(['under','over'] as const).map(s=><button key={s} disabled={!offer[s]} aria-pressed={open&&selectedSide===s} onClick={()=>{setSide(s);if(!open)onOpen()}}>{s==='under'?'↓ Under':'↑ Over'}<small>{offer[s]&&now-Date.parse(offer[s]!.observedAt)>900000?'Past line':money(offer[s]?.odds)}</small></button>)}</div></>:<small className="prop-book">No published line · historical research</small>}
 <button type="button" className="prop-detail-link" onClick={onOpen} aria-expanded={open}>{open?'Close research ↑':'View research →'}</button>
 {open&&<PropBoardDetail key={group.key+'|'+(offer?.key??'history')+'|'+selectedSide} sport={sport} game={offer?.game??group.game} offer={offer} side={selectedSide} player={p}/>}
 </article>
}
