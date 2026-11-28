import test from 'node:test'
import assert from 'node:assert/strict'
import { applyCurrentNBARosters, buildNBAPicks, buildNFLPicks } from '../src/cheatSheetData.ts'
import { enrichElitePicks } from '../src/analytics/eliteResearch.ts'

const DAY=86_400_000
function fixture(sport) {
  const time=new Date(Date.now()+DAY).toISOString()
  const teams=sport==='NFL' ? [
    {id:'16',abbreviation:'MIN',name:'Minnesota Vikings'},
    {id:'9',abbreviation:'GB',name:'Green Bay Packers'},
  ] : [
    {id:'2',abbreviation:'BOS',name:'Boston Celtics'},
    {id:'13',abbreviation:'LAL',name:'Los Angeles Lakers'},
  ]
  return {date:time.slice(0,10).replaceAll('-',''),label:'Tomorrow',
    isToday:false,source:'verified fixture',games:[{id:'upcoming',date:time,teams}]}
}
const historic=(i)=>new Date(Date.now()-(i+1)*DAY).toISOString()

test('Kirk Cousins remains in 10 game Raiders historical sample but is assigned to verified Vikings roster',()=>{
  const rows=Array.from({length:10},(_,i)=>({
    gameId:'LV-'+i,date:historic(i),
    playerId:'14880',player:'Kirk Cousins',team:'LV',position:'QB',
    opponent:i%2?'KC':'DEN',
    stats:{'Passing Yards':251,'Passing Completions':24,'Passing Attempts':32,
      'Passing TDs':2,'Interceptions Thrown':0},
  }))
  const rosters={'14880':{team:'MIN',teamId:'16',name:'Kirk Cousins',position:'QB'}}
  const slate=fixture('NFL')
  const picks=buildNFLPicks(slate,rows,undefined,'all',rosters)
  assert.ok(picks.length,'trade-acquired quarterback should remain eligible')
  assert.ok(picks.every(p=>p.team==='MIN' && p.opponent==='GB' && p.matchup==='MIN vs GB'))
  assert.ok(picks.some(p=>p.category==='Passing Yards' && p.recentGames===10))
  const enriched=enrichElitePicks(picks,'NFL',slate,{},rows,[],200)
  assert.ok(enriched.some(p=>p.player==='Kirk Cousins' &&
    p.category==='Passing Yards' && p.researchGrade))
})
test('current roster is authoritative even if old box scores list an upcoming game team',()=>{
  const slate=fixture('NFL')
  const rows=Array.from({length:10},(_,i)=>({
    gameId:'game-'+i,date:historic(i),playerId:'old-viking',player:'Former Viking',
    team:'MIN',position:'WR',opponent:'GB',
    stats:{'Receiving Yards':82,'Receptions':6},
  }))
  assert.equal(buildNFLPicks(slate,rows,undefined,'all',{}).length,0,
    'absence from verified roster must not result in old-team picks')
  const moved={'old-viking':{team:'LV',teamId:'13',name:'Former Viking'}}
  assert.equal(buildNFLPicks(slate,rows,undefined,'all',moved).length,0,
    'player traded away may not appear in Minnesota matchup')
})
test('NBA current roster overrides last completed game team without changing source history',()=>{
  const original=[{id:'athlete',name:'Traded Player',team:'Los Angeles Lakers',
    teamId:'13',position:'G'}]
  const rosters={'athlete':{team:'BOS',teamId:'2',teamName:'Boston Celtics',position:'F'}}
  const corrected=applyCurrentNBARosters(original,rosters)
  assert.equal(corrected[0].team,'Boston Celtics')
  assert.equal(corrected[0].teamId,'2')
  assert.equal(corrected[0].position,'F')
  assert.equal(original[0].team,'Los Angeles Lakers')
  assert.deepEqual(applyCurrentNBARosters(original,{}),[])
  const history={athlete:Array.from({length:10},(_,i)=>({
    gameId:'old-team-'+i,date:historic(i),team:'Los Angeles Lakers',
    opponent:'Golden State Warriors',points:24,rebounds:8,assists:7,threes:2,
  }))}
  const picks=buildNBAPicks(fixture('NBA'),history,corrected,undefined,'all')
  assert.ok(picks.length)
  assert.ok(picks.every(p=>p.team==='BOS' && p.matchup==='BOS vs LAL'))
})
