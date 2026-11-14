
export type NBAPlayerGame = {
  date: string
  points: number
  rebounds: number
  assists: number
  threes: number
  gameId?: string
  team?: string
  opponent?: string
  homeAway?: 'home' | 'away'
}

function isValidNBAPlayerGame(game: NBAPlayerGame): boolean {
  return [game.points, game.rebounds, game.assists, game.threes]
    .every(value => Number.isFinite(value) && value >= 0)
}

export function getPlayerPropValues(
  games: NBAPlayerGame[],
  prop: string
): number[] {
  return games.filter(isValidNBAPlayerGame).map((game) => {
    if (prop === 'Points') return game.points
    if (prop === 'Rebounds') return game.rebounds
    if (prop === 'Assists') return game.assists
    if (prop === '3-Pointers Made') return game.threes
    if (prop === 'PRA') {
      return game.points + game.rebounds + game.assists
    }
    return 0
  })
}

export function calculateNBAHitRates(
  games: NBAPlayerGame[],
  prop: string,
  line: number
) {
  const sortedGames = [...games].sort(
    (a, b) =>
      new Date(b.date).getTime() -
      new Date(a.date).getTime()
  )

  const values = getPlayerPropValues(sortedGames, prop)

  const calculate = (sample: number[], minimumGames = 0) => {
    if (sample.length === 0) {
      return { hits: 0, games: 0, rate: null }
    }

    const hits = sample.filter(value => value > line).length

    return {
      hits,
      games: sample.length,
      rate: sample.length < minimumGames ? null : Math.round((hits / sample.length) * 100)
    }
  }

  return {
    last5: calculate(values.slice(0, 5), 5),
    last10: calculate(values.slice(0, 10), 10),
    last20: calculate(values.slice(0, 20), 20),
    season: calculate(values),
    average:
      values.length > 0
        ? Number(
            (values.reduce((a, b) => a + b, 0) /
              values.length).toFixed(1)
          )
        : null
  }
}
