import { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import Jogadores from "App/Models/Jogadores";
import UsuarioAdm from "App/Models/UsuarioAdm";
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
    const jogadores = await Jogadores.query().orderBy("kills", "desc");
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
          gold: Number(jogador.gold || 0), // <-- devolve o gold para o front
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
   * GET /api/jogadores/gold
   * Retorna o gold do jogador vinculado. Se não houver vínculo,
   * tenta localizar por nome_normalizado (case-insensitive) e já vincula.
   */
  public async meuGold({ auth, request, response }: HttpContextContract) {
    const user = await auth.authenticate();
    const usuarioId = Number(request.input("usuario_id") ?? user.id);

    // 1) tenta por vínculo direto
    let jogador = await Jogadores.query()
      .where("usuario_adm_id", usuarioId)
      .first();

    // 2) se não achar, tenta por nome_normalizado (insensível a caixa/acentos)
    if (!jogador) {
      const ua = await UsuarioAdm.find(usuarioId);
      const chave = normalizeName(ua?.nome_normalizado || ua?.nome || "");

      if (chave) {
        jogador = await Jogadores.query()
          .whereRaw("LOWER(nome_normalizado) = ?", [chave]) // <--
          .orWhereRaw("LOWER(nome) = ?", [chave]) // fallback pelo nome "cru"
          .first();

        // se encontrou e não está preso a outro usuário, já vincula
        if (
          jogador &&
          (!jogador.usuario_adm_id ||
            Number(jogador.usuario_adm_id) === usuarioId)
        ) {
          jogador.usuario_adm_id = usuarioId;
          if (
            !jogador.nome_normalizado ||
            jogador.nome_normalizado.trim() === ""
          ) {
            jogador.nome_normalizado = chave;
          }
          await jogador.save();
        }
      }
    }

    if (!jogador) {
      return response.ok({
        gold: 0,
        mensagem: "Jogador não vinculado a este usuário.",
      });
    }

    return response.ok({
      gold: Number(jogador.gold || 0),
      jogador_id: jogador.id,
    });
  }
}
