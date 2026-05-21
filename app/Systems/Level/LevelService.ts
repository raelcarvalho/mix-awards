// app/Systems/Level/LevelService.ts

import {
  ADR_BONUS,
  BASE_DERROTA,
  BASE_VITORIA,
  FATORES_NIVEL,
  GANHO_MAX,
  KDA_BONUS,
  LEVELS,
  PERDA_MAX,
  PONTOS_MIN,
  type LevelDefinition,
} from "./LevelConfig"

export interface DesempenhoJogador {
  kills: number
  deaths: number
  assists: number
  adr: number
  partida_ganha: boolean
}

export interface ContextoPartida {
  meu_level: number
  nivel_medio_adversarios: number
}

export interface ResultadoPontos {
  base: number
  bonus_adr: number
  bonus_kda: number
  fator_nivel: number
  pontos_ganhos: number
  capped: boolean
  pontos_antes: number
  pontos_depois: number
  level_antes: LevelDefinition
  level_depois: LevelDefinition
  subiu_level: boolean
  desceu_level: boolean
  descricao: string[]
}

function calcKDA(kills: number, deaths: number, assists: number): number {
  return Number(((kills + assists * 0.5) / Math.max(1, deaths)).toFixed(2))
}

function getBonusADR(adr: number): number {
  for (const regra of ADR_BONUS) {
    if (adr >= regra.min) return regra.bonus
  }
  return ADR_BONUS[ADR_BONUS.length - 1].bonus
}

function getBonusKDA(kda: number): number {
  for (const regra of KDA_BONUS) {
    if (kda >= regra.min) return regra.bonus
  }
  return KDA_BONUS[KDA_BONUS.length - 1].bonus
}

function getFatorNivel(meuLevel: number, nivelAdversario: number): number {
  const diff = nivelAdversario - meuLevel
  for (const regra of FATORES_NIVEL) {
    if (diff >= regra.diff_min) return regra.fator
  }
  return FATORES_NIVEL[FATORES_NIVEL.length - 1].fator
}

function clamp(valor: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, valor))
}

export class LevelService {
  static getLevelPorPontos(pontos: number): LevelDefinition {
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      if (pontos >= LEVELS[i].pts_inicio) return LEVELS[i]
    }
    return LEVELS[0]
  }

  static getLevelPorNumero(level: number): LevelDefinition {
    const found = LEVELS.find((l) => l.level === level)
    if (!found) throw new Error(`Level ${level} não existe no sistema`)
    return found
  }

  static getProgressoLevel(pontos: number): {
    pontos_no_level: number
    pontos_para_proximo: number | null
    percentual: number
  } {
    const lvl = this.getLevelPorPontos(pontos)
    const pontos_no_level = pontos - lvl.pts_inicio
    if (lvl.pts_para_proximo === null) {
      return { pontos_no_level, pontos_para_proximo: null, percentual: 100 }
    }
    const percentual = Math.min(
      100,
      Math.round((pontos_no_level / lvl.pts_para_proximo) * 100)
    )
    return { pontos_no_level, pontos_para_proximo: lvl.pts_para_proximo, percentual }
  }

  static calcularPontos(
    desempenho: DesempenhoJogador,
    contexto: ContextoPartida,
    pontos_atuais: number
  ): ResultadoPontos {
    const descricao: string[] = []

    const base = desempenho.partida_ganha ? BASE_VITORIA : BASE_DERROTA
    descricao.push(
      desempenho.partida_ganha
        ? `Vitória: ${base > 0 ? "+" : ""}${base} pts`
        : `Derrota: ${base} pts`
    )

    const bonus_adr = getBonusADR(desempenho.adr)
    descricao.push(
      `ADR ${desempenho.adr.toFixed(1)}: ${bonus_adr >= 0 ? "+" : ""}${bonus_adr} pts`
    )

    const kda = calcKDA(desempenho.kills, desempenho.deaths, desempenho.assists)
    const bonus_kda = getBonusKDA(kda)
    descricao.push(`KDA ${kda}: ${bonus_kda >= 0 ? "+" : ""}${bonus_kda} pts`)

    const fator_nivel = getFatorNivel(
      contexto.meu_level,
      contexto.nivel_medio_adversarios
    )
    const diff = contexto.nivel_medio_adversarios - contexto.meu_level
    const fatorLabel =
      diff > 0
        ? `adversário ${diff} lvl(s) acima`
        : diff < 0
        ? `adversário ${Math.abs(diff)} lvl(s) abaixo`
        : "mesmo nível"
    descricao.push(`Fator adversário (${fatorLabel}): ×${fator_nivel}`)

    const soma_base = base + bonus_adr + bonus_kda
    const bruto = Math.round(soma_base * fator_nivel)
    const pontos_ganhos = clamp(bruto, -PERDA_MAX, GANHO_MAX)
    const capped = bruto !== pontos_ganhos

    if (capped) {
      descricao.push(
        `Limitado ao cap de ${
          pontos_ganhos > 0 ? "+" : ""
        }${pontos_ganhos} pts (bruto seria ${bruto > 0 ? "+" : ""}${bruto})`
      )
    }

    const pontos_antes = pontos_atuais
    const pontos_depois = Math.max(PONTOS_MIN, pontos_atuais + pontos_ganhos)

    const level_antes = this.getLevelPorPontos(pontos_antes)
    const level_depois = this.getLevelPorPontos(pontos_depois)
    const subiu_level = level_depois.level > level_antes.level
    const desceu_level = level_depois.level < level_antes.level

    if (subiu_level) {
      descricao.push(`🎉 Subiu para ${level_depois.nome} (Lvl ${level_depois.level})!`)
    } else if (desceu_level) {
      descricao.push(`📉 Desceu para ${level_depois.nome} (Lvl ${level_depois.level})`)
    }

    return {
      base,
      bonus_adr,
      bonus_kda,
      fator_nivel,
      pontos_ganhos,
      capped,
      pontos_antes,
      pontos_depois,
      level_antes,
      level_depois,
      subiu_level,
      desceu_level,
      descricao,
    }
  }

  static calcularNivelMedioTime(levels: number[]): number {
    if (levels.length === 0) return 0
    const soma = levels.reduce((acc, l) => acc + l, 0)
    return Math.round(soma / levels.length)
  }

  static listarLevels(): LevelDefinition[] {
    return LEVELS
  }
}
