import { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import Application from "@ioc:Adonis/Core/Application";
import CustomResponse from "App/Utils/CustomResponse";
import Figurinhas from "App/Models/Figurinhas";

export default class FigurinhasController {
  protected customResponse: CustomResponse;

  constructor() {
    this.customResponse = new CustomResponse();
  }

  /**
   * GET /api/figurinhas
   * Filtros opcionais: ?ativo=true|false&busca=nome
   */
  public async listar({ auth, request, response }: HttpContextContract) {
    await auth.authenticate();

    try {
      const ativo = request.input("ativo");
      const busca = (request.input("busca") || "").toString().trim();

      const query = Figurinhas.query().orderBy("id", "desc");

      if (ativo === "true") query.where("ativo", true);
      if (ativo === "false") query.where("ativo", false);
      if (busca) query.whereILike("nome", `%${busca}%`);

      const figurinhas = await query;
      return this.customResponse.sucesso(response, "Figurinhas listadas.", { figurinhas });
    } catch (error) {
      return this.customResponse.erro(response, "Erro ao listar figurinhas.", error, 500);
    }
  }

  /**
   * GET /api/figurinhas/:id
   */
  public async mostrar({ auth, params, response }: HttpContextContract) {
    await auth.authenticate();

    try {
      const registro = await Figurinhas.findOrFail(Number(params.id));
      return this.customResponse.sucesso(response, "Figurinha encontrada.", { figurinha: registro });
    } catch (error) {
      return this.customResponse.erro(response, "Figurinha não encontrada.", error, 404);
    }
  }

  /**
   * POST /api/figurinhas
   * Body: imagem(file), nome(string), raridade("normal", "epica", "lendaria")
   * (método que estava no AlbumController → mover para cá)
   */
  public async cadastrar({ auth, request, response }: HttpContextContract) {
    await auth.authenticate();

    try {
      const imagem = request.file("imagem", {
        size: "2mb",
        extnames: ["jpg", "jpeg", "png", "webp"],
      });
      const nome: string = (request.input("nome") || "").toString().trim();
      const raridade: string = (request.input("raridade") || "").toString().trim();

      if (!imagem || !nome || !["normal", "epica", "lendaria"].includes(raridade)) {
        return this.customResponse.erro(
          response,
          "Campos inválidos. Envie imagem, nome e raridade (normal|epica|lendaria).",
          {},
          400
        );
      }
      if (!imagem.isValid) {
        return this.customResponse.erro(response, "Imagem inválida.", imagem.errors, 400);
      }

      // Opcional: garantir nome único (ajuste conforme sua regra)
      const jaExiste = await Figurinhas.query().whereRaw("LOWER(nome) = LOWER(?)", [nome]).first();
      if (jaExiste) {
        return this.customResponse.erro(response, "Já existe figurinha com esse nome.", {}, 409);
      }

      const fileName = `${Date.now()}_${imagem.clientName}`;
      await imagem.move(Application.publicPath("uploads/figurinhas"), {
        name: fileName,
        overwrite: false,
      });

      const registro = await Figurinhas.create({
        nome,
        imagem: `/uploads/figurinhas/${fileName}`,
        raridade: raridade as any,
        ativo: true,
      });

      return this.customResponse.sucesso(response, "Figurinha criada com sucesso.", { figurinha: registro }, 201);
    } catch (error) {
      return this.customResponse.erro(response, "Erro ao cadastrar figurinha.", error, 500);
    }
  }

  /**
   * PUT /api/figurinhas/:id
   * Body: nome?(string), raridade?("normal", "epica", "lendaria"), imagem?(file)
   */
  public async atualizar({ auth, params, request, response }: HttpContextContract) {
    await auth.authenticate();

    try {
      const id = Number(params.id);
      const registro = await Figurinhas.findOrFail(id);

      const nome: string | undefined = request.input("nome");
      const raridade: string | undefined = request.input("raridade");

      if (nome) registro.nome = nome.toString().trim();
      if (raridade) {
        const r = raridade.toString().trim();
        if (!["normal", "epica", "lendaria"].includes(r)) {
          return this.customResponse.erro(response, "Raridade inválida.", {}, 400);
        }
        // @ts-ignore
        registro.raridade = r;
      }

      const imagem = request.file("imagem", {
        size: "2mb",
        extnames: ["jpg", "jpeg", "png", "webp"],
      });
      if (imagem) {
        if (!imagem.isValid) {
          return this.customResponse.erro(response, "Imagem inválida.", imagem.errors, 400);
        }
        const fileName = `${Date.now()}_${imagem.clientName}`;
        await imagem.move(Application.publicPath("uploads/figurinhas"), {
          name: fileName,
          overwrite: false,
        });
        registro.imagem = `/uploads/figurinhas/${fileName}`;
      }

      await registro.save();
      return this.customResponse.sucesso(response, "Figurinha atualizada.", { figurinha: registro });
    } catch (error) {
      return this.customResponse.erro(response, "Erro ao atualizar figurinha.", error, 500);
    }
  }

  /**
   * PATCH /api/figurinhas/:id/status
   * Body: ativo:boolean
   * (soft delete/reativar)
   */
  public async alterarStatus({ auth, params, request, response }: HttpContextContract) {
    await auth.authenticate();

    try {
      const id = Number(params.id);
      const ativo = request.input("ativo");

      if (typeof ativo !== "boolean" && !["true", "false"].includes(String(ativo))) {
        return this.customResponse.erro(response, "Valor de 'ativo' inválido.", {}, 400);
      }

      const registro = await Figurinhas.findOrFail(id);
      registro.ativo = String(ativo) === "true" || ativo === true;
      await registro.save();

      return this.customResponse.sucesso(response, "Status alterado.", { figurinha: registro });
    } catch (error) {
      return this.customResponse.erro(response, "Erro ao alterar status.", error, 500);
    }
  }

  /**
   * DELETE /api/figurinhas/:id
   * (remoção definitiva – use com cautela; se preferir só PATCH status)
   */
  public async excluir({ auth, params, response }: HttpContextContract) {
    await auth.authenticate();

    try {
      const id = Number(params.id);
      const registro = await Figurinhas.findOrFail(id);
      await registro.delete();

      return this.customResponse.sucesso(response, "Figurinha excluída.", {});
    } catch (error) {
      return this.customResponse.erro(response, "Erro ao excluir figurinha.", error, 500);
    }
  }
}
