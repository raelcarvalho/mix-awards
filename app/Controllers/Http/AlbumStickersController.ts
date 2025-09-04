import { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import { DateTime } from "luxon";

import CustomResponse from "App/Utils/CustomResponse";
import Jogadores from "App/Models/Jogadores";
import Stickers from "App/Models/Stickers";
import Capsulas from "App/Models/Capsulas";
import CapsulasItens from "App/Models/CapsulasItens";
import AlbumAssinaturas from "App/Models/AlbumAssinaturas";
import AlbumStickers from "App/Models/AlbumStickers";

export default class AlbumStickersController {
  protected customResponse: CustomResponse;

  constructor() {
    this.customResponse = new CustomResponse();
  }

  private async ensureAlbumStickers(jogadorId: number): Promise<number> {
    const existente = await AlbumAssinaturas.query()
      .where("jogador_id", jogadorId)
      .first();
    if (existente?.id) return existente.id;

    const criado = await AlbumAssinaturas.create({ jogador_id: jogadorId });
    return criado.id;
  }

  private async addIfMissingStickers(
    albumAssinaturasId: number,
    stickerId: number
  ): Promise<boolean> {
    const existe = await AlbumStickers.query()
      .where("album_assinaturas_id", albumAssinaturasId)
      .andWhere("sticker_id", stickerId)
      .first();

    if (existe) return false; // Retorna false se o sticker já existe (é uma duplicata)

    await AlbumStickers.create({
      album_assinaturas_id: albumAssinaturasId,
      sticker_id: stickerId,
      obtida_via: "capsulas",
    });
    return true; // Retorna true se o sticker era novo e foi adicionado
  }

  private pickNUnique<T>(arr: T[], n: number): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, n);
  }

  // ... (seus outros métodos como criarAlbumSticker e meuAlbum permanecem iguais) ...
  public async criarAlbumSticker({ auth, response }: HttpContextContract) {
    await auth.authenticate();
    try {
      const usuario = auth.user!;
      const jogador = await Jogadores.query()
        .where("usuario_adm_id", Number(usuario.id))
        .first();

      if (!jogador) {
        return this.customResponse.erro(
          response,
          "Nenhum jogador vinculado a este usuário. Importe/cadastre o jogador antes de criar o álbum.",
          {},
          400
        );
      }

      const existente = await AlbumAssinaturas.query()
        .where("jogador_id", jogador.id)
        .first();
      if (existente?.id) {
        return this.customResponse.sucesso(
          response,
          "Álbum de stickers já existe.",
          {
            album_assinaturas_id: existente.id,
            jogador_id: jogador.id,
          }
        );
      }

      const novo = await AlbumAssinaturas.create({ jogador_id: jogador.id });
      return this.customResponse.sucesso(
        response,
        "Álbum de stickers criado com sucesso.",
        { album_assinaturas_id: novo.id, jogador_id: jogador.id },
        201
      );
    } catch (error) {
      return this.customResponse.erro(
        response,
        "Erro ao criar álbum de stickers.",
        error,
        500
      );
    }
  }

  public async meuAlbum({ auth, response }: HttpContextContract) {
    const usuario = await auth.authenticate();

    try {
      const jogador = await Jogadores.query()
        .where("usuario_adm_id", usuario.id)
        .firstOrFail();
      const albumAssinaturasId = await this.ensureAlbumStickers(jogador.id);

      const [todasAtivas, obtidas] = await Promise.all([
        Stickers.query()
          .where("ativo", true)
          .select("id", "nome", "imagem", "slot", "ordem")
          .orderBy("slot", "asc"),
        AlbumStickers.query()
          .where("album_assinaturas_id", albumAssinaturasId)
          .select("sticker_id"),
      ]);

      const setObtidas = new Set<number>(obtidas.map((r) => r.sticker_id));

      const payload = {
        progresso: {
          obtidas: setObtidas.size,
          total: todasAtivas.length,
        },
        stickers: todasAtivas.map((s) => ({
          id: s.id,
          slot: s.slot ?? s.id,
          ordem: s.ordem ?? s.id,
          nome: s.nome,
          imagem: s.imagem,
          possui: setObtidas.has(s.id),
        })),
      };

      return this.customResponse.sucesso(
        response,
        "Álbum de stickers carregado.",
        payload
      );
    } catch (error) {
      return this.customResponse.erro(
        response,
        "Erro ao carregar álbum de stickers.",
        error,
        500
      );
    }
  }

  public async abrirCapsulas({ auth, response }: HttpContextContract) {
    const usuario = await auth.authenticate();

    try {
      const jogador = await Jogadores.query()
        .where("usuario_adm_id", usuario.id)
        .firstOrFail();

      const capsula = await Capsulas.query()
        .where("jogador_id", jogador.id)
        .andWhere("status", "fechado")
        .orderBy("id", "asc")
        .first();

      if (!capsula) {
        return this.customResponse.erro(
          response,
          "Você não possui cápsulas fechadas para abrir.",
          {},
          400
        );
      }

      const albumAssinaturasId = await this.ensureAlbumStickers(jogador.id);
      const qtdItens = 1; // A roleta sempre sorteia 1 item

      const ativos = await Stickers.query()
        .where("ativo", true)
        .select("id", "nome", "imagem", "slot", "ordem");

      if (ativos.length < qtdItens) {
        return this.customResponse.erro(
          response,
          "Stickers insuficientes para abrir a cápsula.",
          {},
          400
        );
      }

      const sorteados = this.pickNUnique(ativos, qtdItens);

      const novas: Stickers[] = [];
      const duplicadas: Stickers[] = [];

      // =====================================================================
      // CORREÇÃO: Lógica de venda de duplicatas
      // =====================================================================
      const VALOR_VENDA_STICKER = 5;
      let goldVendidoTotal = 0;
      // =====================================================================

      for (const s of sorteados) {
        const colouAgora = await this.addIfMissingStickers(
          albumAssinaturasId,
          s.id
        );

        await CapsulasItens.create({
          capsulas_id: capsula.id,
          sticker_id: s.id,
          duplicada: !colouAgora,
        });

        if (colouAgora) {
          novas.push(s);
        } else {
          duplicadas.push(s);
          // =====================================================================
          // CORREÇÃO: Adiciona o valor do sticker duplicado ao total
          // =====================================================================
          goldVendidoTotal += VALOR_VENDA_STICKER;
          // =====================================================================
        }
      }

      // =====================================================================
      // CORREÇÃO: Atualiza o saldo de gold do jogador se houver venda
      // =====================================================================
      if (goldVendidoTotal > 0) {
        await Jogadores.query()
          .where("id", jogador.id)
          .increment("gold", goldVendidoTotal);
      }
      // =====================================================================

      capsula.status = "aberto";
      capsula.abertoEm = DateTime.now();
      await capsula.save();

      const [totalAtivos, coladasCount] = await Promise.all([
        Stickers.query().where("ativo", true).count("* as c"),
        AlbumStickers.query()
          .where("album_assinaturas_id", albumAssinaturasId)
          .count("* as c"),
      ]);
      const progresso = {
        obtidas: Number(coladasCount[0].$extras.c || 0),
        total: Number(totalAtivos[0].$extras.c || 0),
      };

      // =====================================================================
      // CORREÇÃO: Busca o jogador atualizado para retornar o novo saldo de gold
      // =====================================================================
      const jogadorAtualizado = await Jogadores.find(jogador.id);
      // =====================================================================

      const payload = {
        capsulaId: capsula.id,
        novas,
        duplicadas,
        progresso,
        // =====================================================================
        // CORREÇÃO: Adiciona as informações de venda ao payload da resposta
        // =====================================================================
        goldVendidoTotal,
        saldoGoldAtual: jogadorAtualizado?.gold,
        mensagens: {
          novas: novas.length
            ? "Sticker novo adicionado ao seu álbum!"
            : "Nenhum sticker novo desta vez.",
          repetidas: duplicadas.length
            ? `Você já possuía este sticker e ele foi vendido por ${goldVendidoTotal} gold.`
            : "Nenhum sticker repetido.",
        },
        // =====================================================================
      };

      return this.customResponse.sucesso(
        response,
        "Cápsula aberta com sucesso.",
        payload
      );
    } catch (error) {
      return this.customResponse.erro(
        response,
        "Erro ao abrir cápsula.",
        error,
        500
      );
    }
  }
}
