
export type NBAPlayerGame = {
  date: string
  points: number
  rebounds: number
  assists: number
  threes: number
}

export function getPlayerPropValues(
  games: NBAPlayerGame[],
  prop: string
): number[] {
  return games.map((game) => {
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
