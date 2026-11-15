import test from 'node:test'
import assert from 'node:assert/strict'
import { impliedProbability, noVigProbability, validateQuote, verifyPickMarkets } from '../src/analytics/verifiedMarkets.ts'

const now = Date.parse('2026-11-15T15:00:00Z')
const base = {
  sport:'NFL', eventId:'401', playerId:'100', category:'Passing TDs',
  sportsbook:'TestBook', line:1.5, overOdds:-110, underOdds:-110,
  source:'authorized-provider-export', observedAt:'2026-11-15T14:55:00Z',
}
const pick = {
  id:'prop-1', sport:'NFL', playerId:'100', category:'Passing TDs',
  direction:'under', line:1.5, gameTime:'2026-11-15T18:00:00Z',
}
test('no-vig calculation removes bookmaker margin', () => {
  assert.ok(Math.abs(impliedProbability(-110) - 110/210) < 1e-9)
  assert.ok(Math.abs(noVigProbability(-110,-110,'over') - .5) < 1e-9)
})
test('rejects stale, future, unpriced and malformed records', () => {
  assert.equal(validateQuote(base,now),true)
  assert.equal(validateQuote({...base,observedAt:'2026-11-15T14:30:00Z'},now),false)
  assert.equal(validateQuote({...base,observedAt:'2026-11-15T16:00:00Z'},now),false)
  assert.equal(validateQuote({...base,underOdds:0},now),false)
  assert.equal(validateQuote({...base,source:''},now),false)
  assert.equal(validateQuote({...base,line:-1},now),false)
})
test('exact line, event, athlete, and prop are mandatory', () => {
  assert.equal(verifyPickMarkets(pick,'401',[{...base,line:2.5}],now),null)
  assert.equal(verifyPickMarkets(pick,'402',[base],now),null)
  assert.equal(verifyPickMarkets(pick,'401',[{...base,playerId:'OTHER'}],now),null)
  assert.equal(verifyPickMarkets(pick,'401',[{...base,category:'Rushing Yards'}],now),null)
})
test('deduplicates sportsbook records and selects best current odds', () => {
  const result=verifyPickMarkets(pick,'401',[
    base,{...base,observedAt:'2026-11-15T14:56:00Z',underOdds:110},
    {...base,sportsbook:'OtherBook',overOdds:-150,underOdds:125},
  ],now)
  assert.equal(result.sportsbookCount,2)
  assert.equal(result.bestOdds,125)
  assert.equal(result.consensusLine,1.5)
  assert.equal(result.offers.length,2)
})
test('does not verify a game that has started', () => {
  assert.equal(verifyPickMarkets({...pick,gameTime:'2026-11-15T14:00:00Z'},'401',[base],now),null)
})
