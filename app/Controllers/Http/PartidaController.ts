import { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import Partidas from "App/Models/Partidas";
import Jogadores from "App/Models/Jogadores";
import CustomResponse from "App/Utils/CustomResponse";
import PartidasJogadores from "App/Models/PartidasJogadores";
import UsuarioAdm from "App/Models/UsuarioAdm";
import Database from "@ioc:Adonis/Lucid/Database";
import PartidasRecompensas from "App/Models/PartidasRecompensas";
import { DateTime } from "luxon";

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

      const jogadoresCriados: { id: number; _time: "A" | "B"; origem: any }[] =
        [];

      for (const jogador of jogadoresInput) {
        const { _time, nome, imagem, ...estatisticas } = jogador;
        const vitoria = _time === timeVencedor;
        const nomeNorm = this.normName(nome);

        // jogador existente (case-insensitive por nome_normalizado) ou pelo nome "cru"
        let jogadorModel =
          (await Jogadores.query({ client: trx })
            .whereRaw("LOWER(nome_normalizado) = ?", [nomeNorm])
            .orWhere("nome", nome)
            .first()) || null;

        // possível usuário-adm com o mesmo nome_normalizado
        const usuarioPossivel = await UsuarioAdm.query({ client: trx })
          .whereRaw("LOWER(nome_normalizado) = ?", [nomeNorm])
          .first();

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

        if (jogadorModel) {
          if (!jogadorModel.nome_normalizado)
            jogadorModel.nome_normalizado = nomeNorm;
          if (!jogadorModel.usuario_adm_id && usuarioPossivel) {
            jogadorModel.usuario_adm_id = usuarioPossivel.id;
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

          // bônus por marcos
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

          await jogadorModel.useTransaction(trx).save();
        } else {
          // cria normalizado e com vínculo ao usuário_adm (se houver)
          jogadorModel = await Jogadores.create(
            {
              nome,
              nome_normalizado: nomeNorm,
              usuario_adm_id: usuarioPossivel?.id,
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
            },
            { client: trx }
          );
        }

        jogadoresCriados.push({
          id: jogadorModel.id,
          _time,
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
        };
        return acc;
      }, {} as Record<number, any>);

      await partida.useTransaction(trx).related("jogadores").attach(pivotData);

      // crédito de gold (sem duplicar)
      for (const j of jogadoresCriados) {
        const ganhou = !!j.origem.partida_ganha;
        const gold = ganhou ? 25 : 18;

        const existe = await PartidasRecompensas.query({ client: trx })
          .where("partida_id", partida.id)
          .where("jogador_id", j.id)
          .first();

        if (!existe) {
          await PartidasRecompensas.create(
            {
              partida_id: partida.id,
              jogador_id: j.id,
              gold_creditado: gold,
              createdAt: DateTime.now(),
            },
            { client: trx }
          );

          const jogadorDb = await Jogadores.query({ client: trx })
            .where("id", j.id)
            .firstOrFail();
          jogadorDb.gold = (jogadorDb.gold || 0) + gold;
          await jogadorDb.useTransaction(trx).save();
        }
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
        "pj.pontos as pontos_jogador",
        "j.nome as jogador_nome"
      );

    return response.json(partidasFiltradas);
  }

  public async detalhesPartida({ params, response }: HttpContextContract) {
    const partida = await Partidas.findByOrFail("codigo", params.codigo);

    const jogadores = await PartidasJogadores.query()
      .where("partidas_id", partida.id)
      .preload("jogador", (q) => q.select(["id", "nome", "imagem"]));

    const jogadoresComNome = jogadores.map((j) => {
      const row = j.toJSON();
      row.jogadores_id = j.jogador?.nome || "Sem nome";
      row.jogador_imagem = j.jogador?.imagem || "";
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

        const jogadorIdsParaAtualizar = jogadoresIdsNaPartida.map((r) =>
          Number(r.jogadores_id)
        );

        // 1. Excluir registros da pivot
        await trx
          .from("tb_partidas_jogadores")
          .where("partidas_id", partida.id)
          .delete();

        // 2. Excluir a partida
        await trx.from("tb_partidas").where("id", partida.id).delete();

        // 3. Recalcular estatísticas para os jogadores afetados
        if (jogadorIdsParaAtualizar.length > 0) {
          for (const jogadorId of jogadorIdsParaAtualizar) {
            const est = await trx
              .from("tb_partidas_jogadores")
              .where("jogadores_id", jogadorId)
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
                AVG(CAST(pontos AS NUMERIC))                    as avg_points
              `)
              )
              .first();

            const jogador = await Jogadores.query({ client: trx })
              .where("id", jogadorId)
              .first();

            if (jogador) {
              const jogos = Number(est?.jogos || 0);
              const kills = Number(est?.sum_kills || 0);
              const mortes = Number(est?.sum_mortes || 0);
              const assists = Number(est?.sum_assists || 0);

              jogador.kills = String(kills);
              jogador.assistencias = String(assists);
              jogador.mortes = String(mortes);

              // KDR
              jogador.kda_player =
                mortes > 0 ? (kills / mortes).toFixed(2) : kills.toFixed(2);

              // médias (não somas!)
              jogador.kast = Math.round(Number(est?.avg_kast || 0));
              jogador.adr = Number(est?.avg_adr || 0).toFixed(2);

              // demais estatísticas
              jogador.flash_assist = String(Number(est?.sum_flash || 0));
              jogador.first_kill = String(Number(est?.sum_fk || 0));
              jogador.multi_kill = String(Number(est?.sum_mk || 0));

              jogador.vitorias = String(Number(est?.sum_wins || 0));
              jogador.qtd_partidas = String(jogos);

              // pontos → média por partida
              jogador.pontos = Math.round(
                Number(est?.avg_points || 0)
              ).toString();

              await jogador.useTransaction(trx).save();
            }
          }

          // 4. Excluir jogadores sem nenhuma partida
          const aindaComPartidas = await trx
            .from("tb_partidas_jogadores")
            .whereIn("jogadores_id", jogadorIdsParaAtualizar)
            .groupBy("jogadores_id")
            .count("* as c")
            .select("jogadores_id");

          const vivos = new Set(
            aindaComPartidas.map((r) => Number(r.jogadores_id))
          );
          const semPartidas = jogadorIdsParaAtualizar.filter(
            (id) => !vivos.has(id)
          );

          if (semPartidas.length > 0) {
            await Jogadores.query({ client: trx })
              .whereIn("id", semPartidas)
              .delete();
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
