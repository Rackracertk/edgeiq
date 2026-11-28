/**
 * Historical observations and live sportsbook offers are different datasets.
 * A missing licensed odds feed must not erase completed-game research.
 * Never relabel these historical reference thresholds as offered markets.
 */
export function selectHistoricalResearchPicks<T>(
  board: { picks: T[]; allPicks?: T[] } | undefined,
  mode: 'all' | 'elite',
): T[] {
  if (!board) return []
  const records = mode === 'elite' ? board.picks : board.allPicks
  return Array.isArray(records) ? records : []
}
