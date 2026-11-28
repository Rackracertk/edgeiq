// Only authorized sportsbook feed records may enter this market-verification layer.
// Reference thresholds produced from historical box scores are NEVER market quotes.
import type { CheatPick } from '../cheatSheetData.ts'

export type MarketQuote = {
  sport: 'NBA' | 'NFL'
  eventId: string
  playerId: string
  category: string
  sportsbook: string
  line: number
  overOdds: number
  underOdds: number
  observedAt: string
  source: string
}
export type VerifiedMarket = {
  pickId: string
  eventId: string
  sportsbookCount: number
  consensusLine: number
  averageLine: number
  minLine: number
  maxLine: number
  offers: { sportsbook: string; odds: number; observedAt: string }[]
  bestOdds: number
  impliedProbability: number
  noVigProbability: number
  lastUpdated: string
}

const clean = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const validOdds = (value: number) => Number.isInteger(value) && (value <= -100 || value >= 100) && Math.abs(value) <= 100000
export function impliedProbability(odds: number): number | null {
  if (!validOdds(odds)) return null
  return odds > 0 ? 100 / (100 + odds) : -odds / (100 - odds)
}
export function noVigProbability(overOdds: number, underOdds: number, side: 'over' | 'under'): number | null {
  const over = impliedProbability(overOdds)
  const under = impliedProbability(underOdds)
  if (over === null || under === null || over + under <= 1) return null
  return (side === 'over' ? over : under) / (over + under)
}
export function validateQuote(input: unknown, now = Date.now(), maxAgeMs = 15 * 60_000): input is MarketQuote {
  if (!input || typeof input !== 'object') return false
  const q = input as Partial<MarketQuote>
  const time = Date.parse(String(q.observedAt ?? ''))
  return (q.sport === 'NBA' || q.sport === 'NFL') &&
    [q.eventId, q.playerId, q.category, q.sportsbook, q.source].every(x => typeof x === 'string' && x.trim().length > 0) &&
    clean(q.line) && q.line >= 0 && q.line <= 1000 &&
    validOdds(q.overOdds ?? NaN) && validOdds(q.underOdds ?? NaN) &&
    Number.isFinite(time) && time <= now + 60_000 && now - time <= maxAgeMs &&
    noVigProbability(q.overOdds!, q.underOdds!, 'over') !== null
}
export function verifyPickMarkets(
  pick: CheatPick,
  eventId: string,
  rawQuotes: unknown[],
  now = Date.now(),
): VerifiedMarket | null {
  if (!eventId || Date.parse(pick.gameTime) <= now) return null
  const unique = new Map<string, MarketQuote>()
  for (const raw of rawQuotes) {
    if (!validateQuote(raw, now)) continue
    if (raw.sport !== pick.sport || raw.eventId !== eventId ||
        raw.playerId !== pick.playerId || raw.category !== pick.category ||
        raw.line !== pick.line) continue
    const key = raw.sportsbook.trim().toLowerCase()
    if (!unique.has(key) || Date.parse(raw.observedAt) > Date.parse(unique.get(key)!.observedAt)) unique.set(key, raw)
  }
  const matched = [...unique.values()]
  if (!matched.length) return null
  const sideOdds = (q: MarketQuote) => pick.direction === 'over' ? q.overOdds : q.underOdds
  const lines = matched.map(q => q.line)
  const offers = matched.map(q => ({ sportsbook: q.sportsbook, odds: sideOdds(q), observedAt: q.observedAt }))
    .sort((a, b) => (impliedProbability(a.odds) ?? 1) - (impliedProbability(b.odds) ?? 1))
  const best = offers[0]
  // A reference threshold is only verified at its EXACT market, not a nearby alternate.
  return {
    pickId: pick.id, eventId, sportsbookCount: matched.length,
    consensusLine: pick.line,
    averageLine: lines.reduce((a, b) => a + b, 0) / lines.length,
    minLine: Math.min(...lines), maxLine: Math.max(...lines),
    offers, bestOdds: best.odds,
    impliedProbability: impliedProbability(best.odds)!,
    noVigProbability: noVigProbability(
      matched.find(q => q.sportsbook === best.sportsbook)!.overOdds,
      matched.find(q => q.sportsbook === best.sportsbook)!.underOdds,
      pick.direction)!,
    lastUpdated: matched.map(q => q.observedAt).sort().at(-1)!,
  }
}
