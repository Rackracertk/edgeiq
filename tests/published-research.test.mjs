import test from 'node:test'
import assert from 'node:assert/strict'
import { selectHistoricalResearchPicks } from '../src/analytics/publishedResearch.ts'

test('historical research remains visible when no authorized sportsbook feed is connected', () => {
  const elite = { id: 'observed-elite', recentHits: 9, recentGames: 10 }
  const regular = { id: 'observed-regular', recentHits: 7, recentGames: 10 }
  const board = {
    picks: [elite],
    allPicks: [elite, regular],
    marketVerified: [],
    marketStatus: 'NOT_CONNECTED',
  }
  assert.deepEqual(selectHistoricalResearchPicks(board, 'all'), [elite, regular])
  assert.deepEqual(selectHistoricalResearchPicks(board, 'elite'), [elite])
})

test('missing history never creates synthetic lines or cards', () => {
  assert.deepEqual(selectHistoricalResearchPicks(undefined, 'all'), [])
  assert.deepEqual(selectHistoricalResearchPicks({ picks: [], allPicks: [] }, 'elite'), [])
  assert.deepEqual(selectHistoricalResearchPicks({ picks: [] }, 'all'), [])
})
