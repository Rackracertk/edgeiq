import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
const script=readFileSync(new URL('../src/TheScript.tsx',import.meta.url),'utf8')
const evidence=readFileSync(new URL('../src/PublicGameEvidence.tsx',import.meta.url),'utf8')
test('classic sidebar and Script are restored without daily cheat sheet or Workspace menu',()=>{assert.match(app,/className="sidebar"/);assert.match(app,/<TheScript /);assert.match(app,/Player Research/);assert.match(app,/Halftime Edge/);assert.doesNotMatch(app,/DailyCheatSheet|Daily Cheat Sheet|WORKSPACE/);assert.match(app,/Everything is free/)})
test('Script narrative and advanced research are preserved',()=>{assert.match(script,/narrative=\{section==='Game Overview'/);assert.match(evidence,/matchupNarrative/);assert.match(evidence,/not confirmed future actions/);assert.match(script,/edgeiq-daily\.json/);assert.match(script,/fallbackPicks\.slice\(0,evidenceLimit\)/);assert.match(script,/activeGroup\.sections\.map\(s=>/)})
