export type CategoryKey =
  | 'avgAdr'
  | 'avgKills'
  | 'avgDeaths'
  | 'avgAssists'
  | 'avgKdr'
  | 'avgFirstKill'
  | 'maxSingleScore'
  | 'bestWinrate'
  | 'worstWinrate'
  | 'top5RankingPoints'
  | 'top5FlashAssists'

export type PlayerItem = {
  id: number
  name: string
  nick: string
  photoUrl: string
  value: number
  rank: number
}

export type Category = {
  key: CategoryKey
  title: string
  hint?: string
  invert?: boolean
}

export const CATEGORIES: Category[] = [
  { key: 'avgAdr', title: 'Maior média de ADR por partida' },
  { key: 'avgKills', title: 'Maior média de Kills por partida' },
  { key: 'avgDeaths', title: 'Maior média de Mortes por partida' },
  { key: 'avgAssists', title: 'Maior média de Assistências por partida' },
  { key: 'avgKdr', title: 'Maior média de KDR por partida' },
  { key: 'avgFirstKill', title: 'Maior média de First Kill por partida' },
  { key: 'maxSingleScore', title: 'Maior pontuação feita em 1 partida' },
  { key: 'bestWinrate', title: 'Maior Winrate' },
  { key: 'worstWinrate', title: 'Pior Winrate' },
  { key: 'top5RankingPoints', title: 'Top 5 — Ranking de Maiores Pontos' },
  { key: 'top5FlashAssists', title: 'Top 5 Telas Brancas (Flash Assist)' },
]
