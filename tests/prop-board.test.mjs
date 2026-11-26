import test from 'node:test'
import assert from 'node:assert/strict'
import {buildPropBoard,rosterForGames,matchRoster} from '../src/analytics/propBoard.ts'
const now=Date.parse('2026-11-26T18:00:00Z'),time='2026-11-26T21:30:00Z'
const game={id:'a',path:'football/nfl',state:'pre',date:time,participants:[{id:'1',name:'Team A'},{id:'2',name:'Team B'}]}
const quote=(side,extra={})=>({book:'Example',market:'player_pass_yds',category:'Passing Yards',participant:'Player A',side,line:200.5,odds:-110,observedAt:new Date(now).toISOString(),...extra})
test('prop board groups actual two-sided lines, retains separate books and excludes game markets and stale prices',()=>{const snap={schemaVersion:1,games:[{sport:'NFL',home:'Team A',away:'Team B',time,quotes:[quote('over'),quote('under'),quote('over',{book:'Other'}),quote('over',{market:'totals'}),quote('over',{observedAt:new Date(now-16*60000).toISOString()})]}]};const rows=buildPropBoard(snap,[game],'NFL',now);assert.equal(rows.length,2);assert.ok(rows.find(r=>r.book==='Example').under);assert.equal(rows.find(r=>r.book==='Other').under,null);assert.equal(buildPropBoard(snap,[{...game,state:'in'}],'NFL',now).length,0)})
test('roster is limited to selected matchup and names are uniquely matched',()=>{const roster=[{id:'p',name:'Player A',teamId:'1'},{id:'q',name:'Player B',teamId:'3'}];assert.equal(rosterForGames(roster,[game]).length,1);assert.equal(matchRoster('Player A',game,roster).id,'p');assert.equal(matchRoster('Player B',game,roster),undefined)})
