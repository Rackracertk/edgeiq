import test from 'node:test'
import assert from 'node:assert/strict'
import { getNBAGamePropValue, getPlayerPropValues, isNBABinaryProp } from '../src/analytics/nbaData.ts'
import { parseNFLBoxscore, defaultNFLLine } from '../src/analytics/nflBoxscore.ts'

const nba = { date: '2026-11-12', points: 21, rebounds: 11, assists: 10, steals: 2, blocks: 1, threes: 3 }
test('NBA combined stats use actual component totals', () => {
  assert.equal(getNBAGamePropValue(nba, 'Points + Assists (PA)'), 31)
  assert.equal(getNBAGamePropValue(nba, 'Points + Rebounds (PR)'), 32)
  assert.equal(getNBAGamePropValue(nba, 'Assists + Rebounds (AR)'), 21)
  assert.equal(getNBAGamePropValue(nba, 'Steals + Blocks (SB)'), 3)
  assert.equal(getNBAGamePropValue(nba, 'PRA'), 42)
})
test('NBA double-double and triple-double use three-or-two distinct double-digit categories', () => {
  assert.equal(getNBAGamePropValue(nba, 'Double-Double'), 1)
  assert.equal(getNBAGamePropValue(nba, 'Triple-Double'), 1)
  assert.equal(getNBAGamePropValue({ ...nba, assists: 4 }, 'Double-Double'), 1)
  assert.equal(getNBAGamePropValue({ ...nba, assists: 4 }, 'Triple-Double'), 0)
  assert.equal(getNBAGamePropValue({ ...nba, points: 8, rebounds: 8 }, 'Double-Double'), 0)
  assert.equal(isNBABinaryProp('Triple-Double'), true)
})
test('NBA unavailable steals or blocks are omitted, not reported as zero', () => {
  assert.equal(getNBAGamePropValue({ ...nba, steals: undefined }, 'Steals + Blocks (SB)'), null)
  assert.equal(getNBAGamePropValue({ ...nba, blocks: undefined }, 'Double-Double'), null)
  assert.deepEqual(getPlayerPropValues([nba, { ...nba, steals: undefined }], 'Steals + Blocks (SB)'), [3])
  assert.equal(getNBAGamePropValue(nba, 'unsupported stat'), null)
})
test('NFL distinguishes QB interceptions thrown from defensive sacks', () => {
  const game = { id: '12345', date: '2026-11-12' }
  const box = {
    boxscore: { players: [{ team: { abbreviation: 'GB' }, statistics: [
      { name: 'passing', labels: ['YDS', 'TD', 'INT'], athletes: [
        { athlete: { id: 'qb-1', displayName: 'Sample QB' }, stats: ['235', '2', '1'] }
      ] },
      { name: 'defensive', labels: ['TOT', 'SACK'], athletes: [
        { athlete: { id: 'lb-1', displayName: 'Sample LB' }, stats: ['7', '1.5'] }
      ] }
    ] }] }
  }
  const rows = parseNFLBoxscore(box, game)
  assert.equal(rows.find(row => row.playerId === 'qb-1')?.stats['Interceptions Thrown'], 1)
  assert.equal(rows.find(row => row.playerId === 'qb-1')?.stats['Sacks'], undefined)
  assert.equal(rows.find(row => row.playerId === 'lb-1')?.stats['Sacks'], 1.5)
  assert.equal(rows.find(row => row.playerId === 'lb-1')?.stats['Interceptions Thrown'], undefined)
  assert.equal(defaultNFLLine('Sacks'), 0.5)
  assert.equal(defaultNFLLine('Interceptions Thrown'), 0.5)
})
test('NFL does not invent missing statistics', () => {
  const rows = parseNFLBoxscore({ boxscore: { players: [{ team: { abbreviation: 'DAL' }, statistics: [
    { name: 'defensive', labels: ['TOT'], athletes: [{ athlete: { id: '11', displayName: 'Defender' }, stats: ['4'] }] }
  ] }] } }, { id: '1', date: '2026-11-11' })
  assert.deepEqual(rows, [])
})
