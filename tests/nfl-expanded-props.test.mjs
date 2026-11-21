import test from 'node:test'
import assert from 'node:assert/strict'
import { parseNFLBoxscore } from '../src/analytics/nflBoxscore.ts'

test('NFL props are parsed only from ESPN boxscore groups with matching labels',()=>{
  const athlete=(id,position,stats)=>({
    athlete:{id,displayName:'Athlete '+id,position:{abbreviation:position}},stats,
  })
  const data={boxscore:{players:[{team:{abbreviation:'GB'},statistics:[
    {name:'passing',labels:['C/ATT','YDS','AVG','TD','INT'],
      athletes:[athlete('qb','QB',['23/33','178','5.4','1','3'])]},
    {name:'rushing',labels:['CAR','YDS','AVG','TD','LONG'],
      athletes:[athlete('rb','RB',['18','51','2.8','1','12'])]},
    {name:'receiving',labels:['REC','YDS','AVG','TD','LONG','TGTS'],
      athletes:[athlete('wr','WR',['4','51','12.8','0','19','5'])]},
    {name:'defensive',labels:['TOT','SOLO','SACKS','TFL','PD','QB HTS','TD'],
      athletes:[athlete('dt','DT',['8','7','0','0','0','0','0'])]},
  ]}]}}
  const rows=parseNFLBoxscore(data,{id:'game',date:'2026-11-01T18:00Z',teams:[{abbreviation:'GB'},{abbreviation:'MIN'}]})
  assert.equal(rows.find(x=>x.playerId==='qb')?.stats['Passing Completions'],23)
  assert.equal(rows.find(x=>x.playerId==='qb')?.stats['Passing Attempts'],33)
  assert.equal(rows.find(x=>x.playerId==='rb')?.stats['Rushing TDs'],1)
  assert.equal(rows.find(x=>x.playerId==='rb')?.stats['Longest Rush'],12)
  assert.equal(rows.find(x=>x.playerId==='wr')?.stats['Receiving Targets'],5)
  assert.equal(rows.find(x=>x.playerId==='wr')?.stats['Longest Reception'],19)
  assert.equal(rows.find(x=>x.playerId==='dt')?.stats['Tackles'],8)
  assert.equal(rows.find(x=>x.playerId==='dt')?.stats['Solo Tackles'],7)
  assert.equal(rows.find(x=>x.playerId==='qb')?.stats['Tackles'],undefined)
})
test('a missing or malformed passing C/ATT cannot create made-up completions',()=>{
  const data={boxscore:{players:[{
    team:{abbreviation:'GB'},statistics:[{name:'passing',labels:['C/ATT','YDS'],athletes:[
      {athlete:{id:'bad',displayName:'Bad Format'},stats:['--','230']},
      {athlete:{id:'negative',displayName:'Impossible Values'},stats:['27/19','200']},
    ]}]
  }]}}
  const parsed=parseNFLBoxscore(data,{id:'game',date:'2026-11-01T18:00Z'})
  for(const row of parsed) {
    assert.equal(row.stats['Passing Completions'],undefined)
    assert.equal(row.stats['Passing Attempts'],undefined)
  }
})
