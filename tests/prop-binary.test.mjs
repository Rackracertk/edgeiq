import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizeQuotes,sports} from '../scripts/publish-major-odds.mjs'
import {buildPropBoard} from '../src/analytics/propBoard.ts'
const now=Date.parse('2026-11-26T18:00:00Z'),date='2026-11-26T21:30:00Z'
test('yes/no quotes preserve null actual line and group separately from numerical lines',()=>{const quotes=normalizeQuotes({bookmakers:[{title:'Book',last_update:new Date(now).toISOString(),markets:[{key:'player_double_double',outcomes:[{description:'Player',name:'Yes',price:120},{description:'Player',name:'No',price:-140}]}]}]},sports.NBA,now);assert.equal(quotes.length,2);assert.equal(quotes[0].line,null);assert.equal(quotes[0].side,'yes');const game={id:'a',path:'basketball/nba',date,state:'pre',participants:[{name:'A'},{name:'B'}]};const board=buildPropBoard({schemaVersion:1,games:[{sport:'NBA',home:'A',away:'B',time:date,quotes}]},[game],'NBA',now);assert.equal(board.length,1);assert.equal(board[0].binary,true);assert.equal(board[0].over.side,'yes');assert.equal(board[0].under.side,'no')})
