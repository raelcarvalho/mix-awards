import { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";

import CustomResponse from "App/Utils/CustomResponse";
import Jogadores from "App/Models/Jogadores";
import CopaFigurinhas from "App/Models/CopaFigurinhas";
import CopaRevealService from "App/Service/Album/CopaRevealService";

export default class CopaController {
  protected customResponse: CustomResponse;

  constructor() {
    this.customResponse = new CustomResponse();
  }

  public async meuAlbum({ auth, response }: HttpContextContract) {
    const usuario = await auth.authenticate();

    try {
      const jogador = await Jogadores.query()
        .where("usuario_adm_id", usuario.id)
        .firstOrFail();

      const [todas, reveladas] = await Promise.all([
        CopaFigurinhas.query()
          .where("ativo", true)
          .select("id", "nome", "imagem", "raridade", "slot")
          .orderBy("slot", "asc"),
        CopaRevealService.getRevealedFigurinhaIds(jogador.id),
      ]);

      const setReveladas = new Set<number>(reveladas);

      const payload = {
        figurinhas: todas.map((f) => ({
          id: f.id,
          slot: f.slot,
          nome: f.nome,
          imagem: f.imagem,
          raridade: f.raridade,
          possui: true,
          revelada: setReveladas.has(f.id),
        })),
      };

      return this.customResponse.sucesso(response, "Álbum da Copa carregado.", payload);
    } catch (error) {
      return this.customResponse.erro(
        response,
        "Erro ao carregar álbum da Copa.",
        error,
        500
      );
    }
  }

  public async revelarCarta({ auth, request, response }: HttpContextContract) {
    try {
      const usuario = await auth.authenticate();
      const { figurinha_id } = request.only(["figurinha_id"]);

      const figurinhaId = Number(figurinha_id);
      if (!Number.isFinite(figurinhaId) || figurinhaId <= 0) {
        return this.customResponse.erro(response, "Figurinha inválida.", {}, 400);
      }

      const jogador = await Jogadores.query()
        .where("usuario_adm_id", usuario.id)
        .firstOrFail();

      const resultado = await CopaRevealService.revelarCarta(jogador.id, figurinhaId);

      return this.customResponse.sucesso(
        response,
        resultado.jaRevelada ? "Carta já revelada." : "Carta revelada com sucesso.",
        resultado
      );
    } catch (error: any) {
      if (error?.message === "SALDO_INSUFICIENTE") {
        return this.customResponse.erro(
          response,
          "Gold insuficiente para revelar.",
          {},
          400
        );
      }
      if (error?.message === "FIGURINHA_NAO_ENCONTRADA") {
        return this.customResponse.erro(
          response,
          "Figurinha não encontrada.",
          {},
          404
        );
      }
      console.error("[CopaController.revelarCarta] erro:", error);
      return this.customResponse.erro(
        response,
        "Erro ao revelar carta.",
        error,
        500
      );
    }
  }
}
