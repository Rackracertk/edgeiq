import type {Fixture} from './scriptSports'
import type {SlipQuote} from './slipResearch'
type Snapshot={schemaVersion:number;games:{sport:string;home:string;away:string;time:string;quotes:SlipQuote[]}[]}
const clean=(s:string)=>s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g,'')
export function selectMajorOdds(snapshot:Snapshot,game:Fixture,sport:string,now:number,maxAgeMinutes=15):SlipQuote[]{
 if(snapshot?.schemaVersion!==1||!Array.isArray(snapshot.games)||game.state!=='pre'||Date.parse(game.date)<=now)return []
 const names=game.participants.map(p=>clean(p.name)).sort().join('|')
 const match=snapshot.games.find(g=>g.sport===sport&&Math.abs(Date.parse(g.time)-Date.parse(game.date))<=30*60000&&[clean(g.home),clean(g.away)].sort().join('|')===names)
 return Array.isArray(match?.quotes)?match.quotes.filter(q=>Number.isFinite(Date.parse(q.observedAt))&&Date.parse(q.observedAt)>=now-maxAgeMinutes*60000&&Date.parse(q.observedAt)<=now+60000):[]
}
