import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=p=>readFileSync(new URL('../src/'+p,import.meta.url),'utf8')
test('all supported research entry points render shared card',()=>{for(const file of ['App.tsx','NBAResearch.tsx','NFLResearch.tsx','TheScript.tsx','PublicGameEvidence.tsx'])assert.match(read(file),/<PlayerResearchCard /)})
test('card renders four sample windows, actual values and conditional line',()=>{const c=read('PlayerResearchCard.tsx');assert.match(c,/\['L5','L10','L15','L20'\]/);assert.match(c,/calculateRecentHitRates\(values,threshold,direction\)/);assert.match(c,/threshold!==null&&<line/);assert.match(c,/fmt\(r.value\)/);assert.match(c,/No verified line/);assert.match(read('PlayerResearchCard.css'),/stroke-dasharray:4 3/)})
