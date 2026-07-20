// Mix Bet: desativado por enquanto (feature não está em uso), usado apenas
// por BetService — mantido aqui só para reativação futura.
import Database from "@ioc:Adonis/Lucid/Database";

export type BetFaixa = { faixa: string; min: number; max: number | null; odd: number };

export type BetPlayerOdds = {
  jogador_id: number;
  nome: string;
  imagem: string | null;
  time: "A" | "B";
  media_kills: number;
  media_mortes: number;
  media_assistencias: number;
  media_multi_kills: number;
  media_first_kills: number;
  partidas: number;
  kills: BetFaixa[];
  mortes: BetFaixa[];
  assistencias: BetFaixa[];
  multi_kills: BetFaixa[];
  first_kills: BetFaixa[];
};

export type BetOddsSnapshot = {
  jogadores: BetPlayerOdds[];
  rounds: BetFaixa[];
  vitoria: Array<{ time: "A" | "B"; nome: string; capitao_id: number | null; odd: number }>;
};

type FaixaDef = { faixa: string; min: number; max: number | null };

const FAIXAS_KILLS: FaixaDef[] = [
  { faixa: "0 - 5", min: 0, max: 5 },
  { faixa: "6 - 10", min: 6, max: 10 },
  { faixa: "11 - 15", min: 11, max: 15 },
  { faixa: "16 - 20", min: 16, max: 20 },
  { faixa: "21 - 25", min: 21, max: 25 },
  { faixa: "25+", min: 26, max: null },
];

const FAIXAS_MORTES = FAIXAS_KILLS;

const FAIXAS_ASSISTENCIAS: FaixaDef[] = [
  { faixa: "0 - 4", min: 0, max: 4 },
  { faixa: "5 - 7", min: 5, max: 7 },
  { faixa: "8 - 11", min: 8, max: 11 },
  { faixa: "12 - 14", min: 12, max: 14 },
  { faixa: "15+", min: 15, max: null },
];

const FAIXAS_MULTI_KILLS: FaixaDef[] = [
  { faixa: "0 - 4", min: 0, max: 4 },
  { faixa: "5 - 7", min: 5, max: 7 },
  { faixa: "8 - 11", min: 8, max: 11 },
  { faixa: "12+", min: 12, max: null },
];

const FAIXAS_FIRST_KILLS: FaixaDef[] = [
  { faixa: "0 - 1", min: 0, max: 1 },
  { faixa: "2 - 3", min: 2, max: 3 },
  { faixa: "4 - 5", min: 4, max: 5 },
  { faixa: "6+", min: 6, max: null },
];

const FAIXAS_ROUNDS: FaixaDef[] = [
  { faixa: "15r - 18r", min: 15, max: 18 },
  { faixa: "19r - 22r", min: 19, max: 22 },
  { faixa: "23r - 26r", min: 23, max: 26 },
  { faixa: "27r+", min: 27, max: null },
];

// Margem da casa: reduz o payout implícito (1/p) para o site nunca pagar odd "justa".
const MARGEM = 0.92;
const ODD_MIN = 1.01;
const ODD_MAX = 500;

export default class BetOddsService {
  public static FAIXAS = {
    kills: FAIXAS_KILLS,
    mortes: FAIXAS_MORTES,
    assistencias: FAIXAS_ASSISTENCIAS,
    multi_kills: FAIXAS_MULTI_KILLS,
    first_kills: FAIXAS_FIRST_KILLS,
    rounds: FAIXAS_ROUNDS,
  };

  /**
   * Distribui probabilidade entre as faixas a partir da média histórica do
   * jogador: a faixa que contém a média concentra a maior massa e as demais
   * decaem com a distância (decaimento quadrático). Odd = (1/p) * margem.
   */
  private static oddsFromMedia(faixas: FaixaDef[], media: number): BetFaixa[] {
    const centros = faixas.map((f) => {
      if (f.max === null) return f.min + 2;
      return (f.min + f.max) / 2;
    });
    const larguraMedia =
      faixas.length > 1 ? Math.max(1, (centros[centros.length - 1] - centros[0]) / (faixas.length - 1)) : 1;

    const pesos = centros.map((c) => {
      const dist = Math.abs(c - media) / larguraMedia;
      return 1 / Math.pow(1 + dist, 2.2);
    });
    const soma = pesos.reduce((a, b) => a + b, 0) || 1;

    return faixas.map((f, i) => {
      const p = Math.max(pesos[i] / soma, 0.0001);
      const odd = Math.min(Math.max((1 / p) * MARGEM, ODD_MIN), ODD_MAX);
      return { faixa: f.faixa, min: f.min, max: f.max, odd: Math.round(odd * 100) / 100 };
    });
  }

  /**
   * Monta o snapshot completo de odds para os jogadores informados.
   * Custo fixo: 2 queries agregadas (stats dos jogadores + média de rounds),
   * independente do número de apostadores — o resultado vira JSON imutável.
   */
  public static async buildSnapshot(
    jogadores: Array<{ jogador_id: number; nome: string; imagem: string | null; time: "A" | "B" }>,
    capitaoAId: number | null,
    capitaoBId: number | null,
    nomeTimeA: string,
    nomeTimeB: string,
    trx?: any
  ): Promise<BetOddsSnapshot> {
    const db = trx || Database;
    const ids = jogadores.map((j) => j.jogador_id);

    // 1 query: médias históricas dos 10 jogadores (agregado no banco, sem trazer linhas)
    const stats = ids.length
      ? await db
          .from("tb_partidas_jogadores")
          .whereIn("jogadores_id", ids)
          .groupBy("jogadores_id")
          .select("jogadores_id")
          .count("* as partidas")
          .avg("kills as media_kills")
          .avg("mortes as media_mortes")
          .avg("assistencias as media_assistencias")
          .avg("multi_kill as media_multi_kills")
          .avg("first_kill as media_first_kills")
      : [];

    const statsById = new Map<number, any>(stats.map((s: any) => [Number(s.jogadores_id), s]));

    // 1 query: média global de rounds das últimas 50 partidas
    const roundsRow = await db
      .from(
        db
          .from("tb_partidas")
          .select(Database.raw("(resultado_time1 + resultado_time2) as total_rounds"))
          .orderBy("id", "desc")
          .limit(50)
          .as("ultimas")
      )
      .avg("total_rounds as media_rounds")
      .first();
    const mediaRounds = Number(roundsRow?.media_rounds || 22);

    const num = (v: any, fallback: number) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : fallback;
    };

    const playersOdds: BetPlayerOdds[] = jogadores.map((j) => {
      const s = statsById.get(j.jogador_id);
      const mediaKills = num(s?.media_kills, 12);
      const mediaMortes = num(s?.media_mortes, 14);
      const mediaAssist = num(s?.media_assistencias, 4);
      const mediaMulti = num(s?.media_multi_kills, 3);
      const mediaFirst = num(s?.media_first_kills, 2);

      return {
        jogador_id: j.jogador_id,
        nome: j.nome,
        imagem: j.imagem,
        time: j.time,
        media_kills: Math.round(mediaKills * 10) / 10,
        media_mortes: Math.round(mediaMortes * 10) / 10,
        media_assistencias: Math.round(mediaAssist * 10) / 10,
        media_multi_kills: Math.round(mediaMulti * 10) / 10,
        media_first_kills: Math.round(mediaFirst * 10) / 10,
        partidas: Number(s?.partidas || 0),
        kills: this.oddsFromMedia(FAIXAS_KILLS, mediaKills),
        mortes: this.oddsFromMedia(FAIXAS_MORTES, mediaMortes),
        assistencias: this.oddsFromMedia(FAIXAS_ASSISTENCIAS, mediaAssist),
        multi_kills: this.oddsFromMedia(FAIXAS_MULTI_KILLS, mediaMulti),
        first_kills: this.oddsFromMedia(FAIXAS_FIRST_KILLS, mediaFirst),
      };
    });

    // Vitória: força relativa dos times pela média de kills dos jogadores
    const forca = (time: "A" | "B") => {
      const doTime = playersOdds.filter((p) => p.time === time);
      if (!doTime.length) return 1;
      return doTime.reduce((acc, p) => acc + p.media_kills, 0) / doTime.length;
    };
    const forcaA = forca("A");
    const forcaB = forca("B");
    const pA = forcaA / (forcaA + forcaB || 1);
    const oddTime = (p: number) =>
      Math.round(Math.min(Math.max((1 / Math.max(p, 0.02)) * MARGEM, ODD_MIN), ODD_MAX) * 100) / 100;

    return {
      jogadores: playersOdds,
      rounds: this.oddsFromMedia(FAIXAS_ROUNDS, mediaRounds),
      vitoria: [
        { time: "A", nome: nomeTimeA, capitao_id: capitaoAId, odd: oddTime(pA) },
        { time: "B", nome: nomeTimeB, capitao_id: capitaoBId, odd: oddTime(1 - pA) },
      ],
    };
  }
}
