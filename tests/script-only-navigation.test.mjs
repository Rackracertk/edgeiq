import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=p=>readFileSync(new URL('../src/'+p,import.meta.url),'utf8')
const app=read('App.tsx'),home=read('Home.tsx'),match=read('MatchupResearch.tsx')
test('five simple destinations without The Script or workspace',()=>{const nav=app.slice(app.indexOf('>EXPLORE</div>'),app.indexOf('className="side-note"'));for(const label of ['Home','Game Lines','Player Props','Live Edge','Injuries'])assert.ok(nav.includes(label));assert.equal((nav.match(/<button /g)||[]).length,5);assert.doesNotMatch(app,/<TheScript|DailyCheatSheet|WORKSPACE/);assert.match(app,/Everything is free/)})
test('homepage opens selected matchup without a separate Script screen',()=>{assert.match(home,/onOpen\(g\)/);assert.match(app,/initialGame=\{matchup\?\?undefined\}/);assert.match(match,/selectMajorOdds\(data,game,sport/);assert.match(match,/<PublicGameEvidence/);assert.match(match,/<ScriptSlips/)})
test('membership preview is off by default, with no payment enabled',()=>{assert.match(read('Membership.tsx'),/VITE_MEMBERSHIP_PREVIEW==='true'/);assert.match(app,/!membershipRequired\|\|membership==='active'/);assert.match(read('AccountCenter.tsx'),/<MembershipPlans\/>/)})
