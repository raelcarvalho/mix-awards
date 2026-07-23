import { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import Jogadores from "App/Models/Jogadores";
import UsuarioAdm from "App/Models/UsuarioAdm";
import CustomResponse from "App/Utils/CustomResponse";
import { LevelService } from "App/Systems/Level/LevelService";
import Database from "@ioc:Adonis/Lucid/Database";
import { DateTime } from "luxon";

function normalizeName(raw: string): string {
  return (raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export default class JogadoresController {
  protected customResponse: CustomResponse;
  private readonly DEFAULT_SEASON_ID = 2;
  private readonly SEASON_TWO_START_DATE = "2026-05-25";

  constructor() {
    this.customResponse = new CustomResponse();
  }

  private parseSeasonId(raw: any): number {
    const n = Number(raw);
    if (n === 1 || n === 2) return n;
    return this.DEFAULT_SEASON_ID;
  }

  /**
   * Bônus de marco por nº de partidas, acumulado e POR TEMPORADA. Cada marco
   * alcançado dentro da temporada credita uma vez no total daquela temporada.
   */
  private seasonMilestoneBonus(qtdPartidas: number): number {
    let bonus = 0;
    if (qtdPartidas >= 15) bonus += 20;
    if (qtdPartidas >= 20) bonus += 30;
    if (qtdPartidas >= 30) bonus += 40;
    if (qtdPartidas >= 40) bonus += 50;
    if (qtdPartidas >= 50) bonus += 60;
    if (qtdPartidas >= 60) bonus += 70;
    return bonus;
  }

  private parseMonthKey(raw: any): string | null {
    const month = String(raw || "")
      .trim()
      .toLowerCase();
    if (!month || month === "all" || month === "todos") return null;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
    return month;
  }

  private getMonthRange(monthKey: string): { start: string; endExclusive: string } {
    const start = DateTime.fromISO(`${monthKey}-01`, { zone: "utc" });
    if (!start.isValid) {
      return { start: `${monthKey}-01`, endExclusive: `${monthKey}-31` };
    }
    return {
      start: start.toISODate() || `${monthKey}-01`,
      endExclusive: start.plus({ months: 1 }).toISODate() || `${monthKey}-31`,
    };
  }

  private applySeasonFilter(
    query: any,
    tableAlias: string,
    seasonId: number,
    hasSeasonColumn: boolean
  ) {
    if (hasSeasonColumn) {
      query.where(`${tableAlias}.season_id`, seasonId);
      return;
    }

    if (seasonId === 1) {
      query.where(`${tableAlias}.data`, "<", this.SEASON_TWO_START_DATE);
      return;
    }

    query.where(`${tableAlias}.data`, ">=", this.SEASON_TWO_START_DATE);
  }

  private applyMonthFilter(query: any, tableAlias: string, monthKey: string | null) {
    if (!monthKey) return;
    const { start, endExclusive } = this.getMonthRange(monthKey);
    query.where(`${tableAlias}.data`, ">=", start).where(`${tableAlias}.data`, "<", endExclusive);
  }

  public async listar({ request, response }: HttpContextContract) {
    const monthKey = this.parseMonthKey(request.input("month"));
    const seasonRaw = request.input("season_id");
    const hasSeasonParam =
      seasonRaw !== undefined &&
      seasonRaw !== null &&
      String(seasonRaw).trim() !== "";
    const seasonId = hasSeasonParam
      ? this.parseSeasonId(seasonRaw)
      : monthKey
      ? null
      : this.DEFAULT_SEASON_ID;
    const partidaSeasonColumn = await Database.from("information_schema.columns")
      .where("table_name", "tb_partidas")
      .where("column_name", "season_id")
      .first();
    const hasPartidaSeasonColumn = !!partidaSeasonColumn;
    const jogadores = await Jogadores.query();

    const aggregateQuery = Database.from("tb_partidas_jogadores as pj")
      .innerJoin("tb_partidas as p", "p.id", "pj.partidas_id");

    if (seasonId !== null) {
      this.applySeasonFilter(
        aggregateQuery,
        "p",
        seasonId,
        hasPartidaSeasonColumn
      );
    }
    this.applyMonthFilter(aggregateQuery, "p", monthKey);

    const aggregateRows = await aggregateQuery
      .select("pj.jogadores_id as jogador_id")
      .select(
        Database.raw("COUNT(*)::int as qtd_partidas"),
        Database.raw(
          "COALESCE(SUM(CASE WHEN pj.partida_ganha = TRUE THEN 1 ELSE 0 END), 0)::int as vitorias"
        ),
        Database.raw("COALESCE(SUM(COALESCE(pj.kills, 0)), 0)::int as kills"),
        Database.raw(
          "COALESCE(SUM(COALESCE(pj.assistencias, 0)), 0)::int as assistencias"
        ),
        Database.raw("COALESCE(SUM(COALESCE(pj.mortes, 0)), 0)::int as mortes"),
        Database.raw(
          "COALESCE(SUM(COALESCE(pj.first_kill, 0)), 0)::int as first_kill"
        ),
        Database.raw(
          "COALESCE(SUM(COALESCE(pj.multi_kill, 0)), 0)::int as multi_kill"
        ),
        Database.raw(
          "COALESCE(AVG(NULLIF(REPLACE(COALESCE(pj.adr::text, ''), ',', '.'), '')::numeric), 0) as adr"
        ),
        Database.raw("COALESCE(AVG(COALESCE(pj.kast, 0)), 0) as kast"),
        Database.raw(
          "COALESCE(SUM(NULLIF(REPLACE(COALESCE(pj.pontos::text, ''), ',', '.'), '')::numeric), 0) as pontos"
        )
      )
      .groupBy("pj.jogadores_id");

    const aggregateByJogador = new Map<
      number,
      {
        qtd_partidas: number;
        vitorias: number;
        kills: number;
        assistencias: number;
        mortes: number;
        first_kill: number;
        multi_kill: number;
        adr: number;
        kast: number;
        pontos: number;
      }
    >();

    for (const row of aggregateRows) {
      const jogadorId = Number((row as any)?.jogador_id || 0);
      if (jogadorId <= 0) continue;
      aggregateByJogador.set(jogadorId, {
        qtd_partidas: Number((row as any)?.qtd_partidas || 0),
        vitorias: Number((row as any)?.vitorias || 0),
        kills: Number((row as any)?.kills || 0),
        assistencias: Number((row as any)?.assistencias || 0),
        mortes: Number((row as any)?.mortes || 0),
        first_kill: Number((row as any)?.first_kill || 0),
        multi_kill: Number((row as any)?.multi_kill || 0),
        adr: Number((row as any)?.adr || 0),
        kast: Number((row as any)?.kast || 0),
        pontos: Number((row as any)?.pontos || 0),
      });
    }

    const payload = jogadores.map((j) => {
      const pontosLevel = Number(j.level_pontos || 0);
      const levelInfo = LevelService.getLevelPorPontos(pontosLevel);
      const progresso = LevelService.getProgressoLevel(pontosLevel);
      const agg = aggregateByJogador.get(Number(j.id));
      const kills = Number(agg?.kills || 0);
      const mortes = Number(agg?.mortes || 0);
      const kda = mortes > 0 ? kills / mortes : kills;
      const qtdPartidas = Number(agg?.qtd_partidas || 0);
      const pontos = Number(agg?.pontos || 0) + this.seasonMilestoneBonus(qtdPartidas);
      return {
        ...j.toJSON(),
        kills,
        assistencias: Number(agg?.assistencias || 0),
        mortes,
        adr: Number((agg?.adr || 0).toFixed(1)),
        kast: Number((agg?.kast || 0).toFixed(1)),
        first_kill: Number(agg?.first_kill || 0),
        multi_kill: Number(agg?.multi_kill || 0),
        vitorias: Number(agg?.vitorias || 0),
        qtd_partidas: qtdPartidas,
        pontos: Number(pontos.toFixed(2)),
        kda_player: Number(kda.toFixed(2)),
        level: Number(j.level || levelInfo.level),
        level_pontos: pontosLevel,
        level_nome: levelInfo.nome,
        level_tier: levelInfo.tier,
        level_progresso: progresso,
      };
    });

    payload.sort((a, b) => {
      const pontosDiff = Number(b.pontos || 0) - Number(a.pontos || 0);
      if (pontosDiff !== 0) return pontosDiff;
      const killsDiff = Number(b.kills || 0) - Number(a.kills || 0);
      if (killsDiff !== 0) return killsDiff;
      return Number(b.level_pontos || 0) - Number(a.level_pontos || 0);
    });

    return response.json(payload);
  }

  public async vincularUsuarioJogador({
    auth,
    params,
    response,
  }: HttpContextContract) {
    await auth.authenticate();
    const usuario = auth.user as any;

    try {
      const jogadorId = Number(params.id);
      if (!jogadorId) {
        return this.customResponse.erro(
          response,
          "Parâmetro jogador inválido.",
          {},
          400
        );
      }

      const jogador = await Jogadores.findOrFail(jogadorId);

      if (
        jogador.usuario_adm_id &&
        Number(jogador.usuario_adm_id) !== Number(usuario.id)
      ) {
        return this.customResponse.erro(
          response,
          "Este jogador já está vinculado a outro usuário.",
          {},
          409
        );
      }

      jogador.usuario_adm_id = Number(usuario.id);
      if (!jogador.nome_normalizado || jogador.nome_normalizado.trim() === "") {
        jogador.nome_normalizado = normalizeName(jogador.nome || "");
      }
      await jogador.save();

      return this.customResponse.sucesso(
        response,
        "Jogador vinculado ao seu usuário.",
        {
          jogador_id: jogador.id,
          usuario_id: Number(usuario.id),
          gold: Number(jogador.gold || 0), // <-- devolve o gold para o front
        }
      );
    } catch (error) {
      return this.customResponse.erro(
        response,
        "Erro ao vincular jogador.",
        error,
        500
      );
    }
  }

  /**
   * GET /api/jogadores/gold
   * Retorna o gold do jogador vinculado. Se não houver vínculo,
   * tenta localizar por nome_normalizado (case-insensitive) e já vincula.
   */
  public async meuGold({ auth, response }: HttpContextContract) {
    const user = await auth.authenticate();
    const usuarioId = Number(user.id);

    // 1) tenta por vínculo direto
    let jogador = await Jogadores.query()
      .where("usuario_adm_id", usuarioId)
      .first();

    // 2) se não achar, tenta por nome_normalizado (insensível a caixa/acentos)
    if (!jogador) {
      const ua = await UsuarioAdm.find(usuarioId);
      const chave = normalizeName(ua?.nome_normalizado || ua?.nome || "");
      const gcId = Number((ua as any)?.gc_id || 0);
      const steamId = String((ua as any)?.steam_id || "").trim();
      const gcNickNorm = normalizeName((ua as any)?.gc_nick || "");

      if (gcId > 0) {
        jogador = await Jogadores.query()
          .where("gc_id", gcId)
          .where((q) => q.whereNull("usuario_adm_id").orWhere("usuario_adm_id", usuarioId))
          .first();
      }

      if (!jogador && steamId) {
        jogador = await Jogadores.query()
          .where("steam_id", steamId)
          .where((q) => q.whereNull("usuario_adm_id").orWhere("usuario_adm_id", usuarioId))
          .first();
      }

      if (!jogador && (gcNickNorm || chave)) {
        jogador = await Jogadores.query()
          .where((q) => {
            if (gcNickNorm) {
              q.whereRaw("LOWER(gc_nick_normalizado) = ?", [gcNickNorm]);
            }
            if (chave) {
              if (gcNickNorm) {
                q.orWhereRaw("LOWER(nome_normalizado) = ?", [chave]).orWhereRaw(
                  "LOWER(nome) = ?",
                  [chave]
                );
              } else {
                q.whereRaw("LOWER(nome_normalizado) = ?", [chave]).orWhereRaw(
                  "LOWER(nome) = ?",
                  [chave]
                );
              }
            }
          })
          .where((q) => q.whereNull("usuario_adm_id").orWhere("usuario_adm_id", usuarioId))
          .first();

        // se encontrou e não está preso a outro usuário, já vincula
        if (
          jogador &&
          (!jogador.usuario_adm_id ||
            Number(jogador.usuario_adm_id) === usuarioId)
        ) {
          jogador.usuario_adm_id = usuarioId;
          if (!jogador.gc_id && gcId > 0) jogador.gc_id = gcId;
          if (!jogador.steam_id && steamId) jogador.steam_id = steamId;
          if (!jogador.gc_nick_normalizado && gcNickNorm) {
            jogador.gc_nick_normalizado = gcNickNorm;
          }
          if (
            !jogador.nome_normalizado ||
            jogador.nome_normalizado.trim() === ""
          ) {
            jogador.nome_normalizado = chave;
          }
          await jogador.save();
        }
      }
    }

    if (!jogador) {
      return response.ok({
        gold: 0,
        mensagem: "Jogador não vinculado a este usuário.",
      });
    }

    const pontosLevel = Number(jogador.level_pontos || 0);
    const levelInfo = LevelService.getLevelPorPontos(pontosLevel);
    const levelProgresso = LevelService.getProgressoLevel(pontosLevel);

    return response.ok({
      gold: Number(jogador.gold || 0),
      jogador_id: jogador.id,
      nome: jogador.gc_nick || jogador.nome || "",
      gc_nick: jogador.gc_nick || null,
      imagem: jogador.imagem || "",
      level: Number(jogador.level || levelInfo.level),
      level_pontos: pontosLevel,
      level_nome: levelInfo.nome,
      level_tier: levelInfo.tier,
      level_progresso: levelProgresso,
    });
  }
}
