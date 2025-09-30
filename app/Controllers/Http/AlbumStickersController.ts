import { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import { DateTime } from "luxon";

import CustomResponse from "App/Utils/CustomResponse";
import Jogadores from "App/Models/Jogadores";
import Stickers from "App/Models/Stickers";
import AlbumAssinaturas from "App/Models/AlbumAssinaturas";
import AlbumStickers from "App/Models/AlbumStickers";
import Database from "@ioc:Adonis/Lucid/Database";

const TOTAL_STICKERS = 24;
const REVEAL_PRICE_GOLD = 30;

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

  private async getRevealedSlots(
    albumAssinaturasId: number
  ): Promise<number[]> {
    try {
      const rows = await Database.from("tb_album_revelacoes")
        .where("album_assinaturas_id", albumAssinaturasId)
        .select("slot");
      return rows.map((r) => Number(r.slot));
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("relation") || e?.code === "42P01") return [];
      return [];
    }
  }

  public async revelados({ auth, response }: HttpContextContract) {
    try {
      const usuario = await auth.authenticate();
      const jogador = await Jogadores.query()
        .where("usuario_adm_id", usuario.id)
        .firstOrFail();

      const albumAssinaturasId = await this.ensureAlbumStickers(jogador.id);
      const slots = await this.getRevealedSlots(albumAssinaturasId);

      return this.customResponse.sucesso(response, "Slots revelados.", {
        slots,
      });
    } catch (error) {
      return this.customResponse.erro(
        response,
        "Erro ao carregar slots revelados.",
        error,
        500
      );
    }
  }

  public async revelar({ auth, request, response }: HttpContextContract) {
    try {
      const usuario = await auth.authenticate();
      const { slot } = request.only(["slot"]);

      const nSlot = Number(slot);
      if (!Number.isFinite(nSlot) || nSlot < 1 || nSlot > TOTAL_STICKERS) {
        return this.customResponse.erro(response, "Slot inválido.", {}, 400);
      }

      // jogador + álbum de stickers (assinaturas)
      const jogador = await Jogadores.query()
        .where("usuario_adm_id", usuario.id)
        .firstOrFail();

      const albumAssinaturasId = await this.ensureAlbumStickers(jogador.id);

      // já revelado? não cobra de novo
      const jaTem = await Database.from("tb_album_revelacoes")
        .where({ album_assinaturas_id: albumAssinaturasId, slot: nSlot })
        .first();

      if (jaTem) {
        return this.customResponse.sucesso(response, "Slot já revelado.", {
          slot: nSlot,
          saldoGoldAtual: jogador.gold,
        });
      }

      let saldoApos: number | null = null;

      await Database.transaction(async (trx) => {
        // 1) Debita gold de forma atômica
        const now = DateTime.now().toSQL();
        const deb = await trx.rawQuery(
          `
        UPDATE tb_jogadores
           SET gold = gold - ?, updated_at = ?
         WHERE id = ? AND gold >= ?
      RETURNING gold
      `,
          [REVEAL_PRICE_GOLD, now, jogador.id, REVEAL_PRICE_GOLD]
        );

        if (!deb.rows?.length) {
          throw new Error("SALDO_INSUFICIENTE");
        }

        saldoApos = Number(deb.rows[0].gold);

        // 2) Registra a revelação (idempotente) com album_assinaturas_id
        await trx.rawQuery(
          `
        INSERT INTO tb_album_revelacoes (album_assinaturas_id, slot)
             VALUES (?, ?)
        ON CONFLICT (album_assinaturas_id, slot) DO NOTHING
      `,
          [albumAssinaturasId, nSlot]
        );
      });

      return this.customResponse.sucesso(
        response,
        "Sticker do slot revelado com sucesso.",
        {
          slot: nSlot,
          precoGold: REVEAL_PRICE_GOLD,
          saldoGoldAtual: saldoApos,
        }
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
      console.error("[AlbumStickersController.revelar] erro:", error);
      return this.customResponse.erro(
        response,
        "Erro ao revelar sticker.",
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
}
