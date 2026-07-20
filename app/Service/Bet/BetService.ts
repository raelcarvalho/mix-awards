// Mix Bet: desativado por enquanto (feature não está em uso). A chamada que
// acionava este serviço (TirarMixController.startMapVetoStage) está comentada
// — mantido aqui só para reativação futura.
import Database from "@ioc:Adonis/Lucid/Database";
import { DateTime } from "luxon";

import BetOddsService, { BetOddsSnapshot } from "App/Service/Bet/BetOddsService";

export type BetCategoria =
  | "kills"
  | "mortes"
  | "assistencias"
  | "multi_kills"
  | "first_kills"
  | "rounds"
  | "vitoria";

export type BetSelecao = {
  categoria: BetCategoria;
  jogador_id: number | null;
  jogador_nome: string | null;
  time: "A" | "B" | null;
  faixa: string;
  odd: number;
};

// Janela de apostas: 2 minutos após o término do veto de mapas.
const JANELA_APOSTAS_SEGUNDOS = 120;

export default class BetService {
  private static nowSql() {
    return DateTime.now().toSQL();
  }

  /**
   * Cria a bet da partida assim que o veto de mapas termina.
   * Gera o ID público (codigo), calcula o snapshot de odds uma única vez
   * e abre a janela de 2 minutos para apostas.
   */
  public static async criarParaSessao(sessaoId: number, mapa: string, trx?: any) {
    const db = trx || Database;

    const existente = await db.from("tb_bet_partidas").where("sessao_id", sessaoId).first();
    if (existente) return existente;

    const sessao = await db.from("tb_tirar_mix_sessoes").where("id", sessaoId).first();
    if (!sessao) return null;

    const players = (await db
      .from("tb_tirar_mix_players as sp")
      .innerJoin("tb_jogadores as j", "j.id", "sp.jogador_id")
      .where("sp.sessao_id", sessaoId)
      .where("sp.is_selecionado", true)
      .whereNotNull("sp.time")
      .select("sp.jogador_id", "sp.time", "j.nome", "j.imagem")) as Array<{
      jogador_id: number;
      time: "A" | "B";
      nome: string;
      imagem: string | null;
    }>;

    if (!players.length) return null;

    const capNome = async (id: number | null) => {
      if (!id) return null;
      const p = players.find((x) => x.jogador_id === id);
      return p?.nome || null;
    };

    const nomeCapA = (await capNome(sessao.time_a_capitao_id)) || "Capitão A";
    const nomeCapB = (await capNome(sessao.time_b_capitao_id)) || "Capitão B";
    const nomeTimeA = `Time ${nomeCapA}`;
    const nomeTimeB = `Time ${nomeCapB}`;

    const snapshot = await BetOddsService.buildSnapshot(
      players.map((p) => ({
        jogador_id: p.jogador_id,
        nome: p.nome,
        imagem: p.imagem,
        time: p.time,
      })),
      sessao.time_a_capitao_id || null,
      sessao.time_b_capitao_id || null,
      nomeTimeA,
      nomeTimeB,
      trx
    );

    const codigo = `MIX-${sessaoId}-${Date.now().toString(36).toUpperCase()}`;
    const agora = DateTime.now();

    const inserted = await db
      .table("tb_bet_partidas")
      .insert({
        codigo,
        sessao_id: sessaoId,
        mapa,
        time_a_capitao_id: sessao.time_a_capitao_id || null,
        time_b_capitao_id: sessao.time_b_capitao_id || null,
        nome_time_a: nomeTimeA,
        nome_time_b: nomeTimeB,
        status: "aberta",
        abre_em: agora.toSQL(),
        fecha_em: agora.plus({ seconds: JANELA_APOSTAS_SEGUNDOS }).toSQL(),
        odds_json: JSON.stringify(snapshot),
        jogadores_json: JSON.stringify(
          players.map((p) => ({ jogador_id: p.jogador_id, time: p.time, nome: p.nome }))
        ),
        created_at: this.nowSql(),
        updated_at: this.nowSql(),
      })
      .returning("id");

    return { id: Array.isArray(inserted) ? inserted[0]?.id ?? inserted[0] : inserted, codigo };
  }

  /** Fecha a janela de apostas se o prazo de 2 minutos já passou. */
  public static async fecharSeExpirada(bet: any) {
    if (!bet || bet.status !== "aberta") return bet;
    const fim = DateTime.fromJSDate(new Date(bet.fecha_em));
    if (fim.isValid && fim.toMillis() <= Date.now()) {
      await Database.from("tb_bet_partidas").where("id", bet.id).where("status", "aberta").update({
        status: "fechada",
        updated_at: this.nowSql(),
      });
      bet.status = "fechada";
    }
    return bet;
  }

  /** Valida uma seleção contra o snapshot e devolve a odd oficial (nunca confia no client). */
  public static resolverOdd(snapshot: BetOddsSnapshot, sel: {
    categoria: BetCategoria;
    jogador_id?: number | null;
    faixa: string;
  }): BetSelecao | null {
    if (sel.categoria === "rounds") {
      const f = snapshot.rounds.find((r) => r.faixa === sel.faixa);
      if (!f) return null;
      return { categoria: "rounds", jogador_id: null, jogador_nome: null, time: null, faixa: f.faixa, odd: f.odd };
    }

    if (sel.categoria === "vitoria") {
      const v = snapshot.vitoria.find((t) => t.time === sel.faixa || t.nome === sel.faixa);
      if (!v) return null;
      return { categoria: "vitoria", jogador_id: null, jogador_nome: null, time: v.time, faixa: v.nome, odd: v.odd };
    }

    const player = snapshot.jogadores.find((j) => j.jogador_id === Number(sel.jogador_id));
    if (!player) return null;
    const faixas = (player as any)[sel.categoria];
    if (!Array.isArray(faixas)) return null;
    const f = faixas.find((x: any) => x.faixa === sel.faixa);
    if (!f) return null;

    return {
      categoria: sel.categoria,
      jogador_id: player.jogador_id,
      jogador_nome: player.nome,
      time: player.time,
      faixa: f.faixa,
      odd: f.odd,
    };
  }

  /**
   * Liquidação: chamada quando o admin importa a partida.
   * Encontra a bet cujos jogadores batem com os da partida importada,
   * avalia cada seleção e marca cada aposta como ganha/perdida
   * (só ganha se TODAS as seleções acertarem).
   */
  public static async liquidarPorPartida(partidaId: number) {
    const partida = await Database.from("tb_partidas").where("id", partidaId).first();
    if (!partida) return null;

    const statsRows = (await Database.from("tb_partidas_jogadores")
      .where("partidas_id", partidaId)
      .select("jogadores_id", "kills", "mortes", "assistencias", "multi_kill", "first_kill", "time", "partida_ganha")) as any[];
    if (!statsRows.length) return null;

    const idsPartida = new Set(statsRows.map((r) => Number(r.jogadores_id)));

    // Bets pendentes são poucas (uma por sessão de mix) — varre e casa pelo elenco.
    const pendentes = await Database.from("tb_bet_partidas")
      .whereIn("status", ["aberta", "fechada"])
      .orderBy("id", "desc")
      .limit(20);

    let bet: any = null;
    for (const b of pendentes) {
      try {
        const jogadores = JSON.parse(b.jogadores_json || "[]") as Array<{ jogador_id: number }>;
        const overlap = jogadores.filter((j) => idsPartida.has(Number(j.jogador_id))).length;
        if (jogadores.length > 0 && overlap >= Math.min(8, jogadores.length)) {
          bet = b;
          break;
        }
      } catch {}
    }
    if (!bet) return null;

    const jogadoresBet = JSON.parse(bet.jogadores_json || "[]") as Array<{
      jogador_id: number;
      time: "A" | "B";
    }>;
    const statsById = new Map<number, any>(statsRows.map((r) => [Number(r.jogadores_id), r]));

    // Descobre qual time (A/B) da bet venceu, ancorando nos jogadores do time A
    const totalRounds = Number(partida.resultado_time1 || 0) + Number(partida.resultado_time2 || 0);
    let vencedorBet: "A" | "B" | null = null;
    for (const j of jogadoresBet) {
      const s = statsById.get(Number(j.jogador_id));
      if (!s) continue;
      const ganhou = s.partida_ganha === true || s.partida_ganha === 1 || s.partida_ganha === "1";
      if (Number(partida.resultado_time1) !== Number(partida.resultado_time2)) {
        vencedorBet = ganhou ? j.time : j.time === "A" ? "B" : "A";
        break;
      }
    }

    const dentro = (valor: number, min: number, max: number | null) =>
      valor >= min && (max === null || valor <= max);

    const faixaDe = (categoria: string, faixa: string) => {
      const defs = (BetOddsService.FAIXAS as any)[categoria] as Array<{
        faixa: string;
        min: number;
        max: number | null;
      }>;
      return defs?.find((d) => d.faixa === faixa) || null;
    };

    const campoPorCategoria: Record<string, string> = {
      kills: "kills",
      mortes: "mortes",
      assistencias: "assistencias",
      multi_kills: "multi_kill",
      first_kills: "first_kill",
    };

    const apostas = await Database.from("tb_bet_apostas")
      .where("bet_partida_id", bet.id)
      .where("status", "pendente");

    for (const aposta of apostas) {
      let selecoes: BetSelecao[] = [];
      try {
        selecoes = JSON.parse(aposta.selecoes_json || "[]");
      } catch {}

      const resultado = selecoes.map((sel) => {
        let acertou = false;
        let valorReal: number | null = null;

        if (sel.categoria === "rounds") {
          valorReal = totalRounds;
          const def = faixaDe("rounds", sel.faixa);
          acertou = !!def && dentro(totalRounds, def.min, def.max);
        } else if (sel.categoria === "vitoria") {
          acertou = !!sel.time && vencedorBet === sel.time;
          valorReal = null;
        } else {
          const s = sel.jogador_id ? statsById.get(Number(sel.jogador_id)) : null;
          const campo = campoPorCategoria[sel.categoria];
          if (s && campo) {
            valorReal = Number(s[campo] || 0);
            const def = faixaDe(sel.categoria, sel.faixa);
            acertou = !!def && dentro(valorReal, def.min, def.max);
          }
        }

        return { ...sel, acertou, valor_real: valorReal };
      });

      const ganhou = resultado.length > 0 && resultado.every((r) => r.acertou);

      await Database.from("tb_bet_apostas").where("id", aposta.id).update({
        status: ganhou ? "ganha" : "perdida",
        resultado_json: JSON.stringify(resultado),
        updated_at: this.nowSql(),
      });
    }

    await Database.from("tb_bet_partidas").where("id", bet.id).update({
      status: "liquidada",
      partida_id: partidaId,
      liquidada_em: this.nowSql(),
      updated_at: this.nowSql(),
    });

    return { bet_id: bet.id, apostas: apostas.length };
  }
}
