import { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import { DateTime } from "luxon";
import Partidas from "App/Models/Partidas";
import PartidasRecompensas from "App/Models/PartidasRecompensas";
import CustomResponse from "App/Utils/CustomResponse";

export default class RecompensaController {
  protected customResponse: CustomResponse;

  constructor() {
    this.customResponse = new CustomResponse();
  }

  public async creditarPosPartida({params,response,auth,}: HttpContextContract) {
    await auth.authenticate();
    
    const partidaId = Number(params.id);
    if (!partidaId) {
      return this.customResponse.erro(response, "Parâmetro de partida inválido.", partidaId, 400);
    }

    try {
      const partida = await Partidas.query()
        .where("id", partidaId)
        .preload("jogadores", (q) => {
          q.pivotColumns(["partida_ganha"]);
        })
        .firstOrFail();

      for (const jogador of partida.jogadores) {
        const ganhou = !!(
          jogador.$extras?.pivot_partida_ganha ?? jogador.$extras?.partida_ganha
        );
        const gold = ganhou ? 25 : 18;

        const recompensaExistente = await PartidasRecompensas.query()
          .where("partida_id", partida.id)
          .where("jogador_id", jogador.id)
          .first();

        if (!recompensaExistente) {
          const novaRecompensa = new PartidasRecompensas();
          novaRecompensa.partida_id = partida.id;
          novaRecompensa.jogador_id = jogador.id;
          novaRecompensa.gold_creditado = gold;
          novaRecompensa.createdAt = DateTime.now();
          await novaRecompensa.save();

          jogador.gold = (jogador.gold || 0) + gold;
          await jogador.save();
        }
      }

      return this.customResponse.sucesso(
        response,
        "Gold creditado com sucesso!",
        {}
      );
    } catch (error) {
      return this.customResponse.erro(
        response,
        "Houve um erro ao creditar gold!",
        error,
        500
      );
    }
  }
}
