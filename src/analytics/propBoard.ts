import type {Fixture} from './scriptSports'
import type {SlipQuote} from './slipResearch'
import {selectMajorOdds} from './majorOdds.ts'
type Snapshot=Parameters<typeof selectMajorOdds>[0]
export type BoardOffer={key:string;game:Fixture;player:string;category:string;market:string;line:number;book:string;over:SlipQuote|null;under:SlipQuote|null}
export type RosterPlayer={id:string;name:string;teamId:string;team:string;position:string}
export const normalizedName=(s:string)=>s.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g,'')
export function buildPropBoard(snapshot:Snapshot|null,games:Fixture[],sport:string,now:number):BoardOffer[]{
 if(!snapshot)return []
 const map=new Map<string,BoardOffer>()
 for(const game of games)for(const q of selectMajorOdds(snapshot,game,sport,now)){
  if(!/^(player_|batter_|pitcher_|goalie_|fighter_)/.test(q.market)||!['over','under'].includes(q.side)||!q.participant||!q.book||typeof q.line!=='number'||!Number.isFinite(q.line)||!Number.isInteger(q.odds)||Math.abs(q.odds??0)<100)continue
  const key=JSON.stringify([game.path,game.id,normalizedName(q.participant),q.market,q.line,q.book])
  const row=map.get(key)??{key,game,player:q.participant,category:q.category,market:q.market,line:q.line,book:q.book,over:null,under:null}
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
