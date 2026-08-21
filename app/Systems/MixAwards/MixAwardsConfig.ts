// Configuração da cerimônia de encerramento "Mix Awards 2° Season".

export const MIX_AWARDS_SEASON_ID = 2;
export const MIX_AWARDS_SEASON_LABEL = "2° SEASON";

// Data/hora em que os envelopes podem ser abertos no site (15/07 às 20h, horário de Brasília).
export const MIX_AWARDS_REVEAL_AT = "2026-07-15T20:00:00-03:00";

// Mínimo de partidas para concorrer em categorias de média (ADR, KDR, KAST...).
export const MIN_PARTIDAS_CATEGORIA = 10;

export type AwardMetric =
  | "pontos"
  | "winrate"
  | "adr"
  | "flash_assist"
  | "first_kill"
  | "multi_kill"
  | "kills"
  | "kdr"
  | "kast"
  | "partidas";

export interface AwardCategory {
  codigo: string;
  file: string; // FILE 001, FILE 002...
  titulo: string; // nome da categoria (REI DO ADR)
  descricao: string;
  metric: AwardMetric;
  // "avg" usa média por partida; "sum" usa total; "count" usa nº de partidas
  modo: "avg" | "sum" | "count";
  // título cosmético concedido ao vencedor
  tituloRecompensa: string;
}

export const AWARD_CATEGORIES: AwardCategory[] = [
  {
    codigo: "mvp_temporada",
    file: "AWARD 001",
    titulo: "MVP DA TEMPORADA",
    descricao: "Maior soma de pontos da temporada",
    metric: "pontos",
    modo: "sum",
    tituloRecompensa: "MVP DA TEMPORADA",
  },
  {
    codigo: "maior_winrate",
    file: "AWARD 002",
    titulo: "MAIOR WINRATE",
    descricao: "Melhor aproveitamento em vitórias",
    metric: "winrate",
    modo: "avg",
    tituloRecompensa: "MAIOR WINRATE",
  },
  {
    codigo: "maratonista",
    file: "AWARD 003",
    titulo: "MAIS PARTIDAS JOGADAS",
    descricao: "Quem mais apareceu para o mix",
    metric: "partidas",
    modo: "count",
    tituloRecompensa: "O MARATONISTA",
  },
  {
    codigo: "rei_do_adr",
    file: "AWARD 004",
    titulo: "REI DO ADR",
    descricao: "Maior dano médio por round",
    metric: "adr",
    modo: "avg",
    tituloRecompensa: "REI DO ADR",
  },
  {
    codigo: "exterminador",
    file: "AWARD 005",
    titulo: "O EXTERMINADOR",
    descricao: "Mais kills totais",
    metric: "kills",
    modo: "sum",
    tituloRecompensa: "O EXTERMINADOR",
  },
  {
    codigo: "flash_master",
    file: "AWARD 006",
    titulo: "FLASH MASTER",
    descricao: "Mais flash assists",
    metric: "flash_assist",
    modo: "sum",
    tituloRecompensa: "FLASH MASTER",
  },
  {
    codigo: "entry_king",
    file: "AWARD 007",
    titulo: "ENTRY KING",
    descricao: "Mais first kills",
    metric: "first_kill",
    modo: "sum",
    tituloRecompensa: "ENTRY KING",
  },
  {
    codigo: "mais_consistente",
    file: "AWARD 008",
    titulo: "O MAIS CONSISTENTE",
    descricao: "Maior KAST médio",
    metric: "kast",
    modo: "avg",
    tituloRecompensa: "O CONSISTENTE",
  },
];

export const categoriaCosmeticoCodigo = (codigo: string) =>
  `mixawards_cat_${codigo}_titulo`;
