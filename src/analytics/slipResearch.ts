// Same-game research combinations. No joint probability, payout estimate, or automatic wagering.
export type SlipQuote={book:string;market:string;category:string;participantId:string;participant:string;side:string;line:number|null;odds:number|null;observedAt:string}
export type SlipEvidence={quote:SlipQuote;games:number;hits:number;pushes:number;score:number;injury?:string}
export type SlipLeg={quote:SlipQuote;evidence:SlipEvidence|null}
export type ResearchSlip={label:string;legs:SlipLeg[]}
const norm=(s:string)=>s.toLowerCase().trim().replace(/\s+/g,' ')
const key=(q:SlipQuote)=>[norm(q.book),norm(q.market),norm(q.participantId||q.participant),norm(q.side),q.line].join('|')
const fresh=(q:SlipQuote,now:number)=>Number.isFinite(Date.parse(q.observedAt))&&Date.parse(q.observedAt)>=now-15*60000&&Date.parse(q.observedAt)<=now+60000
const playerMarket=(q:SlipQuote)=>/^(player_|batter_|pitcher_|goalie_|fighter_)/.test(q.market)&&!/(alternate|first|last|_h[12]|_q[1-4]|_p[1-3])/.test(q.market)
const valid=(q:SlipQuote,now:number)=>!!q.book.trim()&&!!q.participant.trim()&&!!q.category.trim()&&playerMarket(q)&&['over','under'].includes(norm(q.side))&&q.line!==null&&Number.isFinite(q.line)&&q.odds!==null&&Number.isFinite(q.odds)&&Math.abs(q.odds)>=100&&fresh(q,now)
export function researchCandidates(quotes:SlipQuote[],evidence:SlipEvidence[],now:number){
 const ev=new Map(evidence.filter(e=>e.games>=5&&e.hits>=0&&e.hits<=e.games&&e.pushes>=0&&e.hits+e.pushes<=e.games&&Number.isFinite(e.score)).map(e=>[key(e.quote),e]))
 const result=new Map<string,SlipLeg>()
 for(const q of quotes){if(!valid(q,now))continue;const e=ev.get(key(q));if(e?.injury&&/\b(out|inactive|suspended|doubtful|questionable|day.to.day|injured reserve)\b/i.test(e.injury))continue;const prior=result.get(key(q));if(!prior||Date.parse(q.observedAt)>Date.parse(prior.quote.observedAt))result.set(key(q),{quote:q,evidence:e??null})}
 return [...result.values()].sort((a,b)=>(b.evidence?.games??0)-(a.evidence?.games??0)||(b.evidence?.score??0)-(a.evidence?.score??0)||a.quote.participant.localeCompare(b.quote.participant)||a.quote.category.localeCompare(b.quote.category)||a.quote.side.localeCompare(b.quote.side))
}
export function buildResearchSlips(candidates:SlipLeg[],book:string):ResearchSlip[]{
 const available=candidates.filter(l=>l.quote.book===book)
 // Prefer documented evidence, but don't mistake it for win probability.
 // Use different players in each combination; distinct players can still be correlated.
 function select(n:number,offset:number,avoid:Set<string>){
  const ordered=[...available.slice(offset),...available.slice(0,offset)]
  const result:SlipLeg[]=[];const names=new Set<string>();const ids=new Set<string>()
  for(const l of ordered){const q=l.quote;const name=norm(q.participant);const id=norm(q.participantId);if(names.has(name)||(id&&ids.has(id))||avoid.has(key(q)))continue;result.push(l);names.add(name);if(id)ids.add(id);if(result.length===n)break}
  return result.length===n?result:[]
 }
 const first=select(2,0,new Set());if(!first.length)return []
 const second=select(3,0,new Set(first.map(l=>key(l.quote))))
 // When the market pool is small, use a different two-leg combination if possible.
 const fallback=second.length?second:select(2,1,new Set(first.map(l=>key(l.quote))))
 const alt=fallback.length?fallback:select(3,0,new Set())
 const signature=(legs:SlipLeg[])=>legs.map(l=>key(l.quote)).sort().join(';')
 const slips=[{label:'Two-leg combination',legs:first}]
 if(alt.length&&signature(alt)!==signature(first))slips.push({label:alt.length===3?'Three-leg combination':'Alternative two-leg combination',legs:alt})
 return slips
}
