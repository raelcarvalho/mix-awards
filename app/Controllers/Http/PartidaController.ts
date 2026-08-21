import { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import Partidas from "App/Models/Partidas";
import Jogadores from "App/Models/Jogadores";
import CustomResponse from "App/Utils/CustomResponse";
import PartidasJogadores from "App/Models/PartidasJogadores";
import UsuarioAdm from "App/Models/UsuarioAdm";
import Database from "@ioc:Adonis/Lucid/Database";
import { DateTime } from "luxon";
import { LevelService } from "App/Systems/Level/LevelService";
import { MissionService } from "App/Systems/Missions/MissionService";

export default class PartidaController {
  private customResponse = new CustomResponse();
  private readonly DEFAULT_SEASON_ID = 2;
  private readonly SEASON_TWO_START_DATE = "2026-05-25";

  private normName(s: string) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  private parseSeasonId(raw: any): number {
    const n = Number(raw);
    if (n === 1 || n === 2) return n;
    return this.DEFAULT_SEASON_ID;
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

  private resolveSeasonIdFromDate(matchDate: DateTime): number {
    const isoDate = (matchDate?.isValid ? matchDate.toUTC().toISODate() : null) || "";
    if (isoDate && isoDate < this.SEASON_TWO_START_DATE) return 1;
    return 2;
  }

  private applySeasonFilter(query: any, tableAlias: string, seasonId: number, hasSeasonColumn: boolean) {
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

  public async importarJson({ auth, request, response }: HttpContextContract) {
    const usuario = await auth.authenticate();
    const usuarioDb = await UsuarioAdm.findOrFail(usuario.id);

    if (!usuarioDb?.usuario_admin) {
      return this.customResponse.erro(
        response,
        "Apenas administradores podem importar partidas!",
        {},
        403
      );
    }

    const data = request.all();

    if (!data?.id || !data?.jogos || !data?.jogos?.players) {
      return this.customResponse.erro(
        response,
        "JSON inválido: campos essenciais ausentes (id / jogos / players).",
        {},
        400
      );
    }

    const jaExiste = await Partidas.query()
      .where("codigo", Number(data.id))
      .first();
    if (jaExiste) {
      return this.customResponse.erro(
        response,
        `Esta partida (código ${data.id}) já foi importada.`,
        { partida_id: jaExiste.id },
        409
      );
    }

    const pivotColumnRows = await Database.from("information_schema.columns")
      .where("table_name", "tb_partidas_jogadores")
      .select("column_name");
    const pivotColumns = new Set(
      (pivotColumnRows || []).map((r: any) => String(r.column_name || "").trim())
    );
    const hasPivotColumn = (column: string) => pivotColumns.has(column);

    const rewardsTable = await Database.from("information_schema.tables")
      .where("table_name", "tb_partidas_recompensas")
      .first();
    const hasRewardsTable = !!rewardsTable;
    const rewardsColumnRows = hasRewardsTable
      ? await Database.from("information_schema.columns")
          .where("table_name", "tb_partidas_recompensas")
          .select("column_name")
      : [];
    const rewardsColumns = new Set(
      (rewardsColumnRows || []).map((r: any) => String(r.column_name || "").trim())
    );
    const hasRewardsCreatedAt = rewardsColumns.has("created_at");
    const hasRewardsUpdatedAt = rewardsColumns.has("updated_at");
    const missionsTable = await Database.from("information_schema.tables")
      .where("table_name", "tb_jogadores_missoes")
      .first();
    const hasMissionsTable = !!missionsTable;

    const jogadorGoldColumn = await Database.from("information_schema.columns")
      .where("table_name", "tb_jogadores")
      .where("column_name", "gold")
      .first();
    const hasJogadorGoldColumn = !!jogadorGoldColumn;
    const partidaSeasonColumn = await Database.from("information_schema.columns")
      .where("table_name", "tb_partidas")
      .where("column_name", "season_id")
      .first();
    const hasPartidaSeasonColumn = !!partidaSeasonColumn;

    const toNum = (v: any) => {
      if (v === null || v === undefined || v === "") return 0;
      const n = Number(String(v).replace(",", "."));
      return Number.isFinite(n) ? n : 0;
    };
    const toPositiveInt = (v: any): number | null => {
      if (v === null || v === undefined || v === "") return null;
      const onlyDigits = String(v).replace(/\D+/g, "");
      if (!onlyDigits) return null;
      const n = Number(onlyDigits);
      return Number.isFinite(n) && n > 0 ? n : null;
    };
    const resolveGcId = (j: any): number | null => {
      const candidates = [
        j?.player?.id,
        j?.player?.player_id,
        j?.player?.gcid,
        j?.player?.gc_id,
        j?.gcid,
        j?.gc_id,
        j?.player_id,
      ];
      for (const c of candidates) {
        const parsed = toPositiveInt(c);
        if (parsed) return parsed;
      }
      return null;
    };
    const resolveSteamId = (j: any): string | null => {
      const candidates = [
        j?.player?.steamid64,
        j?.player?.steam_id64,
        j?.player?.steamid,
        j?.player?.steam_id,
        j?.steamid64,
        j?.steam_id64,
        j?.steamid,
        j?.steam_id,
      ];
      for (const c of candidates) {
        const parsed = toPositiveInt(c);
        if (parsed) return String(parsed);
      }
      return null;
    };
    const resolveAvatarUrl = (j: any): string => {
      try {
        const html: string = j?.player?.avatarHtml || "";
        const mHtml = html.match(
          /src="([^"]+_medium\.(?:jpg|jpeg|png|webp))"/i
        );
        if (mHtml?.[1]) return mHtml[1];

        const avatar = j?.player?.avatar;
        const ext = j?.player?.avatarExtension || "jpg";
        if (avatar && typeof avatar === "string") {
          if (/^https?:\/\//i.test(avatar)) {
            if (/_medium\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(avatar))
              return avatar;
            const hasExt = /\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(avatar);
            if (hasExt)
              return avatar.replace(
                /\.(jpg|jpeg|png|webp)(\?.*)?$/i,
                `_medium.$1`
              );
            return `${avatar}_medium.jpg`;
          }
          return `https://static.gamersclub.com.br/${avatar}_medium.${ext}`;
        }

        const plAvatar = j?.plAvatar;
        if (plAvatar && typeof plAvatar === "string") {
          if (/^https?:\/\//i.test(plAvatar)) {
            if (/_medium\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(plAvatar))
              return plAvatar;
            const hasExt = /\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(plAvatar);
            if (hasExt)
              return plAvatar.replace(
                /\.(jpg|jpeg|png|webp)(\?.*)?$/i,
                `_medium.$1`
              );
            return `${plAvatar}_medium.jpg`;
          } else {
            return `https://static.gamersclub.com.br/${plAvatar}_medium.jpg`;
          }
        }
      } catch {}
      return "";
    };

    const trx = await Database.transaction();

    try {
      const scoreA = toNum(data.jogos.score_a);
      const scoreB = toNum(data.jogos.score_b);
      let timeVencedor: "A" | "B" | null = null;
      if (scoreA > scoreB) timeVencedor = "A";
      else if (scoreB > scoreA) timeVencedor = "B";

      const rawDate = String(data?.data || "").trim();
      const parsedDate = rawDate
        ? [
            DateTime.fromISO(rawDate, { zone: "utc" }),
            DateTime.fromSQL(rawDate, { zone: "utc" }),
            DateTime.fromFormat(rawDate, "dd/MM/yyyy HH:mm:ss", { zone: "utc" }),
            DateTime.fromFormat(rawDate, "dd/MM/yyyy HH:mm", { zone: "utc" }),
            DateTime.fromFormat(rawDate, "dd/MM/yyyy", { zone: "utc" }),
          ].find((d) => d.isValid)
        : undefined;
      const partidaDate = parsedDate || DateTime.now().toUTC();
      const seasonId = this.resolveSeasonIdFromDate(partidaDate);
      const partidaPayload: any = {
        mapa: String(data?.jogos?.map_name || ""),
        data: partidaDate.toJSDate(),
        codigo: Number(data.id),
        resultado_time1: scoreA,
        resultado_time2: scoreB,
        nome_time1: String(data?.time_a || "Time A"),
        nome_time2: String(data?.time_b || "Time B"),
      };
      if (hasPartidaSeasonColumn) {
        partidaPayload.season_id = seasonId;
      }

      const partida = await Partidas.create(partidaPayload, { client: trx });

      const parseKast = (v: any) =>
        toNum(
          String(v ?? "")
            .toString()
            .replace("%", "")
        );

      const jogadoresInput = [
        ...(data?.jogos?.players?.team_a || []).map((j: any) => ({
          nome: j?.player?.nick || "",
          gc_id: resolveGcId(j),
          steam_id: resolveSteamId(j),
          imagem: resolveAvatarUrl(j),
          adr: toNum(j?.adr),
          kills: toNum(j?.nb_kill),
          assistencias: toNum(j?.assist),
          mortes: toNum(j?.death),
          kda_player: j?.kdr,
          kast: parseKast(j?.pkast),
          flash_assist: toNum(j?.flash_assist),
          first_kill: toNum(j?.firstkill),
          multi_kill: toNum(j?.multikills),
          _time: "A" as const,
        })),
        ...(data?.jogos?.players?.team_b || []).map((j: any) => ({
          nome: j?.player?.nick || "",
          gc_id: resolveGcId(j),
          steam_id: resolveSteamId(j),
          imagem: resolveAvatarUrl(j),
          adr: toNum(j?.adr),
          kills: toNum(j?.nb_kill),
          assistencias: toNum(j?.assist),
          mortes: toNum(j?.death),
          kda_player: j?.kdr,
          kast: parseKast(j?.pkast),
          flash_assist: toNum(j?.flash_assist),
          first_kill: toNum(j?.firstkill),
          multi_kill: toNum(j?.multikills),
          _time: "B" as const,
        })),
      ];

      const jogadoresCriados: {
        id: number;
        _time: "A" | "B";
        origem: any;
        levelDelta: number;
        levelAntes: number;
        levelDepois: number;
      }[] = [];

      const nomesNormUnicos = Array.from(
        new Set(
          jogadoresInput
            .map((j) => this.normName(j.nome))
            .filter((n) => n.length > 0)
        )
      );
      const nomesRawUnicos = Array.from(
        new Set(
          jogadoresInput
            .map((j) => String(j.nome || "").trim())
            .filter((n) => n.length > 0)
        )
      );
      const gcIdsUnicos = Array.from(
        new Set(
          jogadoresInput
            .map((j) => Number(j.gc_id))
            .filter((id) => Number.isFinite(id) && id > 0)
        )
      );
      const steamIdsUnicos = Array.from(
        new Set(
          jogadoresInput
            .map((j) => String(j.steam_id || "").trim())
            .filter((id) => id.length > 0)
        )
      );
      const hasAnyLookup =
        gcIdsUnicos.length > 0 ||
        steamIdsUnicos.length > 0 ||
        nomesNormUnicos.length > 0 ||
        nomesRawUnicos.length > 0;

      const jogadoresExistentes = hasAnyLookup
        ? await Jogadores.query({ client: trx }).where((q) => {
            if (gcIdsUnicos.length > 0) {
              q.whereIn("gc_id", gcIdsUnicos);
            }
            if (steamIdsUnicos.length > 0) {
              if (gcIdsUnicos.length > 0) q.orWhereIn("steam_id", steamIdsUnicos);
              else q.whereIn("steam_id", steamIdsUnicos);
            }
            if (nomesNormUnicos.length > 0) {
              if (gcIdsUnicos.length > 0 || steamIdsUnicos.length > 0) {
                q.orWhereIn("nome_normalizado", nomesNormUnicos);
              } else {
                q.whereIn("nome_normalizado", nomesNormUnicos);
              }
            }
            if (nomesRawUnicos.length > 0) {
              if (
                gcIdsUnicos.length > 0 ||
                steamIdsUnicos.length > 0 ||
                nomesNormUnicos.length > 0
              )
                q.orWhereIn("nome", nomesRawUnicos);
              else q.whereIn("nome", nomesRawUnicos);
            }
          })
        : [];

      const usuariosPossiveis = hasAnyLookup
        ? await UsuarioAdm.query({ client: trx }).where((q) => {
            if (gcIdsUnicos.length > 0) {
              q.whereIn("gc_id", gcIdsUnicos);
            }
            if (steamIdsUnicos.length > 0) {
              if (gcIdsUnicos.length > 0) q.orWhereIn("steam_id", steamIdsUnicos);
              else q.whereIn("steam_id", steamIdsUnicos);
            }
            if (nomesNormUnicos.length > 0) {
              if (gcIdsUnicos.length > 0 || steamIdsUnicos.length > 0) {
                q.orWhereIn("gc_nick_normalizado", nomesNormUnicos).orWhereIn(
                  "nome_normalizado",
                  nomesNormUnicos
                );
              } else {
                q.whereIn("nome_normalizado", nomesNormUnicos);
              }
            }
          })
        : [];

      const jogadorPorGcId = new Map<number, Jogadores>();
      const jogadorPorSteamId = new Map<string, Jogadores>();
      const jogadorPorNomeNorm = new Map<string, Jogadores>();
      const jogadorPorNomeRaw = new Map<string, Jogadores>();
      for (const j of jogadoresExistentes) {
        const gcId = Number(j.gc_id || 0);
        if (gcId > 0) jogadorPorGcId.set(gcId, j);
        const steamId = String(j.steam_id || "").trim();
        if (steamId) jogadorPorSteamId.set(steamId, j);
        const nn = this.normName(j.nome_normalizado || "");
        if (nn) jogadorPorNomeNorm.set(nn, j);
        const nr = this.normName(j.nome || "");
        if (nr) jogadorPorNomeRaw.set(nr, j);
      }
      const usuarioPorGcId = new Map<number, UsuarioAdm>();
      const usuarioPorSteamId = new Map<string, UsuarioAdm>();
      const usuarioPorGcNickNorm = new Map<string, UsuarioAdm>();
      const usuarioPorNomeNorm = new Map<string, UsuarioAdm>();
      const usuarioPorId = new Map<number, UsuarioAdm>();
      for (const u of usuariosPossiveis) {
        if (Number(u.id) > 0) usuarioPorId.set(Number(u.id), u);
        const gcId = Number((u as any).gc_id || 0);
        if (gcId > 0) usuarioPorGcId.set(gcId, u);
        const steamId = String((u as any).steam_id || "").trim();
        if (steamId) usuarioPorSteamId.set(steamId, u);
        const gcNickNorm = this.normName((u as any).gc_nick_normalizado || "");
        if (gcNickNorm) usuarioPorGcNickNorm.set(gcNickNorm, u);
        const key = this.normName((u as any).nome_normalizado || (u as any).nome || "");
        if (key) usuarioPorNomeNorm.set(key, u);
      }

      const syncUsuarioNickByIdentity = async (params: {
        usuarioId?: number | null;
        nick?: string | null;
        gcId?: number | null;
        steamId?: string | null;
        jogadorRef?: Jogadores | null;
      }) => {
        const usuarioId = Number(params.usuarioId || 0);
        const nick = String(params.nick || "").trim();
        const gcId = Number(params.gcId || 0);
        const steamId = String(params.steamId || "").trim();
        if (!usuarioId || !nick) return;
        if (!(gcId > 0 || steamId)) return;

        let usuarioModel = usuarioPorId.get(usuarioId) || null;
        if (!usuarioModel) {
          usuarioModel = await UsuarioAdm.query({ client: trx })
            .where("id", usuarioId)
            .first();
          if (!usuarioModel) return;
          usuarioPorId.set(usuarioId, usuarioModel);
        }

        const usuarioGcId = Number((usuarioModel as any).gc_id || 0);
        const usuarioSteamId = String((usuarioModel as any).steam_id || "").trim();
        const jogadorRef = params.jogadorRef || null;
        const jogadorGcId = Number((jogadorRef as any)?.gc_id || 0);
        const jogadorSteamId = String((jogadorRef as any)?.steam_id || "").trim();
        const jogadorMesmoUsuario =
          Number((jogadorRef as any)?.usuario_adm_id || 0) === usuarioId;

        if (gcId > 0 && usuarioGcId > 0 && usuarioGcId !== gcId) return;
        if (steamId && usuarioSteamId && usuarioSteamId !== steamId) return;

        const usuarioBatePorId =
          (gcId > 0 && usuarioGcId > 0 && usuarioGcId === gcId) ||
          (steamId && usuarioSteamId && usuarioSteamId === steamId);
        const jogadorBatePorId =
          jogadorMesmoUsuario &&
          ((gcId > 0 && jogadorGcId > 0 && jogadorGcId === gcId) ||
            (steamId && jogadorSteamId && jogadorSteamId === steamId));
        if (!usuarioBatePorId && !jogadorBatePorId) return;

        const nickNorm = this.normName(nick);
        (usuarioModel as any).gc_nick = nick;
        (usuarioModel as any).gc_nick_normalizado = nickNorm;
        if (gcId > 0 && !usuarioGcId) (usuarioModel as any).gc_id = gcId;
        if (steamId && !usuarioSteamId) (usuarioModel as any).steam_id = steamId;
        usuarioModel.nome = nick;
        usuarioModel.nome_normalizado = nickNorm.toUpperCase();
        await usuarioModel.useTransaction(trx).save();
      };

      const participantes = jogadoresInput.map((jogador) => {
        const nomeNorm = this.normName(jogador.nome);
        const gcId = Number(jogador.gc_id || 0) || null;
        const steamId = String(jogador.steam_id || "").trim() || null;
        const jogadorExistente =
          (gcId ? jogadorPorGcId.get(gcId) : null) ||
          (steamId ? jogadorPorSteamId.get(steamId) : null) ||
          jogadorPorNomeNorm.get(nomeNorm) ||
          jogadorPorNomeRaw.get(nomeNorm) ||
          null;
        const levelPontosAtual = Number(jogadorExistente?.level_pontos || 0);
        const levelAtual = Number(
          jogadorExistente?.level ||
            LevelService.getLevelPorPontos(levelPontosAtual).level
        );
        return {
          ...jogador,
          gcId,
          steamId,
          nomeNorm,
          vitoria: jogador._time === timeVencedor,
          jogadorExistente,
          usuarioPossivel:
            (gcId ? usuarioPorGcId.get(gcId) : null) ||
            (steamId ? usuarioPorSteamId.get(steamId) : null) ||
            usuarioPorGcNickNorm.get(nomeNorm) ||
            usuarioPorNomeNorm.get(nomeNorm) ||
            null,
          levelPontosAtual,
          levelAtual,
        };
      });

      const levelsA = participantes
        .filter((p) => p._time === "A")
        .map((p) => Number(p.levelAtual || 0));
      const levelsB = participantes
        .filter((p) => p._time === "B")
        .map((p) => Number(p.levelAtual || 0));
      const nivelMedioA = LevelService.calcularNivelMedioTime(levelsA);
      const nivelMedioB = LevelService.calcularNivelMedioTime(levelsB);

      for (const p of participantes) {
        const { _time, nome, imagem, nomeNorm, gcId, steamId, vitoria, ...estatisticas } = p as any;
        let jogadorModel: Jogadores | null = p.jogadorExistente || null;

        let novaQtdPartidas = 1;
        let pontosPartida = 0;
        pontosPartida += estatisticas.kills;
        pontosPartida += estatisticas.first_kill;
        pontosPartida +=
          estatisticas.adr < 50
            ? 5
            : estatisticas.adr > 50 && estatisticas.adr < 79
            ? 10
            : estatisticas.adr >= 79 && estatisticas.adr < 100
            ? 15
            : 20;
        pontosPartida += vitoria ? 30 : 5;

        const nivelMedioAdv = _time === "A" ? nivelMedioB : nivelMedioA;
        const levelResult = LevelService.calcularPontos(
          {
            kills: Number(estatisticas.kills || 0),
            deaths: Number(estatisticas.mortes || 0),
            assists: Number(estatisticas.assistencias || 0),
            adr: Number(estatisticas.adr || 0),
            partida_ganha: !!vitoria,
          },
          {
            meu_level: Number(p.levelAtual || 0),
            nivel_medio_adversarios: Number(nivelMedioAdv || 0),
          },
          Number(p.levelPontosAtual || 0)
        );

        if (jogadorModel) {
          if (!jogadorModel.nome_normalizado)
            jogadorModel.nome_normalizado = nomeNorm;
          if (gcId && !jogadorModel.gc_id) jogadorModel.gc_id = gcId;
          if (steamId && !jogadorModel.steam_id) jogadorModel.steam_id = steamId;
          if (nome && (gcId || steamId)) jogadorModel.gc_nick = nome;
          if (nomeNorm && (gcId || steamId)) {
            jogadorModel.gc_nick_normalizado = nomeNorm;
          } else if (nomeNorm && !jogadorModel.gc_nick_normalizado) {
            jogadorModel.gc_nick_normalizado = nomeNorm;
          }
          if (!jogadorModel.usuario_adm_id && p.usuarioPossivel) {
            jogadorModel.usuario_adm_id = p.usuarioPossivel.id;
          }
          if (
            (!jogadorModel.imagem || jogadorModel.imagem.trim() === "") &&
            imagem
          ) {
            jogadorModel.imagem = imagem;
          }

          novaQtdPartidas = Number(jogadorModel.qtd_partidas || 0) + 1;
          if (vitoria) {
            jogadorModel.vitorias = (
              Number(jogadorModel.vitorias || 0) + 1
            ).toString();
          }

          jogadorModel.kills = (
            Number(jogadorModel.kills || 0) + estatisticas.kills
          ).toString();
          jogadorModel.assistencias = (
            Number(jogadorModel.assistencias || 0) + estatisticas.assistencias
          ).toString();
          jogadorModel.mortes = (
            Number(jogadorModel.mortes || 0) + estatisticas.mortes
          ).toString();
          const totalKills = Number(jogadorModel.kills || 0);
          const totalDeaths = Number(jogadorModel.mortes || 0);
          jogadorModel.kda_player =
            totalDeaths > 0
              ? (totalKills / totalDeaths).toFixed(2)
              : totalKills.toFixed(2);
          const kastAnterior = Number(jogadorModel.kast || 0);
          const kastNovo = Number(estatisticas.kast || 0);
          jogadorModel.kast = Math.round(
            (kastAnterior * (novaQtdPartidas - 1) + kastNovo) / novaQtdPartidas
          );
          jogadorModel.flash_assist = (
            Number(jogadorModel.flash_assist || 0) + estatisticas.flash_assist
          ).toString();
          jogadorModel.first_kill = (
            Number(jogadorModel.first_kill || 0) + estatisticas.first_kill
          ).toString();
          jogadorModel.multi_kill = (
            Number(jogadorModel.multi_kill || 0) + estatisticas.multi_kill
          ).toString();
          jogadorModel.adr = (
            ((Number(jogadorModel.adr || 0) || 0) * (novaQtdPartidas - 1) +
              estatisticas.adr) /
            novaQtdPartidas
          ).toFixed(2);

          // O bônus de marco (15/20/30/40 jogos) NÃO é aplicado aqui — ele é
          // calculado por temporada no agregado do ranking (JogadoresController.listar),
          // creditado no total da temporada e sem distorcer o placar de uma partida.
          const pontosTotaisAnterior =
            Number(jogadorModel.pontos || 0) * (novaQtdPartidas - 1);
          const novoTotalPontos = pontosTotaisAnterior + pontosPartida;
          const mediaPontos = novoTotalPontos / novaQtdPartidas;

          jogadorModel.qtd_partidas = novaQtdPartidas.toString();
          jogadorModel.pontos = mediaPontos.toFixed(0);
          jogadorModel.level_pontos = levelResult.pontos_depois;
          jogadorModel.level = levelResult.level_depois.level;

          await jogadorModel.useTransaction(trx).save();
        } else {
          jogadorModel = await Jogadores.create(
            {
              nome,
              nome_normalizado: nomeNorm,
              gc_id: gcId,
              steam_id: steamId,
              gc_nick: nome,
              gc_nick_normalizado: nomeNorm,
              usuario_adm_id: p.usuarioPossivel?.id,
              imagem: imagem || "",
              adr: String(estatisticas.adr ?? 0),
              kills: String(estatisticas.kills ?? 0),
              assistencias: String(estatisticas.assistencias ?? 0),
              mortes: String(estatisticas.mortes ?? 0),
              kda_player:
                estatisticas.mortes > 0
                  ? (estatisticas.kills / estatisticas.mortes).toFixed(2)
                  : String(estatisticas.kills ?? 0),
              kast: Math.round(Number(estatisticas.kast ?? 0)),
              flash_assist: String(estatisticas.flash_assist ?? 0),
              first_kill: String(estatisticas.first_kill ?? 0),
              multi_kill: String(estatisticas.multi_kill ?? 0),
              qtd_partidas: "1",
              pontos: String(pontosPartida),
              vitorias: vitoria ? "1" : "0",
              level: levelResult.level_depois.level,
              level_pontos: levelResult.pontos_depois,
            },
            { client: trx }
          );
        }

        if (hasMissionsTable) {
          await MissionService.applyMatchProgress(
            jogadorModel.id,
            {
              kills: Number(estatisticas.kills || 0),
              assistencias: Number(estatisticas.assistencias || 0),
              adr: Number(estatisticas.adr || 0),
              first_kill: Number(estatisticas.first_kill || 0),
              multi_kill: Number(estatisticas.multi_kill || 0),
              vitoria: !!vitoria,
            },
            trx
          );
        }

        const usuarioIdVinculado =
          Number(jogadorModel.usuario_adm_id || 0) ||
          Number(p.usuarioPossivel?.id || 0) ||
          null;
        await syncUsuarioNickByIdentity({
          usuarioId: usuarioIdVinculado,
          nick: nome,
          gcId,
          steamId,
          jogadorRef: jogadorModel,
        });

        jogadoresCriados.push({
          id: jogadorModel.id,
          _time,
          levelDelta: levelResult.pontos_ganhos,
          levelAntes: levelResult.level_antes.level,
          levelDepois: levelResult.level_depois.level,
          origem: {
            ...estatisticas,
            nome,
            time: _time,
            vitorias: jogadorModel.vitorias,
            pontos: pontosPartida,
            qtd_partidas: Number(jogadorModel.qtd_partidas || 1),
            partida_ganha: vitoria ? 1 : 0,
          },
        });
      }

      // monta pivot — o placar exibido da partida é apenas performance + resultado.
      // O bônus de marco (milestone) é creditado somente no acumulado/média do jogador.
      const pivotData = jogadoresCriados.reduce((acc, j) => {
        const pivotRow: Record<string, any> = {};
        if (hasPivotColumn("nome")) pivotRow.nome = j.origem.nome;
        if (hasPivotColumn("time")) pivotRow.time = j.origem.time;
        if (hasPivotColumn("kills")) pivotRow.kills = j.origem.kills;
        if (hasPivotColumn("assistencias")) pivotRow.assistencias = j.origem.assistencias;
        if (hasPivotColumn("mortes")) pivotRow.mortes = j.origem.mortes;
        if (hasPivotColumn("kda_player")) {
          pivotRow.kda_player =
            j.origem.mortes > 0
              ? (j.origem.kills / j.origem.mortes).toFixed(2)
              : String(j.origem.kills);
        }
        if (hasPivotColumn("kast")) pivotRow.kast = Number(j.origem.kast);
        if (hasPivotColumn("flash_assist")) pivotRow.flash_assist = j.origem.flash_assist;
        if (hasPivotColumn("first_kill")) pivotRow.first_kill = j.origem.first_kill;
        if (hasPivotColumn("multi_kill")) pivotRow.multi_kill = j.origem.multi_kill;
        if (hasPivotColumn("adr")) pivotRow.adr = Number(j.origem.adr).toFixed(2);
        if (hasPivotColumn("partida_ganha")) pivotRow.partida_ganha = j.origem.partida_ganha ? 1 : 0;
        if (hasPivotColumn("vitorias")) pivotRow.vitorias = j.origem.partida_ganha ? 1 : 0;
        // bônus de marco (milestone) NÃO entra no placar exibido da partida —
        // ele continua creditado no acumulado/média do jogador (mediaComBonus acima).
        if (hasPivotColumn("pontos")) pivotRow.pontos = j.origem.pontos;
        if (hasPivotColumn("qtd_partidas")) pivotRow.qtd_partidas = String(j.origem.qtd_partidas || "");
        if (hasPivotColumn("level_delta")) pivotRow.level_delta = j.levelDelta;
        if (hasPivotColumn("level_antes")) pivotRow.level_antes = j.levelAntes;
        if (hasPivotColumn("level_depois")) pivotRow.level_depois = j.levelDepois;

        acc[j.id] = pivotRow;
        return acc;
      }, {} as Record<number, any>);

      await partida.useTransaction(trx).related("jogadores").attach(pivotData);

      // crédito de gold (bulk, evitando N+1)
      const goldPorJogador = new Map<number, number>();
      for (const j of jogadoresCriados) {
        const credito = j.origem.partida_ganha ? 25 : 18;
        goldPorJogador.set(j.id, Number(goldPorJogador.get(j.id) || 0) + credito);
      }

      const nowSql = DateTime.now().toSQL();
      const recompensasRows = Array.from(goldPorJogador.entries()).map(([jogadorId, goldCreditado]) => {
        const row: Record<string, any> = {
          partida_id: partida.id,
          jogador_id: jogadorId,
          gold_creditado: goldCreditado,
        };
        if (hasRewardsCreatedAt) row.created_at = nowSql;
        if (hasRewardsUpdatedAt) row.updated_at = nowSql;
        return row;
      });

      if (hasRewardsTable && recompensasRows.length > 0) {
        await trx.table("tb_partidas_recompensas").insert(recompensasRows);
      }

      const idsGold = Array.from(goldPorJogador.keys());
      if (hasJogadorGoldColumn && idsGold.length > 0) {
        const caseExpr = idsGold
          .map((id) => `WHEN ${id} THEN ${Number(goldPorJogador.get(id) || 0)}`)
          .join(" ");

        await trx.rawQuery(`
          UPDATE tb_jogadores
          SET gold = COALESCE(gold, 0) + (CASE id ${caseExpr} ELSE 0 END)
          WHERE id IN (${idsGold.join(",")})
        `);
      }

      await trx.commit();
      return this.customResponse.sucesso(
        response,
        "Partida e jogadores importados com sucesso!",
        partida
      );
    } catch (error) {
      await trx.rollback();
      console.error("ERRO importarJson:", error);
      return this.customResponse.erro(
        response,
        "Erro ao importar partida!",
        error,
        500
      );
    }
  }

  public async consultarPartidas({ request, response }: HttpContextContract) {
    const playerRaw = String(request.input("player", "") || "").trim();
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

    if (!playerRaw) {
      const partidasQuery = Partidas.query();
      if (seasonId !== null) {
        this.applySeasonFilter(
          partidasQuery,
          "tb_partidas",
          seasonId,
          hasPartidaSeasonColumn
        );
      }
      this.applyMonthFilter(partidasQuery, "tb_partidas", monthKey);
      const partidas = await partidasQuery
        .orderBy("data", "desc")
        .orderBy("id", "desc");
      return response.json(partidas);
    }

    const q = this.normName(playerRaw);

    const partidasQuery = Database.from("tb_partidas as p")
      .innerJoin("tb_partidas_jogadores as pj", "pj.partidas_id", "p.id")
      .innerJoin("tb_jogadores as j", "j.id", "pj.jogadores_id")
      .whereRaw("LOWER(j.nome_normalizado) LIKE ? OR LOWER(j.nome) LIKE ?", [
        `%${q}%`,
        `%${q}%`,
      ]);

    if (seasonId !== null) {
      this.applySeasonFilter(partidasQuery, "p", seasonId, hasPartidaSeasonColumn);
    }
    this.applyMonthFilter(partidasQuery, "p", monthKey);

    const partidasFiltradas = await partidasQuery
      .orderBy("p.data", "desc")
      .orderBy("p.id", "desc")
      .select(
        "p.id",
        "p.codigo",
        "p.mapa",
        "p.nome_time1",
        "p.nome_time2",
        "p.resultado_time1",
        "p.resultado_time2",
        "p.data",
        "p.created_at",
        "pj.pontos as pontos_jogador",
        "pj.partida_ganha as partida_ganha",
        "pj.kills as kills_jogador",
        "pj.assistencias as assistencias_jogador",
        "pj.mortes as mortes_jogador",
        "pj.adr as adr_jogador",
        "pj.kast as kast_jogador",
        "pj.first_kill as first_kill_jogador",
        "pj.multi_kill as multi_kill_jogador",
        "pj.kda_player as kda_jogador",
        "j.nome as jogador_nome"
      );

    return response.json(partidasFiltradas);
  }

  public async detalhesPartida({ params, response }: HttpContextContract) {
    const partida = await Partidas.findByOrFail("codigo", params.codigo);

    const jogadores = await PartidasJogadores.query()
      .where("partidas_id", partida.id)
      .preload("jogador", (q) => q.select(["id", "nome", "imagem", "level"]));

    const jogadoresComNome = jogadores.map((j) => {
      const row = j.toJSON();
      row.jogadores_id = j.jogador?.nome || "Sem nome";
      row.jogador_imagem = j.jogador?.imagem || "";
      row.jogador_level = Number(j.jogador?.level || 0);
      return row;
    });

    return response.json({
      partida,
      jogadores: jogadoresComNome,
    });
  }

  public async excluirPartida({ auth, params, response }: HttpContextContract) {
    const authUser = await auth.authenticate();

    try {
      const usuario = await UsuarioAdm.findOrFail(authUser.id);
      if (!usuario.usuario_admin) {
        response.header("Cache-Control", "no-store");
        return this.customResponse.erro(
          response,
          "Apenas administradores podem excluir partidas!",
          {},
          403
        );
      }

      await Database.transaction(async (trx) => {
        const partida = await Partidas.query({ client: trx })
          .where("id", params.id)
          .firstOrFail();

        const jogadoresIdsNaPartida = await trx
          .from("tb_partidas_jogadores")
          .where("partidas_id", partida.id)
          .select("jogadores_id");

        const jogadorIdsParaAtualizar = Array.from(
          new Set(
            jogadoresIdsNaPartida.map((r) => Number(r.jogadores_id)).filter((id) => id > 0)
          )
        );

        const recompensas = await trx
          .from("tb_partidas_recompensas")
          .where("partida_id", partida.id)
          .select("jogador_id", "gold_creditado");

        if (recompensas.length > 0) {
          const goldDebitoPorJogador = new Map<number, number>();
          for (const r of recompensas) {
            const jogadorId = Number(r.jogador_id);
            const valor = Number(r.gold_creditado || 0);
            goldDebitoPorJogador.set(
              jogadorId,
              Number(goldDebitoPorJogador.get(jogadorId) || 0) + valor
            );
          }

          const idsGold = Array.from(goldDebitoPorJogador.keys());
          if (idsGold.length > 0) {
            const caseExpr = idsGold
              .map(
                (id) =>
                  `WHEN ${id} THEN ${Number(goldDebitoPorJogador.get(id) || 0)}`
              )
              .join(" ");

            await trx.rawQuery(`
              UPDATE tb_jogadores
              SET gold = GREATEST(0, COALESCE(gold, 0) - (CASE id ${caseExpr} ELSE 0 END))
              WHERE id IN (${idsGold.join(",")})
            `);
          }
        }

        await trx
          .from("tb_partidas_recompensas")
          .where("partida_id", partida.id)
          .delete();

        await trx
          .from("tb_partidas_jogadores")
          .where("partidas_id", partida.id)
          .delete();

        await trx.from("tb_partidas").where("id", partida.id).delete();

        if (jogadorIdsParaAtualizar.length === 0) {
          return;
        }

        const estRows = await trx
          .from("tb_partidas_jogadores")
          .whereIn("jogadores_id", jogadorIdsParaAtualizar)
          .groupBy("jogadores_id")
          .select("jogadores_id")
          .select(
            trx.raw(`
              COUNT(*)::int                                   as jogos,
              SUM(CAST(kills AS NUMERIC))                     as sum_kills,
              SUM(CAST(assistencias AS NUMERIC))              as sum_assists,
              SUM(CAST(mortes AS NUMERIC))                    as sum_mortes,
              AVG(CAST(kast AS NUMERIC))                      as avg_kast,
              AVG(CAST(adr AS NUMERIC))                       as avg_adr,
              SUM(CAST(flash_assist AS NUMERIC))              as sum_flash,
              SUM(CAST(first_kill AS NUMERIC))                as sum_fk,
              SUM(CAST(multi_kill AS NUMERIC))                as sum_mk,
              SUM(CAST(partida_ganha AS INTEGER))             as sum_wins,
              AVG(CAST(pontos AS NUMERIC))                    as avg_points,
              SUM(COALESCE(CAST(level_delta AS NUMERIC), 0))  as sum_level_delta
            `)
          );

        const estMap = new Map<number, any>();
        for (const row of estRows) {
          estMap.set(Number(row.jogadores_id), row);
        }

        const jogadores = await Jogadores.query({ client: trx }).whereIn(
          "id",
          jogadorIdsParaAtualizar
        );

        const semPartidas: number[] = [];
        for (const jogador of jogadores) {
          const est = estMap.get(Number(jogador.id));
          const jogos = Number(est?.jogos || 0);

          if (jogos <= 0) {
            semPartidas.push(Number(jogador.id));
            continue;
          }

          const kills = Number(est?.sum_kills || 0);
          const mortes = Number(est?.sum_mortes || 0);
          const assists = Number(est?.sum_assists || 0);
          const levelPontos = Math.max(
            0,
            Math.round(Number(est?.sum_level_delta || 0))
          );
          const levelInfo = LevelService.getLevelPorPontos(levelPontos);

          jogador.kills = String(kills);
          jogador.assistencias = String(assists);
          jogador.mortes = String(mortes);
          jogador.kda_player =
            mortes > 0 ? (kills / mortes).toFixed(2) : kills.toFixed(2);
          jogador.kast = Math.round(Number(est?.avg_kast || 0));
          jogador.adr = Number(est?.avg_adr || 0).toFixed(2);
          jogador.flash_assist = String(Number(est?.sum_flash || 0));
          jogador.first_kill = String(Number(est?.sum_fk || 0));
          jogador.multi_kill = String(Number(est?.sum_mk || 0));
          jogador.vitorias = String(Number(est?.sum_wins || 0));
          jogador.qtd_partidas = String(jogos);
          jogador.pontos = Math.round(Number(est?.avg_points || 0)).toString();
          jogador.level_pontos = levelPontos;
          jogador.level = levelInfo.level;

          await jogador.useTransaction(trx).save();
        }

        if (semPartidas.length > 0) {
          await Jogadores.query({ client: trx }).whereIn("id", semPartidas).delete();
        }

        const missionsTable = await trx
          .from("information_schema.tables")
          .where("table_name", "tb_jogadores_missoes")
          .first();
        const hasMissionsTable = !!missionsTable;

        if (hasMissionsTable && jogadorIdsParaAtualizar.length > 0) {
          await trx
            .from("tb_jogadores_missoes")
            .whereIn("jogador_id", jogadorIdsParaAtualizar)
            .delete();

          const missionStatsRows = await trx
            .from("tb_partidas_jogadores as pj")
            .innerJoin("tb_partidas as p", "p.id", "pj.partidas_id")
            .whereIn("pj.jogadores_id", jogadorIdsParaAtualizar)
            .orderBy("p.data", "asc")
            .orderBy("p.id", "asc")
            .select(
              "pj.jogadores_id",
              "pj.kills",
              "pj.assistencias",
              "pj.adr",
              "pj.first_kill",
              "pj.multi_kill",
              "pj.partida_ganha"
            );

          const statsByJogador = new Map<number, any[]>();
          for (const row of missionStatsRows) {
            const jogadorId = Number(row.jogadores_id || 0);
            if (jogadorId <= 0) continue;
            const arr = statsByJogador.get(jogadorId) || [];
            arr.push(row);
            statsByJogador.set(jogadorId, arr);
          }

          const semPartidasSet = new Set<number>(semPartidas);
          for (const jogadorId of jogadorIdsParaAtualizar) {
            if (semPartidasSet.has(jogadorId)) continue;

            const statsRows = statsByJogador.get(jogadorId) || [];
            for (const row of statsRows) {
              await MissionService.applyMatchProgress(
                jogadorId,
                {
                  kills: Number(row.kills || 0),
                  assistencias: Number(row.assistencias || 0),
                  adr: Number(row.adr || 0),
                  first_kill: Number(row.first_kill || 0),
                  multi_kill: Number(row.multi_kill || 0),
                  vitoria: Number(row.partida_ganha || 0) > 0,
                },
                trx
              );
            }

            await MissionService.ensureActiveMissions(jogadorId, trx);
          }
        }
      });

      response.header("Cache-Control", "no-store");
      return this.customResponse.sucesso(
        response,
        "Partida deletada e estatísticas atualizadas com sucesso!",
        {}
      );
    } catch (error) {
      console.error("Erro ao excluir partida:", error);
      response.header("Cache-Control", "no-store");
      return this.customResponse.erro(
        response,
        "Erro interno ao excluir partida",
        error,
        500
      );
    }
  }
}
