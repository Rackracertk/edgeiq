import test from 'node:test'
import assert from 'node:assert/strict'
import {eligibleHistory,parseBox,groupObservations,historicalScoreBaseline} from '../src/analytics/publicGameEvidence.ts'
const game=(id,date,state='post')=>({id,date,state,participants:[{id:'a',score:2},{id:'b',score:1}]})
test('public evidence excludes future, live and selected games',()=>{
 const target=game('target','2026-11-26T12:00:00Z','pre')
 const before=game('before','2026-11-25T12:00:00Z')
 assert.deepEqual(eligibleHistory([target,before,before,game('live','2026-11-24T12:00:00Z','in'),game('future','2026-11-27T12:00:00Z')],target,Date.parse(target.date)),[before])
})
test('box score parsing preserves real zeros but excludes missing, composite and DNP cells',()=>{
 const g=game('one','2026-11-25T12:00:00Z')
 const payload={boxscore:{players:[{team:{id:'a'},statistics:[{name:'pitching',labels:['K','BB','IP','H'],athletes:[{athlete:{id:'1',displayName:'Player'},stats:['0','2','-','1/2']},{didNotPlay:true,athlete:{id:'2',displayName:'Inactive'},stats:['0','0','0','0']}]}]}]}}
 const rows=parseBox(payload,g,new Set(['a']))
 assert.deepEqual(rows.map(r=>[r.category,r.value]),[['pitching · K',0],['pitching · BB',2]])
 assert.equal(groupObservations([...rows,...rows])[0].values.length,1)
})

test('scoring baseline requires five finals per participant and excludes individual sports',()=>{
 const target={...game('target','2026-11-26T12:00:00Z','pre'),path:'hockey/nhl'}
 const history=Array.from({length:5},(_,i)=>game('g'+i,'2026-11-'+(20+i)+'T12:00:00Z'))
 assert.deepEqual(historicalScoreBaseline(history,target),[2,1])
 assert.equal(historicalScoreBaseline(history.slice(0,4),target),null)
 assert.equal(historicalScoreBaseline(history,{...target,path:'tennis/atp'}),null)
})
