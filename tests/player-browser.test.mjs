import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=p=>readFileSync(new URL('../src/'+p,import.meta.url),'utf8')
test('player browser renders available players without required search',()=>{const c=read('PlayerBrowser.tsx');assert.match(c,/useState\(''\)/);assert.match(c,/!query\|\|/);assert.match(c,/filtered\.slice\(0,limit\)\.map/);assert.match(c,/onSelect\(p\)/);assert.match(c,/All \{teamLabel/);assert.match(c,/Show more players/)})
test('player research surfaces automatically expose a directory',()=>{for(const p of ['App.tsx','NBAResearch.tsx','NFLResearch.tsx','PublicGameEvidence.tsx'])assert.match(read(p),/<PlayerBrowser /);assert.match(read('App.tsx'),/<AutoPropBoard /);assert.match(read('AutoPropBoard.tsx'),/All games/);assert.match(read('AutoPropBoard.tsx'),/<PublicGameEvidence/)})
