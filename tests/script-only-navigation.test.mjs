import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
const script=readFileSync(new URL('../src/TheScript.tsx',import.meta.url),'utf8')
test('Script is the sole application research page',()=>{assert.match(app,/<TheScript /);assert.doesNotMatch(app,/DailyCheatSheet|activeTab|cheatsheet/);assert.doesNotMatch(script,/Daily Cheat Sheet|detailOpen|scrollIntoView|window\.scrollTo/)})
test('four simplified tabs preserve all thirteen research topics',()=>{
 const group=script.slice(script.indexOf('const researchGroups:'),script.indexOf('const sectionIcons:'))
 assert.equal((group.match(/label:/g)||[]).length,5) // four entries plus the type declaration
 for(const topic of ['Game Overview','Player Intelligence','Market Board','Game Flow','Injury Impact','Live Script','Matchup Matrix','Market Movement','Model vs. Market','Risk Radar','Correlation Map','Scenario Analysis','Results Tracker'])assert.ok(group.includes("'"+topic+"'"),topic)
 assert.match(script,/researchGroups\.map\(g=>/);assert.match(script,/activeGroup\.sections\.map\(s=>/);assert.match(script,/onClick=\{\(\)=>openSection\(s\)\}/)
})
test('matchup selection is above the research navigation and filters are optional',()=>{assert.ok(script.indexOf('aria-label="Find a game"')<script.indexOf('aria-label="Research tabs"'));assert.match(script,/value=\{gameId\}/);assert.match(script,/filtersOpen&&/);assert.match(script,/aria-label="Research topics"/)})
test('historical research remains available inside the Script',()=>{assert.match(script,/edgeiq-daily\.json/);assert.match(script,/fallbackPicks\.slice\(0,evidenceLimit\)/);assert.match(script,/Show more player research/);assert.match(script,/<NBAResearch\/>/);assert.match(script,/<NFLResearch /)})
