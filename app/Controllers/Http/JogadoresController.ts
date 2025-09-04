import { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import Jogadores from "App/Models/Jogadores";
import CustomResponse from "App/Utils/CustomResponse";

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

  constructor() {
    this.customResponse = new CustomResponse();
  }

  public async listar({ response }: HttpContextContract) {
    const jogadores = await Jogadores.query().orderBy("kills", "desc"); // ou outra métrica
    return response.json(jogadores);
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

      // já vinculado a outro usuário?
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
   * Retorna a quantidade de gold do jogador autenticado
   * GET /api/jogador/gold
   */
  public async meuGold({ auth, response }: HttpContextContract) {
    const usuario = await auth.authenticate();
    const jogador = await Jogadores.query()
      .where("usuario_adm_id", usuario.id)
      .first();
    if (!jogador) {
      return this.customResponse.erro(response, "Jogador inválido.", {}, 400);
    }
    return this.customResponse.sucesso(
      response,
      "Gold do jogador listado com sucesso.",
      {
        gold: jogador.gold,
      }
    );
  }
}
