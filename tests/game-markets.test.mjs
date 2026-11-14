import test from 'node:test'
import assert from 'node:assert/strict'
import {
  americanImpliedProbability, normalizedMoneylineProbability, parseGameMarkets,
} from '../src/analytics/marketParsing.ts'

function fixture(odds) {
  return {
    id: 'game-100',
    date: '2026-11-15T20:00:00Z',
    competitions: [{
      competitors: [
        { homeAway: 'home', team: { abbreviation: 'BOS', displayName: 'Boston Celtics' } },
        { homeAway: 'away', team: { abbreviation: 'MIA', displayName: 'Miami Heat' } },
      ],
      ...(odds ? { odds: [odds] } : {}),
    }],
  }
}

test('Converts American moneylines to normalized market-implied odds, not a model forecast', () => {
  assert.equal(americanImpliedProbability(-150), 0.6)
  assert.equal(americanImpliedProbability(120), 100 / 220)
  const result = normalizedMoneylineProbability(-150, 120)
  assert.ok(result)
  assert.equal(result.home + result.away, 100)
  assert.ok(result.home > result.away)
  assert.equal(normalizedMoneylineProbability(null, 120), null)
})

test('Reports real moneylines, favorite-attributed spreads and total points', () => {
  const game = parseGameMarkets(fixture({
    provider: { name: 'Example Sportsbook' },
    homeTeamOdds: { favorite: true, moneyLine: -150, spreadOdds: -110 },
    awayTeamOdds: { favorite: false, moneyLine: 120, spreadOdds: -110 },
    details: 'BOS -3.5', spread: -3.5, overUnder: 221.5,
    overOdds: -110, underOdds: -110,
  }), 'NBA')
  assert.ok(game)
  assert.equal(game.provider, 'Example Sportsbook')
  assert.equal(game.away.abbreviation, 'MIA')
  assert.equal(game.home.abbreviation, 'BOS')
  assert.equal(game.homeMoneyline, -150)
  assert.equal(game.awayMoneyline, 120)
  assert.equal(game.homeSpread, -3.5)
  assert.equal(game.awaySpread, 3.5)
  assert.equal(game.total, 221.5)
  assert.equal(game.overOdds, -110)
  assert.ok(game.homeProbability > 50)
})

test('When visitor sees away favorite, correctly reverses signed spread', () => {
  const game = parseGameMarkets(fixture({
    homeTeamOdds: { favorite: false, moneyLine: 170 },
    awayTeamOdds: { favorite: true, moneyLine: -200 },
    details: 'MIA -4.5', spread: -4.5, overUnder: 223,
  }), 'NBA')
  assert.equal(game.homeSpread, 4.5)
  assert.equal(game.awaySpread, -4.5)
  assert.ok(game.awayProbability > game.homeProbability)
})

test('Does not fabricate spread, total, or probability when missing', () => {
  const game = parseGameMarkets(fixture(null), 'NFL')
  assert.ok(game)
  assert.equal(game.homeSpread, null)
  assert.equal(game.awaySpread, null)
  assert.equal(game.total, null)
  assert.equal(game.homeProbability, null)
  assert.equal(game.hasMarkets, false)
})
test('Ambiguous favorite gives textual source spread only, never invented team spreads', () => {
  const game = parseGameMarkets(fixture({ spread: -3, details: 'BOS -3', overUnder: 231 }), 'NBA')
  assert.equal(game.homeSpread, null)
  assert.equal(game.awaySpread, null)
  assert.equal(game.spreadDescription, 'BOS -3')
  assert.equal(game.total, 231)
})
test('Pulls quoted odds from summary pickcenter if scoreboard has no odds', () => {
  const game = parseGameMarkets(fixture(null), 'NFL', {
    pickcenter: [{
      provider: { name: 'Another Book' },
      homeTeamOdds: { favorite: false, moneyLine: 135 },
      awayTeamOdds: { favorite: true, moneyLine: -160 },
      overUnder: 46.5,
    }],
  })
  assert.equal(game.provider, 'Another Book')
  assert.equal(game.total, 46.5)
  assert.ok(game.awayProbability > game.homeProbability)
})
