import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'
import {nflHistoryPublication} from '../scripts/nfl-history-publication.mjs'
const now=Date.parse('2026-11-26T20:00:00Z'),date='2026-11-22T18:00:00Z'
test('cached completed game groups merge without duplicate games or invented zeros',()=>{const row={gameId:'1',date,playerId:'p',player:'Player',stats:{'Passing Yards':225}};const data=nflHistoryPublication({version:1,nfl:{'1':{date,rows:[row,{...row,stats:{'Rushing Yards':12}},{...row,stats:{'Passing Yards':225}}]},'2':{date:'2026-11-27T00:00:00Z',rows:[row]}}},now);assert.equal(data.players.p.games.length,1);assert.deepEqual(data.players.p.games[0].stats,{'Passing Yards':225,'Rushing Yards':12})})
test('existing repository NFL cache produces real player histories',()=>{const path=new URL('../data/edgeiq-research-cache.json',import.meta.url);if(!existsSync(path))return;const result=nflHistoryPublication(JSON.parse(readFileSync(path,'utf8')),now);assert.ok(result&&Object.keys(result.players).length>100);const players=Object.values(result.players);assert.ok(players.some(p=>p.name==='CeeDee Lamb'&&p.games.some(g=>Number.isFinite(g.stats['Receiving Yards']))));console.log('Cached NFL player histories:',players.length)})
