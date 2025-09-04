import { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import CustomResponse from "App/Utils/CustomResponse";
import Jogadores from "App/Models/Jogadores";
import Pacotes from "App/Models/Pacotes";
import Capsulas from "App/Models/Capsulas";

// Se quiser, leve para .env depois
const PRECO_PACOTE = 20;
const PRECO_CAPSULA = 10;
const ITENS_POR_PACOTE = 4;
const ITENS_POR_CAPSULA = 1;
const MAX_COMPRA_POR_VEZ = 50;
const MAX_COMPRA_CAPSULAS = 50;

export default class ShopController {
  protected customResponse: CustomResponse;

  constructor() {
    this.customResponse = new CustomResponse();
  }

  public async comprarPacotes({ auth, request, response }: HttpContextContract) {
    const user = await auth.authenticate();

    const quantidade = Number(request.input("quantidade", 1));
    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      return this.customResponse.erro(response, "Quantidade inválida.", {}, 400);
    }
    if (quantidade > MAX_COMPRA_POR_VEZ) {
      return this.customResponse.erro(
        response,
        `Quantidade máxima por compra é ${MAX_COMPRA_POR_VEZ}.`,
        {},
        400
      );
    }

    try {
      const jogador = await Jogadores.query()
        .where("usuario_adm_id", user.id)
        .firstOrFail();

      const custoTotal = quantidade * PRECO_PACOTE;

      if ((jogador.gold || 0) < custoTotal) {
        return this.customResponse.erro(
          response,
          "Gold insuficiente.",
          {},
          400
        );
      }

      const pacoteIds: number[] = [];
      for (let i = 0; i < quantidade; i++) {
        const pacote = await Pacotes.create({
          jogador_id: jogador.id,
          preco_gold: PRECO_PACOTE,
          qtd_itens: ITENS_POR_PACOTE,
          status: "fechado" as any,
        });
        pacoteIds.push(pacote.id);
      }

      jogador.gold = (jogador.gold || 0) - custoTotal;
      await jogador.save();

      const payload = {
        pacoteIds,
        gold_debitado: custoTotal,
        saldo_atual: jogador.gold,
        preco_pacote: PRECO_PACOTE,
        itens_por_pacote: ITENS_POR_PACOTE,
      };

      return this.customResponse.sucesso(
        response,
        "Pacotes comprados com sucesso.",
        payload
      );
    } catch (error) {
      return this.customResponse.erro(
        response,
        "Erro ao comprar pacotes.",
        error,
        500
      );
    }
  }

  public async listarPacotesFechados({ auth, response }: HttpContextContract) {
    const user = await auth.authenticate();

    try {
      const jogador = await Jogadores.query()
        .where("usuario_adm_id", user.id)
        .firstOrFail();

      const pacotes = await Pacotes.query()
        .where("jogador_id", jogador.id)
        .andWhere("status", "fechado")
        .orderBy("id", "desc");

      return this.customResponse.sucesso(
        response,
        "Pacotes fechados listados.",
        { pacotes }
      );
    } catch (error) {
      return this.customResponse.erro(
        response,
        "Erro ao listar pacotes fechados.",
        error,
        500
      );
    }
  }

  public async comprarCapsulas({ auth, request, response }: HttpContextContract) {
    const user = await auth.authenticate();

    const quantidade = Number(request.input("quantidade", 1));
    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      return this.customResponse.erro(response, "Quantidade inválida.", {}, 400);
    }
    if (quantidade > MAX_COMPRA_CAPSULAS) {
      return this.customResponse.erro(
        response,
        `Quantidade máxima por compra é ${MAX_COMPRA_CAPSULAS}.`,
        {},
        400
      );
    }

    try {
      const jogador = await Jogadores.query()
        .where("usuario_adm_id", user.id)
        .firstOrFail();

      const custoTotal = quantidade * PRECO_CAPSULA;

      if ((jogador.gold || 0) < custoTotal) {
        return this.customResponse.erro(
          response,
          "Gold insuficiente.",
          {},
          400
        );
      }

      const capsulaIds: number[] = [];
      for (let i = 0; i < quantidade; i++) {
        const capsulas = await Capsulas.create({
          jogador_id: jogador.id,
          preco_gold: PRECO_CAPSULA,
          qtd_itens: ITENS_POR_CAPSULA,
          status: "fechado" as any,
        });
        capsulaIds.push(capsulas.id);
      }

      jogador.gold = (jogador.gold || 0) - custoTotal;
      await jogador.save();

      const payload = {
        capsulaIds,
        gold_debitado: custoTotal,
        saldo_atual: jogador.gold,
        preco_capsula: PRECO_CAPSULA,
        itens_por_capsula: ITENS_POR_CAPSULA,
      };

      return this.customResponse.sucesso(
        response,
        "Capsulas compradas com sucesso.",
        payload
      );
    } catch (error) {
      return this.customResponse.erro(
        response,
        "Erro ao comprar capsulas.",
        error,
        500
      );
    }
  }

   public async listarCapsulasFechadas({ auth, response }: HttpContextContract) {
    const user = await auth.authenticate();

    try {
      const jogador = await Jogadores.query()
        .where("usuario_adm_id", user.id)
        .firstOrFail();

      const capsulas = await Capsulas.query()
        .where("jogador_id", jogador.id)
        .andWhere("status", "fechado")
        .orderBy("id", "desc");

      return this.customResponse.sucesso(
        response,
        "Capsulas fechadas listadas.",
        { capsulas }
      );
    } catch (error) {
      return this.customResponse.erro(
        response,
        "Erro ao listar capsulas fechadas.",
        error,
        500
      );
    }
  }
}
