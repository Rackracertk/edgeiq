import test from 'node:test'
import assert from 'node:assert/strict'
import { buildNBAPicks, meetsEliteHistory } from '../src/cheatSheetData.ts'
import { enrichElitePicks, americanOddsBreakEven } from '../src/analytics/eliteResearch.ts'
import { parseNFLBoxscore } from '../src/analytics/nflBoxscore.ts'

const DAY = 86_400_000
function makeFixture(hits) {
  const future = new Date(Date.now() + DAY).toISOString()
  const slate = { date: future.slice(0, 10).replaceAll('-', ''), label: 'Next', isToday: false,
    source: 'test fixtures', games: [{ id: 'upcoming', date: future, teams: [
      { id: '1', abbreviation: 'LAL', name: 'Los Angeles Lakers' },
      { id: '2', abbreviation: 'BOS', name: 'Boston Celtics' },
    ] }] }
  const history = { star: Array.from({ length: 10 }, (_, i) => ({
    gameId: 'star-' + i, date: new Date(Date.now() - (i + 1) * DAY).toISOString(),
    team: 'Los Angeles Lakers', opponent: 'New York Knicks', position: 'PG',
    minutes: 32, points: i < hits ? 25 : 16,
    rebounds: [5,8,3,11,2,6,9,3,8,5][i],
    assists: [1,9,3,7,11,2,7,0,8,5][i],
    threes: [1,3,2,0,5,1,0,4,2,3][i],
  })) }
  const players = [{ id: 'star', name: 'Sample Player', team: 'Los Angeles Lakers', teamId: '1', position: 'PG' }]
  return { slate, history, players }
}

test('90% observed screening: never label an 8-of-10 trend elite', () => {
  assert.equal(meetsEliteHistory('NBA', 5, 9, 10), true)
  assert.equal(meetsEliteHistory('NBA', 5, 8, 10), false)
  assert.equal(meetsEliteHistory('NBA', 5, 9, 9), false)
  assert.equal(meetsEliteHistory('NFL', 4, 8, 8), true)
  assert.equal(meetsEliteHistory('NFL', 3, 8, 8), false)
  const fixture = makeFixture(9)
  const picks = buildNBAPicks(fixture.slate, fixture.history, fixture.players)
  assert.ok(picks.length > 0)
  assert.ok(picks.every(pick => pick.recentHits / pick.recentGames >= .9))
})

test('position allowance is counted by opponent player appearances in separate games', () => {
  const fixture = makeFixture(9)
  for (let i = 0; i < 8; i++) {
    fixture.history['opponent-athlete-' + i] = [{
      gameId: 'defense-game-' + (i % 4),
      date: new Date(Date.now() - (i + 2) * DAY).toISOString(),
      team: 'Miami Heat', opponent: 'Boston Celtics',
      position: 'PG', minutes: 30, points: 24, rebounds: 4, assists: 4, threes: 2, steals: 1, blocks: 1,
    }]
  }
  const picks = buildNBAPicks(fixture.slate, fixture.history, fixture.players)
  const analyzed = enrichElitePicks(picks, 'NBA', fixture.slate, fixture.history, [], fixture.players)
  const corroborated = analyzed.find(pick => pick.defense?.games === 8)
  assert.ok(corroborated)
  assert.equal(corroborated.defense?.distinctGames, 4)
  assert.equal(corroborated.defense?.position, 'PG')
  assert.equal(corroborated.researchGrade, 'MATCHUP BACKED')
  assert.equal(corroborated.headToHead, null)
})

test('absence of minutes data prevents a made-up NBA position matchup grade', () => {
  const fixture = makeFixture(10)
  for (let i = 0; i < 8; i++) {
    fixture.history['missing-minutes-' + i] = [{
      gameId: 'defense-game-' + i,
      date: new Date(Date.now() - (i + 2) * DAY).toISOString(),
      team: 'Miami Heat', opponent: 'Boston Celtics', position: 'PG',
      points: 25, rebounds: 4, assists: 4, threes: 2,
    }]
  }
  const analyzed = enrichElitePicks(buildNBAPicks(fixture.slate, fixture.history, fixture.players),
    'NBA', fixture.slate, fixture.history, [], fixture.players)
  assert.ok(analyzed.every(pick => pick.researchGrade === 'TREND ONLY'))
})

test('NFL positions and opponents are only copied from explicit boxscore/game metadata', () => {
  const rows = parseNFLBoxscore({boxscore: {players: [{
    team: { abbreviation: 'GB' }, statistics: [{
      name: 'passing', labels: ['YDS', 'TD', 'INT'],
      athletes: [{ athlete: { id: '12', displayName: 'Sample QB', position: { abbreviation: 'QB' } },
        stats: ['260','2','0'] }]
    }]
  }]}}, { id: 'game1', date: '2026-11-12', teams: [{ abbreviation: 'GB' }, { abbreviation: 'MIN' }] })
  assert.equal(rows[0].position, 'QB')
  assert.equal(rows[0].opponent, 'MIN')
})

test('market odds show arithmetic break-even, not an implied player forecast', () => {
  assert.equal(americanOddsBreakEven(-110), 52.4)
  assert.equal(americanOddsBreakEven(150), 40)
  assert.equal(americanOddsBreakEven(0), null)
})
