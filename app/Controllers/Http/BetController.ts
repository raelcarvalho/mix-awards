// Mix Bet: desativado por enquanto (feature não está em uso). Este controller
// não está registrado em nenhuma rota (start/routes.ts) e não é chamado por
// nada — mantido aqui só para reativação futura.
import { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import Database from "@ioc:Adonis/Lucid/Database";
import { DateTime } from "luxon";

import CustomResponse from "App/Utils/CustomResponse";
import Jogadores from "App/Models/Jogadores";
import BetService, { BetSelecao } from "App/Service/Bet/BetService";

const MAX_SELECOES = 10;
const MULTIPLICADOR_MAX = 10000;

export default class BetController {
  protected customResponse = new CustomResponse();

  private async jogadorDoUsuario(usuarioId: number) {
    return Jogadores.query().where("usuario_adm_id", usuarioId).first();
  }

  private parseJson<T>(raw: any, fallback: T): T {
    try {
      return JSON.parse(String(raw || "")) as T;
    } catch {
      return fallback;
    }
  }

  private secondsLeft(fechaEm: any): number {
    const fim = DateTime.fromJSDate(new Date(fechaEm));
    if (!fim.isValid) return 0;
    return Math.max(0, Math.ceil((fim.toMillis() - Date.now()) / 1000));
  }

  private serializeBet(bet: any, jogadorId: number | null) {
    const jogadores = this.parseJson<Array<{ jogador_id: number; time: string; nome: string }>>(
      bet.jogadores_json,
      []
    );
    const souParticipante = !!jogadorId && jogadores.some((j) => Number(j.jogador_id) === jogadorId);

    return {
      id: bet.id,
      codigo: bet.codigo,
      sessao_id: bet.sessao_id,
      mapa: bet.mapa,
      nome_time_a: bet.nome_time_a,
      nome_time_b: bet.nome_time_b,
      status: bet.status,
      abre_em: bet.abre_em,
      fecha_em: bet.fecha_em,
      segundos_restantes: bet.status === "aberta" ? this.secondsLeft(bet.fecha_em) : 0,
      sou_participante: souParticipante,
      odds: this.parseJson(bet.odds_json, null),
    };
  }

  private serializeAposta(aposta: any, bet?: any) {
    return {
      id: aposta.id,
      bet_partida_id: aposta.bet_partida_id,
      selecoes: this.parseJson<BetSelecao[]>(aposta.selecoes_json, []),
      resultado: this.parseJson<any[] | null>(aposta.resultado_json, null),
      multiplicador: Number(aposta.multiplicador),
      valor: Number(aposta.valor),
      retorno_potencial: Number(aposta.retorno_potencial),
      status: aposta.status,
      resgatada: !!aposta.resgatada,
      resgatada_em: aposta.resgatada_em,
      created_at: aposta.created_at,
      ...(bet
        ? {
            bet: {
              codigo: bet.codigo,
              mapa: bet.mapa,
              nome_time_a: bet.nome_time_a,
              nome_time_b: bet.nome_time_b,
              status: bet.status,
            },
          }
        : {}),
    };
  }

  /** Bet ativa (aberta ou aguardando resultado). Leitura barata: 2 lookups + JSON. */
  public async ativa({ auth, response }: HttpContextContract) {
    try {
      const user = await auth.authenticate();
      const jogador = await this.jogadorDoUsuario(user.id);

      let bet = await Database.from("tb_bet_partidas")
        .whereIn("status", ["aberta", "fechada"])
        .orderBy("id", "desc")
        .first();

      if (!bet) {
        return this.customResponse.sucesso(response, "Nenhuma bet ativa.", { bet: null, minhas_apostas: [] });
      }

      bet = await BetService.fecharSeExpirada(bet);

      const minhas = jogador
        ? await Database.from("tb_bet_apostas")
            .where("bet_partida_id", bet.id)
            .where("jogador_id", jogador.id)
            .orderBy("id", "desc")
        : [];

      return this.customResponse.sucesso(response, "Bet ativa.", {
        bet: this.serializeBet(bet, jogador?.id ?? null),
        minhas_apostas: minhas.map((a) => this.serializeAposta(a)),
        meu_gold: jogador?.gold ?? 0,
      });
    } catch (error) {
      return this.customResponse.erro(response, "Erro ao carregar bet ativa.", error, 500);
    }
  }

  /** Cria uma aposta. Recalcula odds pelo snapshot do servidor. */
  public async apostar({ auth, request, response }: HttpContextContract) {
    try {
      const user = await auth.authenticate();
      const jogador = await this.jogadorDoUsuario(user.id);
      if (!jogador) {
        return this.customResponse.erro(response, "Nenhum jogador vinculado ao usuário.", {}, 403);
      }

      const betId = Number(request.input("bet_id"));
      const valor = Math.floor(Number(request.input("valor")));
      const selecoesInput = request.input("selecoes");

      if (!betId || !Array.isArray(selecoesInput) || !selecoesInput.length) {
        return this.customResponse.erro(response, "Aposta inválida: informe bet_id e seleções.", {}, 400);
      }
      if (selecoesInput.length > MAX_SELECOES) {
        return this.customResponse.erro(response, `Máximo de ${MAX_SELECOES} seleções por aposta.`, {}, 400);
      }
      if (!Number.isFinite(valor) || valor <= 0) {
        return this.customResponse.erro(response, "Valor da aposta inválido.", {}, 400);
      }

      const resultado = await Database.transaction(async (trx) => {
        const bet = await trx.from("tb_bet_partidas").where("id", betId).forUpdate().first();
        if (!bet) throw { http: 404, msg: "Bet não encontrada." };

        const fim = DateTime.fromJSDate(new Date(bet.fecha_em));
        if (bet.status !== "aberta" || !fim.isValid || fim.toMillis() <= Date.now()) {
          throw { http: 409, msg: "A janela de apostas desta partida já foi encerrada." };
        }

        // Regra 1: quem está na partida não pode apostar
        const participantes = this.parseJson<Array<{ jogador_id: number }>>(bet.jogadores_json, []);
        if (participantes.some((p) => Number(p.jogador_id) === jogador.id)) {
          throw { http: 403, msg: "Jogadores da partida não podem apostar nela." };
        }

        const snapshot = this.parseJson<any>(bet.odds_json, null);
        if (!snapshot) throw { http: 500, msg: "Snapshot de odds indisponível." };

        // Valida seleções e resolve odds oficiais do snapshot
        const vistos = new Set<string>();
        const selecoes: BetSelecao[] = [];
        for (const raw of selecoesInput) {
          const sel = BetService.resolverOdd(snapshot, {
            categoria: String(raw?.categoria || "") as any,
            jogador_id: raw?.jogador_id ?? null,
            faixa: String(raw?.faixa || ""),
          });
          if (!sel) throw { http: 400, msg: "Seleção inválida para esta bet." };

          const chave = `${sel.categoria}:${sel.jogador_id ?? sel.time ?? "-"}`;
          if (vistos.has(chave)) {
            throw { http: 400, msg: "Só é permitida uma faixa por jogador em cada categoria." };
          }
          vistos.add(chave);
          selecoes.push(sel);
        }

        // Multiplicador acumulado: produto das odds de cada item selecionado
        const multiplicador = Math.min(
          selecoes.reduce((acc, s) => acc * s.odd, 1),
          MULTIPLICADOR_MAX
        );
        const multiplicadorFinal = Math.round(multiplicador * 100) / 100;
        const retorno = Math.floor(valor * multiplicadorFinal);

        // Debita o gold com checagem atômica (evita saldo negativo em corrida)
        const debit = await trx
          .from("tb_jogadores")
          .where("id", jogador.id)
          .where("gold", ">=", valor)
          .decrement("gold", valor);
        if (!debit) throw { http: 400, msg: "Gold insuficiente para esta aposta." };

        const inserted = await trx
          .table("tb_bet_apostas")
          .insert({
            bet_partida_id: bet.id,
            jogador_id: jogador.id,
            selecoes_json: JSON.stringify(selecoes),
            multiplicador: multiplicadorFinal,
            valor,
            retorno_potencial: retorno,
            status: "pendente",
            created_at: DateTime.now().toSQL(),
            updated_at: DateTime.now().toSQL(),
          })
          .returning("id");

        const saldoRow = await trx.from("tb_jogadores").where("id", jogador.id).select("gold").first();

        return {
          aposta_id: Array.isArray(inserted) ? inserted[0]?.id ?? inserted[0] : inserted,
          multiplicador: multiplicadorFinal,
          retorno_potencial: retorno,
          saldo_atual: Number(saldoRow?.gold ?? 0),
        };
      });

      return this.customResponse.sucesso(response, "Aposta registrada!", resultado);
    } catch (error: any) {
      if (error?.http) {
        return this.customResponse.erro(response, error.msg, {}, error.http);
      }
      return this.customResponse.erro(response, "Erro ao registrar aposta.", error, 500);
    }
  }

  /** Histórico de apostas do jogador logado (com resultado por seleção). */
  public async minhas({ auth, response }: HttpContextContract) {
    try {
      const user = await auth.authenticate();
      const jogador = await this.jogadorDoUsuario(user.id);
      if (!jogador) {
        return this.customResponse.sucesso(response, "Sem jogador vinculado.", { apostas: [] });
      }

      const rows = await Database.from("tb_bet_apostas as a")
        .innerJoin("tb_bet_partidas as b", "b.id", "a.bet_partida_id")
        .where("a.jogador_id", jogador.id)
        .orderBy("a.id", "desc")
        .limit(50)
        .select(
          "a.*",
          "b.codigo as bet_codigo",
          "b.mapa as bet_mapa",
          "b.nome_time_a as bet_nome_time_a",
          "b.nome_time_b as bet_nome_time_b",
          "b.status as bet_status"
        );

      const apostas = rows.map((r: any) =>
        this.serializeAposta(r, {
          codigo: r.bet_codigo,
          mapa: r.bet_mapa,
          nome_time_a: r.bet_nome_time_a,
          nome_time_b: r.bet_nome_time_b,
          status: r.bet_status,
        })
      );

      return this.customResponse.sucesso(response, "Minhas apostas.", { apostas });
    } catch (error) {
      return this.customResponse.erro(response, "Erro ao listar apostas.", error, 500);
    }
  }

  /** Regra 4: resgatar o gold de uma aposta ganha. */
  public async resgatar({ auth, params, response }: HttpContextContract) {
    try {
      const user = await auth.authenticate();
      const jogador = await this.jogadorDoUsuario(user.id);
      if (!jogador) {
        return this.customResponse.erro(response, "Nenhum jogador vinculado ao usuário.", {}, 403);
      }

      const apostaId = Number(params.id);

      const resultado = await Database.transaction(async (trx) => {
        const aposta = await trx.from("tb_bet_apostas").where("id", apostaId).forUpdate().first();
        if (!aposta || Number(aposta.jogador_id) !== jogador.id) {
          throw { http: 404, msg: "Aposta não encontrada." };
        }
        if (aposta.status !== "ganha") throw { http: 409, msg: "Esta aposta não foi vencedora." };
        if (aposta.resgatada) throw { http: 409, msg: "Esta aposta já foi resgatada." };

        const premio = Number(aposta.retorno_potencial || 0);

        await trx.from("tb_bet_apostas").where("id", aposta.id).update({
          resgatada: true,
          resgatada_em: DateTime.now().toSQL(),
          updated_at: DateTime.now().toSQL(),
        });
        await trx.from("tb_jogadores").where("id", jogador.id).increment("gold", premio);

        const saldoRow = await trx.from("tb_jogadores").where("id", jogador.id).select("gold").first();
        return { premio, saldo_atual: Number(saldoRow?.gold ?? 0) };
      });

      return this.customResponse.sucesso(response, "Gold resgatado!", resultado);
    } catch (error: any) {
      if (error?.http) {
        return this.customResponse.erro(response, error.msg, {}, error.http);
      }
      return this.customResponse.erro(response, "Erro ao resgatar gold.", error, 500);
    }
  }
}
