import test from 'node:test'
import assert from 'node:assert/strict'
import { rankNFLDefensiveYards } from '../src/analytics/nflDefensiveYards.ts'
import { parseNFLBoxscore } from '../src/analytics/nflBoxscore.ts'

function game(id, aPass, bPass, aRush, bRush) {
  const make=(team,player,stats)=>({
    gameId:id,date:'2026-11-01T17:00:00Z',playerId:player,player,team,stats,
  })
  return [
    make('GB',id+'-GB-QB',{'Passing Yards':aPass,'Rushing Yards':10}),
    make('CHI',id+'-CHI-QB',{'Passing Yards':bPass,'Rushing Yards':5}),
    make('GB',id+'-GB-RB',{'Rushing Yards':aRush-10}),
    make('CHI',id+'-CHI-RB',{'Rushing Yards':bRush-5}),
  ]
}
test('independent passing and rushing leaderboard rank opposite when team strengths differ',()=>{
  const rows=[
    ...game('1',300,170,75,190),
    ...game('2',280,190,95,165),
    ...game('3',290,180,85,175),
  ]
  const passing=rankNFLDefensiveYards(rows,'Passing Yards')
  const rushing=rankNFLDefensiveYards(rows,'Rushing Yards')
  assert.equal(passing[0].team,'GB')
  assert.equal(passing[0].yardsAllowed,180)
  assert.equal(rushing[0].team,'CHI')
  assert.equal(rushing[0].yardsAllowed,85)
  assert.equal(passing[0].games,3)
  assert.equal(rushing[0].games,3)
})
test('duplicates and one-sided game boxscores do not inflate defensive rankings',()=>{
  const rows=[
    ...game('1',300,170,75,190),
    ...game('2',280,190,95,165),
    ...game('3',290,180,85,175),
  ]
  rows.push({...rows[0]})
  rows.push({gameId:'incomplete',date:'2026-11-01T17:00:00Z',playerId:'single',player:'single',team:'GB',stats:{'Rushing Yards':500}})
  const rushing=rankNFLDefensiveYards(rows,'Rushing Yards')
  assert.equal(rushing.length,2)
  assert.equal(rushing.find(x=>x.team==='CHI')?.yardsAllowed,85)
})
test('negative rushing yards are preserved from ESPN player boxscores',()=>{
  const summary={boxscore:{players:[{
    team:{abbreviation:'GB'},statistics:[{name:'rushing',labels:['CAR','YDS','AVG'],athletes:[
      {athlete:{id:'123',displayName:'Runner'},stats:['2','-3','-1.5']},
    ]}]
  }]}}
  const result=parseNFLBoxscore(summary,{id:'test',date:'2026-11-01T17:00:00Z'})
  assert.equal(result[0]?.stats['Rushing Yards'],-3)
})
