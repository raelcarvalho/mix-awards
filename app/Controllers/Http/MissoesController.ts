import { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import Jogadores from "App/Models/Jogadores";
import { MissionService } from "App/Systems/Missions/MissionService";
import CustomResponse from "App/Utils/CustomResponse";

export default class MissoesController {
  private customResponse = new CustomResponse();

  public async jogador({ params, response }: HttpContextContract) {
    try {
      const jogadorId = Number(params.id || 0);
      if (jogadorId <= 0) {
        return this.customResponse.erro(response, "Jogador inválido.", {}, 400);
      }

      const jogador = await Jogadores.find(jogadorId);
      if (!jogador) {
        return this.customResponse.erro(response, "Jogador não encontrado.", {}, 404);
      }

      const active = await MissionService.getPlayerMissions(jogadorId);
      return this.customResponse.sucesso(response, "Missões do jogador carregadas.", {
        jogador_id: jogadorId,
        ciclo: active.cycle,
        missoes: active.missions,
      });
    } catch (error) {
      return this.customResponse.erro(
        response,
        "Erro ao carregar missões do jogador.",
        error,
        500
      );
    }
  }
}

