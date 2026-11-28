import test from 'node:test'
import assert from 'node:assert/strict'
import {researchCandidates,buildResearchSlips} from '../src/analytics/slipResearch.ts'
const now=Date.parse('2026-11-26T18:00:00Z')
const q=(p,extra={})=>({book:'Book A',market:'player_points',category:'Points',participant:p,participantId:p,side:'over',line:20.5,odds:-110,observedAt:new Date(now).toISOString(),...extra})
test('only fresh individually priced player props are eligible',()=>{const result=researchCandidates([q('A'),q('B',{observedAt:'2026-11-26T17:00:00Z'}),q('C',{line:null}),q('D',{odds:null}),q('E',{market:'h2h'}),q('F',{observedAt:'2026-11-26T19:00:00Z'})],[],now);assert.deepEqual(result.map(x=>x.quote.participant),['A'])})
test('combinations use one book and distinct players',()=>{const c=researchCandidates([q('A'),q('A',{side:'under'}),q('B'),q('C'),q('D'),q('E'),q('F',{book:'Book B'})],[],now);const slips=buildResearchSlips(c,'Book A');assert.deepEqual(slips.map(s=>s.legs.length),[2,3]);for(const s of slips){assert.equal(new Set(s.legs.map(l=>l.quote.participant)).size,s.legs.length);assert.ok(s.legs.every(l=>l.quote.book==='Book A'))}assert.equal(buildResearchSlips(c,'Book B').length,0)})
test('missing odds never invents legs and unknown history is marked',()=>{assert.deepEqual(buildResearchSlips(researchCandidates([],[],now),'Book A'),[]);assert.equal(researchCandidates([q('A')],[],now)[0].evidence,null)})
test('reported injury excludes matching evidence-backed candidate',()=>{const quote=q('A');assert.equal(researchCandidates([quote],[{quote,games:10,hits:7,pushes:0,score:80,injury:'Out'}],now).length,0)})
