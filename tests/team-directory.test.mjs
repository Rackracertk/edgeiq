import test from 'node:test'
import assert from 'node:assert/strict'
import {teamsFor,teamFor,teamMatches,teamName} from '../src/analytics/teamDirectory.ts'
test('all NBA and NFL teams available even without an injury row',()=>{assert.equal(teamsFor('NBA').length,30);assert.equal(teamsFor('NFL').length,32)})
test('team aliases, full names and nicknames',()=>{assert.equal(teamFor('NBA','GSW')?.code,'GS');assert.equal(teamName('NFL','GB'),'Green Bay Packers');assert.equal(teamMatches('NFL','GB','packers'),true);assert.equal(teamMatches('NBA','LAL','Los Angeles'),true);assert.equal(teamMatches('NBA','LAC','Lakers'),false);assert.equal(teamMatches('NFL','TB','Bucs'),true)})
