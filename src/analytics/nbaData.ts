export type NBAPlayerGame = {
  date: string
  points: number
  rebounds: number
  assists: number
  threes: number
  steals?: number
  blocks?: number
  gameId?: string
  team?: string
  opponent?: string
  homeAway?: 'home' | 'away'
}

export const NBA_PROP_CATEGORIES = [
  'Points', 'Rebounds', 'Assists', '3-Pointers Made', 'Steals', 'Blocks', 'PRA',
  'Points + Assists (PA)', 'Points + Rebounds (PR)',
  'Assists + Rebounds (AR)', 'Steals + Blocks (SB)',
  'Double-Double', 'Triple-Double',
] as const

export function isNBABinaryProp(prop: string): boolean {
  return prop === 'Double-Double' || prop === 'Triple-Double'
}
export function defaultNBALine(prop: string): number {
  if (isNBABinaryProp(prop)) return 0.5
  if (prop === 'Steals' || prop === 'Blocks') return 0.5
  if (prop === 'Steals + Blocks (SB)') return 1.5
  if (prop === 'Assists + Rebounds (AR)') return 10.5
  if (prop === 'Points + Assists (PA)' || prop === 'Points + Rebounds (PR)') return 25.5
  if (prop === '3-Pointers Made') return 1.5
  if (prop === 'Rebounds') return 5.5
  if (prop === 'Assists') return 4.5
  if (prop === 'PRA') return 30.5
  return 19.5
}

function valid(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

// A null value means the source did not supply the required category.
// Never treat missing steals or blocks as zero, or include missing games
// in a hit-rate denominator.
export function getNBAGamePropValue(game: NBAPlayerGame, prop: string): number | null {
  if (![game.points, game.rebounds, game.assists, game.threes].every(valid)) return null
  if (prop === 'Points') return game.points
  if (prop === 'Rebounds') return game.rebounds
  if (prop === 'Assists') return game.assists
  if (prop === '3-Pointers Made') return game.threes
  if (prop === 'PRA') return game.points + game.rebounds + game.assists
  if (prop === 'Points + Assists (PA)') return game.points + game.assists
  if (prop === 'Points + Rebounds (PR)') return game.points + game.rebounds
  if (prop === 'Assists + Rebounds (AR)') return game.assists + game.rebounds
  if (prop === 'Steals') return valid(game.steals) ? game.steals : null
  if (prop === 'Blocks') return valid(game.blocks) ? game.blocks : null
  if (prop === 'Steals + Blocks (SB)') {
    return valid(game.steals) && valid(game.blocks) ? game.steals + game.blocks : null
  }
  if (isNBABinaryProp(prop)) {
    if (!valid(game.steals) || !valid(game.blocks)) return null
    const tens = [game.points, game.rebounds, game.assists, game.steals, game.blocks]
      .filter(value => value >= 10).length
    return tens >= (prop === 'Triple-Double' ? 3 : 2) ? 1 : 0
  }
  return null
}

export function getPlayerPropValues(games: NBAPlayerGame[], prop: string): number[] {
  return games.flatMap(game => {
    const value = getNBAGamePropValue(game, prop)
    return value === null ? [] : [value]
  })
}

export function calculateNBAHitRates(games: NBAPlayerGame[], prop: string, line: number) {
  const sortedGames = [...games].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const values = getPlayerPropValues(sortedGames, prop)
  const calculate = (sample: number[], minimumGames = 0) => {
    if (!sample.length) return { hits: 0, games: 0, rate: null }
    const hits = sample.filter(value => value > line).length
    return { hits, games: sample.length, rate: sample.length < minimumGames ? null : Math.round(hits / sample.length * 100) }
  }
  return {
    last5: calculate(values.slice(0, 5), 5),
    last10: calculate(values.slice(0, 10), 10),
    last20: calculate(values.slice(0, 20), 20),
    season: calculate(values),
    average: values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)) : null,
  }
}
