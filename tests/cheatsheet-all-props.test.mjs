import test from 'node:test'
import assert from 'node:assert/strict'
import { buildNBAPicks, buildNFLPicks } from '../src/cheatSheetData.ts'
import { enrichElitePicks } from '../src/analytics/eliteResearch.ts'

const DAY=86_400_000
const now=Date.now()
const date=(day)=>new Date(now-day*DAY).toISOString()
const upcoming=new Date(now+DAY).toISOString()
function slate(sport) {
  const home=sport==='NBA'?{id:'1',abbreviation:'LAL',name:'Los Angeles Lakers'}:
    {id:'1',abbreviation:'GB',name:'Green Bay Packers'}
  const away=sport==='NBA'?{id:'2',abbreviation:'BOS',name:'Boston Celtics'}:
    {id:'2',abbreviation:'MIN',name:'Minnesota Vikings'}
  return {date:upcoming.slice(0,10).replaceAll('-',''),label:'Test next game',isToday:false,
    source:'verified fixture',games:[{id:'next-game',date:upcoming,teams:[home,away]}]}
}
const nbaPlayers=[
  {id:'star',name:'All Around',team:'Los Angeles Lakers',teamId:'1',position:'G'},
  {id:'big',name:'Big Man',team:'Los Angeles Lakers',teamId:'1',position:'C'},
  {id:'triple',name:'Triple Threat',team:'Los Angeles Lakers',teamId:'1',position:'F'},
]
const nbaHistory=Object.fromEntries(nbaPlayers.map((player,idx)=>[player.id,
  Array.from({length:10},(_,i)=>({
    gameId:'g'+i, date:date(i+1),team:'Los Angeles Lakers',opponent:'Chicago Bulls',position:player.position,
    minutes:34,
    points:[25,15,22][idx],rebounds:[7,10,11][idx],
    assists:[6,3,12][idx],threes:[2,1,3][idx],steals:1,blocks:1,
  }))
]))

function nflRows(){
  const athletes=[
    {playerId:'qb',player:'QB Example',position:'QB',stats:{
      'Passing Yards':260,'Passing TDs':2,'Interceptions Thrown':0}},
    {playerId:'rb',player:'RB Example',position:'RB',stats:{
      'Rushing Yards':70,'Rushing Attempts':15}},
    {playerId:'wr',player:'WR Example',position:'WR',stats:{
      'Receiving Yards':70,'Receptions':6,'Receiving TDs':1}},
    {playerId:'dt',player:'DL Example',position:'DT',stats:{'Sacks':1}},
  ]
  return Array.from({length:10},(_,i)=>athletes.map(player=>({
    ...player,gameId:'nfl'+i,date:date(i+1),team:'GB',opponent:'CHI',
  }))).flat()
}
test('All Props includes each NBA core and combo category, with both over and under sides',()=>{
  const results=buildNBAPicks(slate('NBA'),nbaHistory,nbaPlayers,undefined,'all')
  const categories=['Points','Rebounds','Assists','PRA',
    'Points + Assists (PA)','Points + Rebounds (PR)','Assists + Rebounds (AR)','3-Pointers Made',
    'Steals','Blocks','Steals + Blocks (SB)','Double-Double','Triple-Double']
  for(const category of categories) {
    const picks=results.filter(x=>x.category===category)
    assert.ok(picks.length,category+' disappeared')
  }
  for(const category of ['Points','Rebounds','Assists','PRA','Points + Assists (PA)',
    'Points + Rebounds (PR)','Assists + Rebounds (AR)']) {
    const sides=new Set(results.filter(x=>x.category===category).map(x=>x.direction))
    assert.ok(sides.has('over') && sides.has('under'),category+' omitted a valid side')
  }
  assert.ok(results.every(x=>x.recentHits/x.recentGames>=.6))
})
test('Elite mode retains only the strict historical 90%+ cutoff',()=>{
  const picks=buildNBAPicks(slate('NBA'),nbaHistory,nbaPlayers)
  assert.ok(picks.length)
  assert.ok(picks.every(x=>x.recentHits/x.recentGames>=.9 && x.l5Hits>=4))
})
test('NFL research covers passing, rushing, receiving and sacks, with both directions when observed',()=>{
  const rows=nflRows()
  const results=buildNFLPicks(slate('NFL'),rows,undefined,'all')
  for(const cat of ['Passing Yards','Passing TDs','Interceptions Thrown','Rushing Yards',
    'Rushing Attempts','Receiving Yards','Receptions','Receiving TDs','Sacks'])
    assert.ok(results.some(x=>x.category===cat),'Missing NFL category '+cat)
  for(const cat of ['Passing Yards','Rushing Yards','Receiving Yards','Receptions']) {
    const sides=new Set(results.filter(x=>x.category===cat).map(x=>x.direction))
    assert.ok(sides.has('over')&&sides.has('under'),'NFL direction missing for '+cat)
  }
  assert.ok(results.every(x=>x.recentHits/x.recentGames>=.6))
})
test('Diversified evidence selection reserves the core categories instead of stacking stocks',()=>{
  const picks=buildNBAPicks(slate('NBA'),nbaHistory,nbaPlayers,undefined,'all')
  const enriched=enrichElitePicks(picks,'NBA',slate('NBA'),nbaHistory,[],nbaPlayers,200)
  const top=enriched.slice(0,12).map(x=>x.category)
  assert.ok(top.includes('Points'))
  assert.ok(top.includes('Rebounds'))
  assert.ok(top.includes('Assists'))
  assert.ok(top.includes('PRA'))
})
