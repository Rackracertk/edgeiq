import test from 'node:test'
import assert from 'node:assert/strict'
import {buildPropBoard} from '../src/analytics/propBoard.ts'
const now=Date.parse('2026-11-26T20:00:00Z'),time='2026-11-26T21:30:00Z'
test('expired lines are not current but can be explicitly requested for historical comparison',()=>{const game={id:'a',path:'football/nfl',state:'pre',date:time,participants:[{id:'1',name:'A'},{id:'2',name:'B'}]};const snap={schemaVersion:1,games:[{sport:'NFL',home:'A',away:'B',time,quotes:[{book:'Book',market:'player_pass_yds',category:'Passing Yards',participant:'Player A',side:'over',line:200.5,odds:-110,observedAt:'2026-11-26T19:00:00Z'}]}]};assert.equal(buildPropBoard(snap,[game],'NFL',now).length,0);assert.equal(buildPropBoard(snap,[game],'NFL',now,2880).length,1);assert.equal(buildPropBoard(snap,[{...game,state:'post'}],'NFL',now,2880).length,0)})
