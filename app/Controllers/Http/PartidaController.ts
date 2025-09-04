import { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import Partidas from "App/Models/Partidas";
import Jogadores from "App/Models/Jogadores";
import CustomResponse from "App/Utils/CustomResponse";
import PartidasJogadores from "App/Models/PartidasJogadores";
import UsuarioAdm from "App/Models/UsuarioAdm";
import Database from "@ioc:Adonis/Lucid/Database";

export default class PartidaController {
  private customResponse = new CustomResponse();

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

    // -------- helper para resolver a URL do avatar ----------
    const resolveAvatarUrl = (j: any): string => {
      try {
        // 1) Tenta extrair do avatarHtml (já vem com _medium.*)
        const html: string = j?.player?.avatarHtml || "";
        const mHtml = html.match(
          /src="([^"]+_medium\.(?:jpg|jpeg|png|webp))"/i
        );
        if (mHtml?.[1]) return mHtml[1];

        // 2) Monta com player.avatar (+ extensão) -> domínio GC + _medium
        const avatar = j?.player?.avatar; // ex: "players/avatar/822181/822181"
        const ext = j?.player?.avatarExtension || "jpg";
        if (avatar && typeof avatar === "string") {
          // se já vier completo (http), só garante _medium
          if (/^https?:\/\//i.test(avatar)) {
            if (/_medium\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(avatar))
              return avatar;

            const hasExt = /\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(avatar);
            if (hasExt) {
              return avatar.replace(
                /\.(jpg|jpeg|png|webp)(\?.*)?$/i,
                `_medium.$1`
              );
            }
            return `${avatar}_medium.jpg`;
          }

          // caminho relativo da GC → prefixa domínio estático + _medium
          return `https://static.gamersclub.com.br/${avatar}_medium.${ext}`;
        }

        // 3) plAvatar (pode ser full URL da Steam ou caminho GC)
        const plAvatar = j?.plAvatar;
        if (plAvatar && typeof plAvatar === "string") {
          if (/^https?:\/\//i.test(plAvatar)) {
            // full URL (Steam/GC). Tenta garantir _medium
            if (/_medium\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(plAvatar))
              return plAvatar;

            const hasExt = /\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(plAvatar);
            if (hasExt) {
              return plAvatar.replace(
                /\.(jpg|jpeg|png|webp)(\?.*)?$/i,
                `_medium.$1`
              );
            }
            return `${plAvatar}_medium.jpg`;
          } else {
            // caminho relativo GC
            return `https://static.gamersclub.com.br/${plAvatar}_medium.jpg`;
          }
        }
      } catch {
        // ignora e cai no fallback
      }
      return "";
    };
    // --------------------------------------------------------

    const partida = await Partidas.create({
      ...data.partida,
      mapa: data.jogos.map_name,
      data: data.data,
      codigo: data.id,
      resultado_time1: data.jogos.score_a,
      resultado_time2: data.jogos.score_b,
      nome_time1: data.time_a,
      nome_time2: data.time_b,
    });

    const scoreA = Number(data.jogos.score_a);
    const scoreB = Number(data.jogos.score_b);

    let timeVencedor: "A" | "B" | null = null;
    if (scoreA > scoreB) timeVencedor = "A";
    else if (scoreB > scoreA) timeVencedor = "B";

    // monta input dos jogadores, já com a imagem resolvida
    const jogadoresInput = [
      ...data.jogos.players.team_a.map((j: any) => ({
        nome: j.player.nick,
        imagem: resolveAvatarUrl(j),
        adr: Number(j.adr),
        kills: Number(j.nb_kill),
        assistencias: Number(j.assist),
        mortes: Number(j.death),
        kda_player: j.kdr,
        kast: Number(j.pkast),
        flash_assist: Number(j.flash_assist),
        first_kill: Number(j.firstkill),
        multi_kill: Number(j.multikills),
        _time: "A",
      })),
      ...data.jogos.players.team_b.map((j: any) => ({
        nome: j.player.nick,
        imagem: resolveAvatarUrl(j),
        adr: Number(j.adr),
        kills: Number(j.nb_kill),
        assistencias: Number(j.assist),
        mortes: Number(j.death),
        kda_player: j.kdr,
        kast: Number(j.pkast),
        flash_assist: Number(j.flash_assist),
        first_kill: Number(j.firstkill),
        multi_kill: Number(j.multikills),
        _time: "B",
      })),
    ];

    const jogadoresCriados: { id: number; _time: string; origem: any }[] = [];

    for (const jogador of jogadoresInput) {
      const { _time, nome, imagem, ...estatisticas } = jogador;
      const vitoria = _time === timeVencedor;

      let jogadorModel = await Jogadores.findBy("nome", nome);

      // Vincular jogador ao usuário se nome_normalizado for igual
      if (jogadorModel && !jogadorModel.usuario_adm_id) {
        const nomeNorm = nome
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .trim();
        const usuario = await UsuarioAdm.query()
          .where("nome_normalizado", nomeNorm)
          .first();
        if (usuario) {
          jogadorModel.usuario_adm_id = usuario.id;
        }
      }

      let novaQtdPartidas = 1;
      let pontosPartida = 0;

      pontosPartida += estatisticas.kills;
      pontosPartida += estatisticas.first_kill;
      pontosPartida +=
        estatisticas.adr < 50 ? 5 : estatisticas.adr <= 100 ? 10 : 20;
      pontosPartida += vitoria ? 20 : 10;

      if (jogadorModel) {
        // Atualiza imagem só se ainda não houver (ou estiver vazia)
        if (
          (!jogadorModel.imagem || jogadorModel.imagem.trim() === "") &&
          imagem
        ) {
          jogadorModel.imagem = imagem;
        }

        novaQtdPartidas = Number(jogadorModel.qtd_partidas || 0) + 1;

        jogadorModel.kills = (
          Number(jogadorModel.kills || 0) + estatisticas.kills
        ).toString();
        jogadorModel.assistencias = (
          Number(jogadorModel.assistencias || 0) + estatisticas.assistencias
        ).toString();
        jogadorModel.mortes = (
          Number(jogadorModel.mortes || 0) + estatisticas.mortes
        ).toString();
        jogadorModel.kast = Number(jogadorModel.kast || 0) + estatisticas.kast;
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
          (Number(jogadorModel.adr || 0) * (novaQtdPartidas - 1) +
            estatisticas.adr) /
          novaQtdPartidas
        ).toFixed(2);

        let bonus = 0;
        if (novaQtdPartidas === 15) bonus = 20;
        else if (novaQtdPartidas === 20) bonus = 40;
        else if (novaQtdPartidas === 25) bonus = 60;
        else if (novaQtdPartidas === 30) bonus = 80;

        const pontosTotaisAnterior =
          Number(jogadorModel.pontos || 0) * (novaQtdPartidas - 1);
        const novoTotalPontos = pontosTotaisAnterior + pontosPartida + bonus;
        const mediaComBonus = novoTotalPontos / novaQtdPartidas;

        jogadorModel.qtd_partidas = novaQtdPartidas.toString();
        jogadorModel.pontos = mediaComBonus.toFixed(0);

        await jogadorModel.save();
      } else {
        // Cria já com a imagem
        jogadorModel = await Jogadores.create({
          nome,
          imagem: imagem || "",
          ...estatisticas,
          qtd_partidas: "1",
          pontos: pontosPartida.toString(),
          vitorias: vitoria ? "1" : "0",
        });
      }

      jogadoresCriados.push({
        id: jogadorModel.id,
        _time,
        origem: {
          ...estatisticas,
          nome,
          time: _time,
          vitorias: vitoria ? "1" : "0",
          pontos: pontosPartida,
          qtd_partidas: novaQtdPartidas,
        },
      });
    }

    const pivotData = jogadoresCriados.reduce((acc, jogador) => {
      const { id, origem } = jogador;

      let bonus = 0;
      const qtdPartidas = Number(origem.qtd_partidas);

      if (qtdPartidas === 15) bonus = 20;
      else if (qtdPartidas === 20) bonus = 40;
      else if (qtdPartidas === 25) bonus = 60;
      else if (qtdPartidas === 30) bonus = 80;

      acc[id] = {
        ...origem,
        pontos: origem.pontos + bonus,
      };

      return acc;
    }, {} as Record<number, any>);

    await partida.related("jogadores").attach(pivotData);

    return this.customResponse.sucesso(
      response,
      "Partida e jogadores importados com sucesso!",
      partida
    );
  }

  public async consultarPartidas({ response }: HttpContextContract) {
    const partidas = await Partidas.all();
    return response.json(partidas);
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

        // 1. Excluir registros da tabela tb_partidas_jogadores para a partida
        await trx
          .from("tb_partidas_jogadores")
          .where("partidas_id", partida.id)
          .delete();

        // 2. Excluir a partida da tabela tb_partidas
        await trx.from("tb_partidas").where("id", partida.id).delete();

        // 3. Recalcular estatísticas para os jogadores afetados
        if (jogadorIdsParaAtualizar.length > 0) {
          for (const jogadorId of jogadorIdsParaAtualizar) {
            const estatisticasAgregadas = await trx
              .from("tb_partidas_jogadores")
              .where("jogadores_id", jogadorId)
              .select(
                trx.raw(`
                  SUM(CAST(kills AS NUMERIC)) as total_kills,
                  SUM(CAST(assistencias AS NUMERIC)) as total_assistencias,
                  SUM(CAST(mortes AS NUMERIC)) as total_mortes,
                  SUM(CAST(kast AS NUMERIC)) as total_kast,
                  SUM(CAST(flash_assist AS NUMERIC)) as total_flash_assist,
                  SUM(CAST(first_kill AS NUMERIC)) as total_first_kill,
                  SUM(CAST(multi_kill AS NUMERIC)) as total_multi_kill,
                  SUM(CAST(adr AS NUMERIC)) as total_adr,
                  SUM(CAST(vitorias AS NUMERIC)) as total_vitorias,
                  COUNT(id) as total_qtd_partidas,
                  SUM(CAST(pontos AS NUMERIC)) as total_pontos
                `)
              )
              .first();

            const jogador = await Jogadores.query({ client: trx })
              .where("id", jogadorId)
              .first();

            if (jogador) {
              jogador.kills = (
                estatisticasAgregadas.total_kills || 0
              ).toString();
              jogador.assistencias = (
                estatisticasAgregadas.total_assistencias || 0
              ).toString();
              jogador.mortes = (
                estatisticasAgregadas.total_mortes || 0
              ).toString();
              jogador.kast = estatisticasAgregadas.total_kast || 0;
              jogador.flash_assist = (
                estatisticasAgregadas.total_flash_assist || 0
              ).toString();
              jogador.first_kill = (
                estatisticasAgregadas.total_first_kill || 0
              ).toString();
              jogador.multi_kill = (
                estatisticasAgregadas.total_multi_kill || 0
              ).toString();
              jogador.adr = (estatisticasAgregadas.total_adr || 0).toString();
              jogador.vitorias = (
                estatisticasAgregadas.total_vitorias || 0
              ).toString();
              jogador.qtd_partidas = (
                estatisticasAgregadas.total_qtd_partidas || 0
              ).toString();
              jogador.pontos = (
                estatisticasAgregadas.total_pontos || 0
              ).toString();

              // Recalcular KDA se necessário (assumindo que kda_player é calculado com base em kills, assistencias, mortes)
              // Exemplo simples de cálculo de KDA: (kills + assistencias) / mortes
              const killsNum = parseFloat(jogador.kills);
              const assistenciasNum = parseFloat(jogador.assistencias);
              const mortesNum = parseFloat(jogador.mortes);
              if (mortesNum > 0) {
                jogador.kda_player = (
                  (killsNum + assistenciasNum) /
                  mortesNum
                ).toFixed(2);
              } else {
                jogador.kda_player = (killsNum + assistenciasNum).toFixed(2); // Se mortes for 0, KDA é kills + assistencias
              }

              await jogador.save();
            }
          }

          // 4. Excluir jogadores que não têm mais partidas associadas
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
