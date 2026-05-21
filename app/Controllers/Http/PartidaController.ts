import { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import Partidas from "App/Models/Partidas";
import Jogadores from "App/Models/Jogadores";
import CustomResponse from "App/Utils/CustomResponse";
import PartidasJogadores from "App/Models/PartidasJogadores";
import UsuarioAdm from "App/Models/UsuarioAdm";
import Database from "@ioc:Adonis/Lucid/Database";
import { DateTime } from "luxon";
import { LevelService } from "App/Systems/Level/LevelService";

export default class PartidaController {
  private customResponse = new CustomResponse();

  private normName(s: string) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
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

    const toNum = (v: any) =>
      v === null || v === undefined || v === "" ? 0 : Number(v);
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

      const partida = await Partidas.create(
        {
          mapa: String(data?.jogos?.map_name || ""),
          data: data?.data
            ? DateTime.fromISO(String(data.data), { zone: "utc" }).isValid
              ? DateTime.fromISO(String(data.data), { zone: "utc" }).toJSDate()
              : DateTime.now().toJSDate()
            : DateTime.now().toJSDate(),
          codigo: Number(data.id),
          resultado_time1: scoreA,
          resultado_time2: scoreB,
          nome_time1: String(data?.time_a || "Time A"),
          nome_time2: String(data?.time_b || "Time B"),
        },
        { client: trx }
      );

      const parseKast = (v: any) =>
        toNum(
          String(v ?? "")
            .toString()
            .replace("%", "")
        );

      const jogadoresInput = [
        ...(data?.jogos?.players?.team_a || []).map((j: any) => ({
          nome: j?.player?.nick || "",
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
        new Set(jogadoresInput.map((j) => this.normName(j.nome)))
      );
      const nomesRawUnicos = Array.from(
        new Set(
          jogadoresInput
            .map((j) => String(j.nome || "").trim())
            .filter((n) => n.length > 0)
        )
      );

      const jogadoresExistentesQuery = Jogadores.query({ client: trx });
      jogadoresExistentesQuery.where((q) => {
        if (nomesNormUnicos.length > 0) {
          q.whereIn("nome_normalizado", nomesNormUnicos);
        }
        if (nomesRawUnicos.length > 0) {
          if (nomesNormUnicos.length > 0) q.orWhereIn("nome", nomesRawUnicos);
          else q.whereIn("nome", nomesRawUnicos);
        }
      });
      const jogadoresExistentes = await jogadoresExistentesQuery;

      const usuariosPossiveis =
        nomesNormUnicos.length > 0
          ? await UsuarioAdm.query({ client: trx }).whereIn(
              "nome_normalizado",
              nomesNormUnicos
            )
          : [];

      const jogadorPorNomeNorm = new Map<string, Jogadores>();
      const jogadorPorNomeRaw = new Map<string, Jogadores>();
      for (const j of jogadoresExistentes) {
        const nn = this.normName(j.nome_normalizado || "");
        if (nn) jogadorPorNomeNorm.set(nn, j);
        const nr = this.normName(j.nome || "");
        if (nr) jogadorPorNomeRaw.set(nr, j);
      }
      const usuarioPorNomeNorm = new Map<string, UsuarioAdm>();
      for (const u of usuariosPossiveis) {
        const key = this.normName((u as any).nome_normalizado || (u as any).nome || "");
        if (key) usuarioPorNomeNorm.set(key, u);
      }

      const participantes = jogadoresInput.map((jogador) => {
        const nomeNorm = this.normName(jogador.nome);
        const jogadorExistente =
          jogadorPorNomeNorm.get(nomeNorm) || jogadorPorNomeRaw.get(nomeNorm) || null;
        const levelPontosAtual = Number(jogadorExistente?.level_pontos || 0);
        const levelAtual = Number(
          jogadorExistente?.level ||
            LevelService.getLevelPorPontos(levelPontosAtual).level
        );
        return {
          ...jogador,
          nomeNorm,
          vitoria: jogador._time === timeVencedor,
          jogadorExistente,
          usuarioPossivel: usuarioPorNomeNorm.get(nomeNorm) || null,
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
        const { _time, nome, imagem, nomeNorm, vitoria, ...estatisticas } = p as any;
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
        pontosPartida += vitoria ? 20 : 10;

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

          let bonus = 0;
          if (novaQtdPartidas === 15) bonus = 20;
          else if (novaQtdPartidas === 20) bonus = 30;
          else if (novaQtdPartidas === 30) bonus = 40;
          else if (novaQtdPartidas === 40) bonus = 50;

          const pontosTotaisAnterior =
            Number(jogadorModel.pontos || 0) * (novaQtdPartidas - 1);
          const novoTotalPontos = pontosTotaisAnterior + pontosPartida + bonus;
          const mediaComBonus = novoTotalPontos / novaQtdPartidas;

          jogadorModel.qtd_partidas = novaQtdPartidas.toString();
          jogadorModel.pontos = mediaComBonus.toFixed(0);
          jogadorModel.level_pontos = levelResult.pontos_depois;
          jogadorModel.level = levelResult.level_depois.level;

          await jogadorModel.useTransaction(trx).save();
        } else {
          jogadorModel = await Jogadores.create(
            {
              nome,
              nome_normalizado: nomeNorm,
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

      // monta pivot com bônus por marcos
      const pivotData = jogadoresCriados.reduce((acc, j) => {
        const qtd = Number(j.origem.qtd_partidas); // apenas para calcular bônus
        let bonus = 0;
        if (qtd === 15) bonus = 20;
        else if (qtd === 20) bonus = 30;
        else if (qtd === 30) bonus = 40;
        else if (qtd === 40) bonus = 50;

        acc[j.id] = {
          nome: j.origem.nome,
          time: j.origem.time,
          kills: j.origem.kills,
          assistencias: j.origem.assistencias,
          mortes: j.origem.mortes,
          kda_player:
            j.origem.mortes > 0
              ? (j.origem.kills / j.origem.mortes).toFixed(2)
              : String(j.origem.kills),
          kast: Number(j.origem.kast),
          flash_assist: j.origem.flash_assist,
          first_kill: j.origem.first_kill,
          multi_kill: j.origem.multi_kill,
          adr: Number(j.origem.adr).toFixed(2),
          partida_ganha: j.origem.partida_ganha ? 1 : 0,
          vitorias: j.origem.partida_ganha ? 1 : 0,
          pontos: j.origem.pontos + bonus,
          level_delta: j.levelDelta,
          level_antes: j.levelAntes,
          level_depois: j.levelDepois,
        };
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
      const recompensasRows = Array.from(goldPorJogador.entries()).map(
        ([jogadorId, goldCreditado]) => ({
          partida_id: partida.id,
          jogador_id: jogadorId,
          gold_creditado: goldCreditado,
          created_at: nowSql,
          updated_at: nowSql,
        })
      );

      if (recompensasRows.length > 0) {
        await trx.table("tb_partidas_recompensas").insert(recompensasRows);
      }

      const idsGold = Array.from(goldPorJogador.keys());
      if (idsGold.length > 0) {
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

    if (!playerRaw) {
      const partidas = await Partidas.query().orderBy("data", "desc");
      return response.json(partidas);
    }

    const q = this.normName(playerRaw);

    const partidasFiltradas = await Database.from("tb_partidas as p")
      .innerJoin("tb_partidas_jogadores as pj", "pj.partidas_id", "p.id")
      .innerJoin("tb_jogadores as j", "j.id", "pj.jogadores_id")
      .whereRaw("LOWER(j.nome_normalizado) LIKE ? OR LOWER(j.nome) LIKE ?", [
        `%${q}%`,
        `%${q}%`,
      ])
      .orderBy("p.data", "desc")
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
