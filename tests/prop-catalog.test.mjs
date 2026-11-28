import test from 'node:test'
import assert from 'node:assert/strict'
import {propCatalog,canonicalProp,historicalMarket} from '../src/analytics/propCatalog.ts'
import {addFootballCombinations} from '../src/analytics/combinedHistory.ts'
import {getNBAGamePropValue} from '../src/analytics/nbaData.ts'
test('every supported sport has grouped research categories and alternate labels match full-game stats',()=>{for(const s of ['NBA','NFL','MLB','NHL','NCAAF','NCAAB','WNBA','SOCCER','TENNIS','MMA'])assert.ok(propCatalog(s).length>=8);assert.equal(canonicalProp('NBA','player_points_assists_alternate','alternate PA'),'Points + Assists (PA)');assert.equal(historicalMarket('NBA','player_points_q1'),undefined);assert.equal(historicalMarket('NBA','player_fantasy_points'),undefined)})
test('new basketball stats use recorded fields, never fabricated zero',()=>{const game={points:20,rebounds:5,assists:4,threes:2,fieldGoalsMade:8,turnovers:0};assert.equal(getNBAGamePropValue(game,'Field Goals Made'),8);assert.equal(getNBAGamePropValue(game,'Turnovers'),0);assert.equal(getNBAGamePropValue(game,'Free Throw Attempts'),null)})
test('football combinations require all components for the same game',()=>{const row=(gameId,value)=>({gameId,date:'2026-11-20',value});const h=addFootballCombinations({'Passing Yards':[row('a',200),row('b',180)],'Rushing Yards':[row('a',20)]});assert.deepEqual(h['Passing + Rushing Yards'],[row('a',220)]);assert.equal(h['Rushing + Receiving Yards'],undefined)})
