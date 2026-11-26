import {canonicalProp} from './propCatalog.ts'
import type {Fixture} from './scriptSports'
import type {SlipQuote} from './slipResearch'
import {selectMajorOdds} from './majorOdds.ts'
type Snapshot=Parameters<typeof selectMajorOdds>[0]
export type BoardOffer={key:string;game:Fixture;player:string;category:string;market:string;line:number;book:string;over:SlipQuote|null;under:SlipQuote|null}
export type RosterPlayer={id:string;name:string;teamId:string;team:string;position:string}
export const normalizedName=(s:string)=>s.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g,'')
export function buildPropBoard(snapshot:Snapshot|null,games:Fixture[],sport:string,now:number,maxAgeMinutes=15):BoardOffer[]{
 if(!snapshot)return []
 const map=new Map<string,BoardOffer>()
 for(const game of games)for(const q of selectMajorOdds(snapshot,game,sport,now,maxAgeMinutes)){
  if(!/^(player_|batter_|pitcher_|goalie_|fighter_)/.test(q.market)||!['over','under'].includes(q.side)||!q.participant||!q.book||typeof q.line!=='number'||!Number.isFinite(q.line)||!Number.isInteger(q.odds)||Math.abs(q.odds??0)<100)continue
  const key=JSON.stringify([game.path,game.id,normalizedName(q.participant),q.market,q.line,q.book])
  const row=map.get(key)??{key,game,player:q.participant,category:canonicalProp(sport,q.market,q.category),market:q.market,line:q.line,book:q.book,over:null,under:null}
  const side=q.side as 'over'|'under'
  if(!row[side]||Date.parse(q.observedAt)>Date.parse(row[side]!.observedAt))row[side]=q
  map.set(key,row)
 }
 return [...map.values()].sort((a,b)=>a.game.date.localeCompare(b.game.date)||a.player.localeCompare(b.player)||a.category.localeCompare(b.category)||a.book.localeCompare(b.book))
}
export function rosterForGames(roster:RosterPlayer[],games:Fixture[]){
 const ids=new Set(games.flatMap(g=>g.participants.map(p=>p.id)))
 return roster.filter(p=>ids.has(p.teamId)).sort((a,b)=>a.name.localeCompare(b.name))
}
export function matchRoster(name:string,game:Fixture,roster:RosterPlayer[]){
 const matches=rosterForGames(roster,[game]).filter(p=>normalizedName(p.name)===normalizedName(name))
 return matches.length===1?matches[0]:undefined
}
export const nbaCategory:Record<string,string>={player_points:'Points',player_rebounds:'Rebounds',player_assists:'Assists',player_threes:'3-Pointers Made',player_points_rebounds_assists:'PRA',player_points_assists:'Points + Assists (PA)',player_points_rebounds:'Points + Rebounds (PR)',player_rebounds_assists:'Assists + Rebounds (AR)',player_steals:'Steals',player_blocks:'Blocks'}
export const nflCategory:Record<string,string>={player_pass_yds:'Passing Yards',player_rush_yds:'Rushing Yards',player_reception_yds:'Receiving Yards',player_receptions:'Receptions',player_pass_tds:'Passing TDs',player_pass_completions:'Passing Completions',player_rush_attempts:'Rushing Attempts',player_sacks:'Sacks'}

export type PlayerBoardGroup={key:string;name:string;player?:RosterPlayer;game:Fixture;offers:BoardOffer[]}
export function groupPlayerBoard(offers:BoardOffer[],roster:RosterPlayer[],games:Fixture[]):PlayerBoardGroup[]{
 const groups=new Map<string,PlayerBoardGroup>()
 for(const offer of offers){
  const player=matchRoster(offer.player,offer.game,roster)
  // Known roster identity is stable even if the slate has multiple events.
  // Unknown names are kept event-scoped to avoid merging unrelated athletes.
  const key=player?'player:'+player.id:'event:'+offer.game.path+':'+offer.game.id+':'+normalizedName(offer.player)
  const group=groups.get(key)??{key,name:player?.name??offer.player,player,game:offer.game,offers:[]}
  group.offers.push(offer);groups.set(key,group)
 }
 for(const player of rosterForGames(roster,games)){
  const key='player:'+player.id
  if(groups.has(key))continue
  const game=games.find(g=>g.participants.some(t=>t.id===player.teamId))
  if(game)groups.set(key,{key,name:player.name,player,game,offers:[]})
 }
 return [...groups.values()].sort((a,b)=>Number(b.offers.length>0)-Number(a.offers.length>0)||a.game.date.localeCompare(b.game.date)||a.name.localeCompare(b.name))
}
