
export type Direction = "over" | "under";

export function calculateHitRate(
  results: number[],
  line: number,
  direction: Direction = "over"
): number | null {
  if (results.length === 0) return null;

  const hits = results.filter((value) =>
    direction === "over" ? value > line : value < line
  ).length;

  return Math.round((hits / results.length) * 100);
}

export function calculateAverage(
  results: number[]
): number | null {
  if (results.length === 0) return null;

  const total = results.reduce(
    (sum, value) => sum + value,
    0
  );

  return Math.round((total / results.length) * 10) / 10;
}

export function calculateRecentHitRates(
  results: number[],
  line: number,
  direction: Direction = "over"
) {
  // Results must be ordered newest game first.
  
return {
  L5: results.length >= 5
    ? calculateHitRate(results.slice(0, 5), line, direction)
    : null,
  L10: results.length >= 10
    ? calculateHitRate(results.slice(0, 10), line, direction)
    : null,
  L20: results.length >= 20
    ? calculateHitRate(results.slice(0, 20), line, direction)
    : null,
};

}
