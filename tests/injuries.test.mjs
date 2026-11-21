import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeInjuries, injuryAvailability, shouldExcludeInjury, findInjury } from '../src/analytics/injuryStatus.ts'

test('Normalizes nested ESPN injury reports by athlete and team', () => {
  const rows = normalizeInjuries({ injuries: [
    { team: { id: '10', abbreviation: 'NYK' }, injuries: [
      { athlete: { id: '44', displayName: 'First Player' }, status: 'Out',
        type: { name: 'Hamstring' }, date: '2026-11-14T14:00:00Z' },
      { athlete: { id: '45', displayName: 'Second Player' }, status: 'Questionable',
        type: { name: 'Ankle' } },
    ] },
    { team: { id: '12', abbreviation: 'BOS' }, injuries: [
      { athlete: { id: '99', displayName: 'Third Player' }, status: 'Probable' },
    ] }
  ] })
  assert.equal(rows.length, 3)
  assert.equal(findInjury(rows,'44','First Player','NYK','10')?.status,'Out')
  assert.equal(findInjury(rows,'','Second Player','NYK','10')?.status,'Questionable')
  assert.equal(findInjury(rows,'44','First Player','BOS','12')?.status,'Out')
  assert.equal(rows[0].reason,'Hamstring')
})
test('Exclude reported unavailable and uncertain players, not probable ones', () => {
  for (const status of ['Out','Injured Reserve','Doubtful','Questionable','Game-Time Decision','Day-To-Day','Suspended']) {
    assert.equal(shouldExcludeInjury({status}),true,status)
  }
  for (const status of ['Probable','Active','Available']) {
    assert.equal(shouldExcludeInjury({status}),false,status)
  }
  assert.equal(injuryAvailability('Out'),'unavailable')
  assert.equal(injuryAvailability('Questionable'),'risk')
  assert.equal(shouldExcludeInjury(undefined),false)
})
test('Status parser is conservative with unknown statuses and missing reports', () => {
  assert.deepEqual(normalizeInjuries({injuries: []}),[])
  assert.deepEqual(normalizeInjuries({}),[])
  assert.equal(injuryAvailability(''),'unknown')
  assert.equal(findInjury([], '123','Nobody','GB','8'),undefined)
})
