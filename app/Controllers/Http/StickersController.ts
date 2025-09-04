// app/Controllers/Http/CapsulasController.ts
import { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import CustomResponse from "App/Utils/CustomResponse";
import Stickers from "App/Models/Stickers";
import AlbumAssinaturas from "App/Models/AlbumAssinaturas";
import Application from "@ioc:Adonis/Core/Application";

export default class StickersController {
  protected customResponse: CustomResponse;

  constructor() {
    this.customResponse = new CustomResponse();
  }

  private async ensureAlbumAssinatura(jogadorId: number) {
    const assinatura =
      (await AlbumAssinaturas.query().where("jogador_id", jogadorId).first()) ||
      (await AlbumAssinaturas.create({ jogador_id: jogadorId }));
    return assinatura;
  }

  public async listar({ auth, request, response }: HttpContextContract) {
    await auth.authenticate();

    try {
      const ativo = request.input("ativo");
      const busca = (request.input("busca") || "").toString().trim();

      const query = Stickers.query().orderBy("id", "desc");

      if (ativo === "true") query.where("ativo", true);
      if (ativo === "false") query.where("ativo", false);
      if (busca) query.whereILike("nome", `%${busca}%`);

      const stickers = await query;
      return this.customResponse.sucesso(response, "Stickers listados.", {
        stickers,
      });
    } catch (error) {
      return this.customResponse.erro(
        response,
        "Erro ao listar stickers.",
        error,
        500
      );
    }
  }

  public async cadastrar({ auth, request, response }: HttpContextContract) {
    await auth.authenticate();

    try {
      const imagem = request.file("imagem", {
        size: "2mb",
        extnames: ["jpg", "jpeg", "png", "webp"],
      });
      const nome: string = (request.input("nome") || "").toString().trim();

      if (!imagem || !nome) {
        return this.customResponse.erro(
          response,
          "Campos inválidos. Envie imagem e nome.",
          {},
          400
        );
      }
      if (!imagem.isValid) {
        return this.customResponse.erro(
          response,
          "Imagem inválida.",
          imagem.errors,
          400
        );
      }

      const jaExiste = await Stickers.query()
        .whereRaw("LOWER(nome) = LOWER(?)", [nome])
        .first();
      if (jaExiste) {
        return this.customResponse.erro(
          response,
          "Já existe sticker com esse nome.",
          {},
          409
        );
      }

      const fileName = `${Date.now()}_${imagem.clientName}`;
      await imagem.move(Application.publicPath("uploads/stickers"), {
        name: fileName,
        overwrite: false,
      });

      const registro = await Stickers.create({
        nome,
        imagem: `/uploads/stickers/${fileName}`,
        ativo: true,
      });

      return this.customResponse.sucesso(
        response,
        "Sticker criado com sucesso.",
        { sticker: registro },
        201
      );
    } catch (error) {
      return this.customResponse.erro(
        response,
        "Erro ao cadastrar sticker.",
        error,
        500
      );
    }
  }
}
