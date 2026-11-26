import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
const script=readFileSync(new URL('../src/TheScript.tsx',import.meta.url),'utf8')
test('Script is the sole application research page',()=>{assert.match(app,/<TheScript /);assert.doesNotMatch(app,/DailyCheatSheet|activeTab|cheatsheet/);assert.doesNotMatch(script,/Daily Cheat Sheet|More research<select/);assert.match(script,/sectionNames\.map\(s=>/)})
test('historical research remains available inside the Script',()=>{assert.match(script,/edgeiq-daily\.json/);assert.match(script,/fallbackPicks\.slice\(0,evidenceLimit\)/);assert.match(script,/Show more player research/);assert.match(script,/<NBAResearch\/>/);assert.match(script,/<NFLResearch /)})

test('reference dashboard keeps icon grid above the matchup filters',()=>{assert.match(script,/<SectionIcon section=\{s\}/);assert.ok(script.indexOf('aria-label="All Script research sections"')<script.indexOf('className="revamp-filter"'));const css=readFileSync(new URL('../src/ScriptTerminal.css',import.meta.url),'utf8');assert.match(css,/\.st-section-grid\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/)})
