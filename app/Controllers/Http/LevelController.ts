import { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import Jogadores from "App/Models/Jogadores";
import { LevelService } from "App/Systems/Level/LevelService";

export default class LevelController {
  public async lista({ response }: HttpContextContract) {
    return response.ok({
      sucesso: true,
      resultados: LevelService.listarLevels(),
    });
  }

  public async jogador({ params, response }: HttpContextContract) {
    const jogador = await Jogadores.find(params.id);
    if (!jogador) {
      return response.notFound({
        sucesso: false,
        mensagem: "Jogador nao encontrado",
      });
    }

    const pontos = Number(jogador.level_pontos || 0);
    const level = LevelService.getLevelPorPontos(pontos);
    const progresso = LevelService.getProgressoLevel(pontos);

    return response.ok({
      sucesso: true,
      resultados: {
        jogador_id: jogador.id,
        nome: jogador.nome,
        pontos_totais: pontos,
        level: level.level,
        level_nome: level.nome,
        tier: level.tier,
        progresso,
      },
    });
  }

  public async simular({ request, response }: HttpContextContract) {
    const dados = request.only([
      "jogador_id",
      "kills",
      "deaths",
      "assists",
      "adr",
      "partida_ganha",
      "levels_adversarios",
    ]);

    const jogadorId = Number(dados.jogador_id || 0);
    if (!jogadorId) {
      return response.badRequest({
        sucesso: false,
        mensagem: "jogador_id invalido",
      });
    }

    const jogador = await Jogadores.find(jogadorId);
    if (!jogador) {
      return response.notFound({
        sucesso: false,
        mensagem: "Jogador nao encontrado",
      });
    }

    const nivelMedioAdv = LevelService.calcularNivelMedioTime(
      Array.isArray(dados.levels_adversarios)
        ? dados.levels_adversarios.map((v: any) => Number(v) || 0)
        : []
    );

    const levelAtual = LevelService.getLevelPorPontos(
      Number(jogador.level_pontos || 0)
    );

    const resultado = LevelService.calcularPontos(
      {
        kills: Number(dados.kills || 0),
        deaths: Number(dados.deaths || 0),
        assists: Number(dados.assists || 0),
        adr: Number(dados.adr || 0),
        partida_ganha: Boolean(dados.partida_ganha),
      },
      {
        meu_level: levelAtual.level,
        nivel_medio_adversarios: nivelMedioAdv,
      },
      Number(jogador.level_pontos || 0)
    );

    return response.ok({ sucesso: true, resultados: resultado });
  }
}
