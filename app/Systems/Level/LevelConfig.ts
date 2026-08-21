// app/Systems/Level/LevelConfig.ts

export interface LevelDefinition {
  level: number
  nome: string
  tier: "newba" | "coitado" | "iniciante" | "nexus" | "bronze" | "prata" | "ouro" | "platina" | "esmeralda" | "diamante" | "elite" | "fantasma" | "tempestade" | "inferno" | "celestial" | "lendário"
  pts_inicio: number
  pts_para_proximo: number | null
}

export const LEVELS: LevelDefinition[] = [
  { level: 0, nome: "Newba", tier: "newba", pts_inicio: 0, pts_para_proximo: 100 },
  { level: 1, nome: "Coitado", tier: "coitado", pts_inicio: 100, pts_para_proximo: 100 },
  { level: 2, nome: "Iniciante", tier: "iniciante", pts_inicio: 200, pts_para_proximo: 100 },
  { level: 3, nome: "Nexus", tier: "nexus", pts_inicio: 300, pts_para_proximo: 100 },
  { level: 4, nome: "Bronze", tier: "bronze", pts_inicio: 400, pts_para_proximo: 100 },
  { level: 5, nome: "Prata", tier: "prata", pts_inicio: 500, pts_para_proximo: 100 },
  { level: 6, nome: "Ouro", tier: "ouro", pts_inicio: 600, pts_para_proximo: 100 },
  { level: 7, nome: "Platina", tier: "platina", pts_inicio: 700, pts_para_proximo: 100 },
  { level: 8, nome: "Esmeralda", tier: "esmeralda", pts_inicio: 800, pts_para_proximo: 100 },
  { level: 9, nome: "Diamante", tier: "diamante", pts_inicio: 900, pts_para_proximo: 100 },
  { level: 10, nome: "Elite", tier: "elite", pts_inicio: 1000, pts_para_proximo: 100 },
  { level: 11, nome: "Fantasma", tier: "fantasma", pts_inicio: 1100, pts_para_proximo: 100 },
  { level: 12, nome: "Tempestade", tier: "tempestade", pts_inicio: 1200, pts_para_proximo: 100 },
  { level: 13, nome: "Inferno", tier: "inferno", pts_inicio: 1300, pts_para_proximo: 100 },
  { level: 14, nome: "Celestial", tier: "celestial", pts_inicio: 1400, pts_para_proximo: 200 },
  { level: 15, nome: "Lendário", tier: "lendário", pts_inicio: 1600, pts_para_proximo: null },
]

export const GANHO_MAX = 20
export const PERDA_MAX = 20
export const PONTOS_MIN = 0

export const BASE_VITORIA = 10
export const BASE_DERROTA = -8

export const ADR_BONUS = [
  { min: 120, bonus: 4 },
  { min: 95, bonus: 2 },
  { min: 70, bonus: 0 },
  { min: 50, bonus: -2 },
  { min: 0, bonus: -4 },
]

export const KDA_BONUS = [
  { min: 2.0, bonus: 2 },
  { min: 1.3, bonus: 1 },
  { min: 0.9, bonus: 0 },
  { min: 0.6, bonus: -1 },
  { min: 0, bonus: -2 },
]

export const FATORES_NIVEL = [
  { diff_min: 3, fator: 1.3 },
  { diff_min: 1, fator: 1.15 },
  { diff_min: 0, fator: 1.0 },
  { diff_min: -2, fator: 0.87 },
  { diff_min: -99, fator: 0.7 },
]
