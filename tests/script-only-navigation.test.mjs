import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
const script=readFileSync(new URL('../src/TheScript.tsx',import.meta.url),'utf8')
const home=readFileSync(new URL('../src/Home.tsx',import.meta.url),'utf8')
test('five primary destinations, free access and no standalone cheat sheet',()=>{const nav=app.slice(app.indexOf('>EXPLORE</div>'),app.indexOf('className="side-note"'));for(const label of ['Home','The Script','Player Props','Live Edge','Injuries'])assert.ok(nav.includes(label));assert.equal((nav.match(/<button /g)||[]).length,5);assert.doesNotMatch(app,/DailyCheatSheet|Daily Cheat Sheet|WORKSPACE/);assert.match(app,/Everything is free/)})
test('home opens the exact selected fixture inside The Script',()=>{assert.match(home,/onOpen\(g\)/);assert.match(app,/initialGame=\{scriptGame\?\?undefined\}/);assert.match(script,/initialGame\?\.id/);assert.match(script,/initialGame\?\.league/)})
test('narrative and underlying research are retained',()=>{assert.match(script,/narrative=\{section==='Game Overview'/);assert.match(script,/edgeiq-daily\.json/);assert.match(script,/activeGroup\.sections\.map\(s=>/);assert.match(script,/accuracy=\{section==='Results Tracker'\}/)})
