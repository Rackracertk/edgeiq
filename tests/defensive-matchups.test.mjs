import test from 'node:test'
import assert from 'node:assert/strict'
import { asDefensePosition, buildDefenseRankings } from '../src/analytics/defensiveMatchups.ts'

function historyFixtures() {
  const histories = {}
  for (let game=0;game<5;game++) {
    const make=(team, athlete, position, points, minutes=31)=>{
      const id=team+'-'+athlete
      histories[id]??=[]
      histories[id].push({
        gameId:'match-'+game,date:'2026-11-'+String(game+1).padStart(2,'0'),
        team,position,minutes,points,rebounds:5,assists:3,threes:1,
      })
    }
    for (let i=0;i<7;i++)make('Boston Celtics','b'+i,['G','G','F','F','C','G','C'][i],12+i)
    for (let i=0;i<7;i++)make('Los Angeles Lakers','a'+i,['G','SG','F','PF','C','G','C'][i],24+i)
  }
  return histories
}

test('ESPN general NBA position labels group into honest G/F/C buckets',()=>{
  assert.equal(asDefensePosition('G'),'G')
  assert.equal(asDefensePosition('SG'),'G')
  assert.equal(asDefensePosition('PG'),'G')
  assert.equal(asDefensePosition('F'),'F')
  assert.equal(asDefensePosition('SF'),'F')
  assert.equal(asDefensePosition('PF'),'F')
  assert.equal(asDefensePosition('C'),'C')
  assert.equal(asDefensePosition('UNKNOWN'),null)
})
test('all G/F/C positions have real samples and observed same-line hit rates',()=>{
  const data=buildDefenseRankings(historyFixtures(),'Points',19.5,'over')
  for (const position of ['G','F','C']) {
    const defense=data.byPosition[position].find(row=>row.team==='Boston Celtics')
    assert.ok(defense,'missing '+position)
    assert.equal(defense.games,5)
    assert.equal(defense.hitRate,100)
    assert.ok(defense.appearances>=8)
    assert.ok(defense.allowedPerAppearance>=24)
  }
  assert.ok(data.overall.some(row=>row.team==='Boston Celtics'))
})
test('insufficient position sample is not reported as a ranking',()=>{
  const fixture=historyFixtures()
  for(const games of Object.values(fixture)) for(const game of games) if(game.position==='C')game.minutes=4
  const data=buildDefenseRankings(fixture,'Points',19.5,'over')
  assert.equal(data.byPosition.C.length,0)
  assert.ok(data.byPosition.G.length>0)
})
