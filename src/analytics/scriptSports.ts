export const leagues = {
 NBA:[['NBA','basketball/nba']], NFL:[['NFL','football/nfl']], MLB:[['MLB','baseball/mlb']], NHL:[['NHL','hockey/nhl']],
 NCAAF:[['NCAAF','football/college-football']], NCAAB:[['NCAAB','basketball/mens-college-basketball']],
 WNBA:[['WNBA','basketball/wnba']], SOCCER:[['Premier League','soccer/eng.1'],['La Liga','soccer/esp.1'],['Bundesliga','soccer/ger.1'],['Serie A','soccer/ita.1'],['Ligue 1','soccer/fra.1'],['MLS','soccer/usa.1'],['Champions League','soccer/uefa.champions']],
 TENNIS:[['ATP','tennis/atp'],['WTA','tennis/wta']], MMA:[['UFC','mma/ufc']]
} as const
export type ScriptSport=keyof typeof leagues
export const sportLabel=(s:ScriptSport)=>s==='MMA'?'UFC / MMA':s==='SOCCER'?'Soccer':s==='TENNIS'?'Tennis':s
export type Participant={id:string;name:string;short:string;aliases:string[];logo:string;score:number|null;homeAway:string}
export type Fixture={id:string;eventId:string;league:string;path:string;date:string;state:string;status:string;period:number|null;clock:string;participants:Participant[];venue:string;neutral:boolean;segments:{label:string;values:(number|null)[]}[]}
export function clean(v:unknown){return String(v??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function num(v:unknown):number|null{return (typeof v==='string'&&v.trim()!==''||typeof v==='number')&&Number.isFinite(Number(v))?Number(v):null}
function trustedImage(v:unknown){return typeof v==='string'&&/^https:\/\/(a\.espncdn\.com|a1\.espncdn\.com|a2\.espncdn\.com|a3\.espncdn\.com)\//.test(v)?v:''}
export function matches(p:Participant,q:string){const n=clean(q);return !n||[p.name,p.short,...p.aliases].some(a=>clean(a).includes(n))}
export function normalizeEvents(payload:any,league:string,path:string):Fixture[]{
 const result=new Map<string,Fixture>()
 const events=Array.isArray(payload?.events)?payload.events: Array.isArray(payload?.sports)?payload.sports.flatMap((s:any)=>(s.leagues??[]).flatMap((l:any)=>l.events??[])):[]
 for(const event of events){
  const competitions=Array.isArray(event.competitions)?event.competitions:[]
  for(const comp of competitions){
   const rows=Array.isArray(comp.competitors)?comp.competitors:[]
   if(rows.length!==2)continue // doubles and multi-entrant events require a different model
   const id=String(comp.id??event.id??'');const date=String(comp.date??event.date??'')
   if(!id||!Number.isFinite(Date.parse(date)))continue
   const participants:Participant[]=rows.map((r:any)=>{
    const t=r.team??r.athlete??{};const name=String(t.displayName??t.fullName??t.name??'')
    return {id:String(t.id??r.id??''),name,short:String(t.abbreviation??t.shortDisplayName??t.shortName??''),aliases:[t.location,t.name,t.nickname,t.shortDisplayName,t.shortName,t.abbreviation].filter((x:unknown)=>typeof x==='string'),logo:trustedImage(t.logo??t.logos?.[0]?.href??t.headshot?.href),score:num(r.score?.value??r.score?.displayValue??r.score),homeAway:String(r.homeAway??'')}
   })
   if(participants.some(p=>!p.id||!p.name)||participants[0].id===participants[1].id)continue
   const status=comp.status??event.status??{};const state=String(status.type?.state??'unknown')
   if(state==='pre')participants.forEach(p=>p.score=null)
   const count=Math.max(...rows.map((r:any)=>Array.isArray(r.linescores)?r.linescores.length:0))
   const segments=Array.from({length:Math.min(count,30)},(_,i)=>({label:String(i+1),values:rows.map((r:any)=>num(r.linescores?.[i]?.value??r.linescores?.[i]?.displayValue))}))
   result.set(path+':'+id,{id,eventId:String(event.id??id),league,path,date,state,status:String(status.type?.shortDetail??status.type?.description??'Status unavailable'),period:num(status.period),clock:String(status.displayClock??''),participants,venue:String(comp.venue?.fullName??''),neutral:comp.neutralSite===true,segments})
  }
 }
 return [...result.values()]
}
export function marketGroup(key:string){if(key==='h2h'||key==='moneyline'||key==='h2h_3_way')return 'Moneyline';if(key==='spreads'||key==='spread')return 'Spread';if(key==='totals'||key==='total')return 'Game Totals';if(/alternate/.test(key))return 'Alternate Lines';if(/_h1|first_half/.test(key))return 'First Half';if(/_h2|second_half/.test(key))return 'Second Half';if(/_q[1-4]|_p[1-3]|innings|_1st_[1357]/.test(key))return 'Periods / Innings';if(/^(team_)/.test(key))return 'Team Props';if(/^(player_|batter_|pitcher_|goalie_|fighter_)/.test(key))return 'Player Props';if(/scorer|touchdown|first_basket/.test(key))return 'Scoring Props';if(/futures|outright/.test(key))return 'Futures';return 'More'}
export const phaseLabels:Record<ScriptSport,string[]>={NBA:['Q1','Q2','Q3','Q4'],WNBA:['Q1','Q2','Q3','Q4'],NCAAB:['First half','Second half'],NFL:['Q1','Q2','Q3','Q4'],NCAAF:['Q1','Q2','Q3','Q4'],MLB:['Starting pitchers / innings 1–3','Middle innings 4–6','Bullpen / innings 7–9'],NHL:['Period 1','Period 2','Period 3'],SOCCER:['First half','Second half'],TENNIS:['Opening set','Middle sets','Deciding set if needed'],MMA:['Round 1','Middle rounds','Final scheduled round if needed']}
export const catalog:Record<ScriptSport,string[]> = (() => {
 const basketball='Points|Rebounds|Assists|PRA|PR|PA|RA|Three-pointers made|Three-pointers attempted|Steals|Blocks|Steals + blocks|Turnovers|Double-doubles|Triple-doubles|Field goals made|Field goals attempted|Free throws made|Free throws attempted|Offensive rebounds|Defensive rebounds|Fantasy score|First basket|First team basket|First-quarter points|First-half points|Scoring milestones'.split('|')
 const football='Passing yards|Passing touchdowns|Passing attempts|Passing completions|Interceptions thrown|Longest completion|Rushing yards|Rushing attempts|Rushing touchdowns|Longest rush|Receiving yards|Receptions|Receiving targets|Receiving touchdowns|Longest reception|Anytime touchdowns|First touchdown|Last touchdown|2+ touchdowns|3+ touchdowns|Rushing + receiving yards|Passing + rushing yards|Rushing + receiving touchdowns|Tackles|Solo tackles|Assisted tackles|Tackles + assists|Sacks|Defensive interceptions|Forced fumbles|Field goals|Extra points|Kicking points|Longest field goal|Fantasy score'.split('|')
 return {NBA:basketball,WNBA:basketball,NCAAB:basketball,NFL:football,NCAAF:football,MLB:'Hits|Total bases|Home runs|RBIs|Runs scored|Hits + runs + RBIs|Singles|Doubles|Triples|Extra-base hits|Stolen bases|Batter walks|Batter strikeouts|Pitcher strikeouts|Pitcher outs recorded|Hits allowed|Walks allowed|Earned runs allowed|Pitcher wins|Batter fantasy score|Pitcher fantasy score|NRFI|YRFI|First five innings|Run lines'.split('|'),NHL:'Shots on goal|Goals|Anytime goal|First goal|Last goal|Assists|Player points|Blocked shots|Hits|Power-play points|Goalie saves|Goals allowed|Multiple goals|Hat tricks|Fantasy score|Puck lines|Period markets'.split('|'),SOCCER:'Anytime goal|First goal|Last goal|Shots|Shots on target|Assists|Goals + assists|Goalkeeper saves|Clean sheets|Corners|Team corners|Yellow cards|Red cards|Fouls committed|Fouls drawn|Tackles|Passes attempted|Passes completed|Offsides|Both teams to score|Double chance|Draw no bet|Three-way moneyline|Asian handicap|Correct score|First-half winner|Halftime/full-time|Fantasy score'.split('|'),TENNIS:'Match winner|Total games|Total sets|Game handicap|Set handicap|Aces|Double faults|Break points won|First-set winner|Correct set score|Games won|Tie-breaks|Fantasy score'.split('|'),MMA:'Fight winner|Method of victory|Knockout|Technical knockout|Submission|Decision|Total rounds|Round winner|Finish round|Goes the distance|Significant strikes|Takedowns'.split('|')}
})()
