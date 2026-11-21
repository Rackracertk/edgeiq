import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateHitRate, calculateRecentHitRates, calculateAverage } from '../src/analytics/hitRates.ts'
import { getPlayerPropValues } from '../src/analytics/nbaData.ts'

test('over and under are strict and a push is not a hit', () => {
  assert.equal(calculateHitRate([2, 3, 4, 5], 3, 'over'), 50)
  assert.equal(calculateHitRate([2, 3, 4, 5], 3, 'under'), 25)
})

test('N/A for unavailable windows instead of invented hit rates', () => {
  const short = calculateRecentHitRates([4, 2, 0], 2, 'over')
  assert.equal(short.L5, null)
  assert.equal(short.L10, null)
  assert.equal(short.L20, null)
  assert.equal(calculateHitRate([], 2), null)
})

test('proper newest-first windows L5 and L10', () => {
  const values = [5,5,5,5,1,1,1,1,1,1]
  const rates = calculateRecentHitRates(values, 2, 'over')
  assert.equal(rates.L5, 80)
  assert.equal(rates.L10, 40)
  assert.equal(rates.L20, null)
  assert.equal(calculateAverage([1,2,3]), 2)
})

test('PRA and three-point value mapping', () => {
  const rows = [{date:'2026-11-13', points:24, rebounds:7, assists:8, threes:4}]
  assert.deepEqual(getPlayerPropValues(rows,'PRA'), [39])
  assert.deepEqual(getPlayerPropValues(rows,'3-Pointers Made'), [4])
})
