import { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import Database from "@ioc:Adonis/Lucid/Database";
import { DateTime } from "luxon";

import CustomResponse from "App/Utils/CustomResponse";
import Jogadores from "App/Models/Jogadores";
import Figurinhas from "App/Models/Figurinhas";
import Pacotes from "App/Models/Pacotes";
import PackOpeningService from "App/Service/Album/PackOpeningService";

export default class AlbumController {
  protected customResponse: CustomResponse;

  constructor() {
    this.customResponse = new CustomResponse();
  }

  // ===== Helpers internos (sem services) =====
  private async ensureAlbum(jogadorId: number): Promise<number> {
    const existing = await Database.from("tb_album")
      .where("jogador_id", jogadorId)
      .first();

    if (existing?.id) return Number(existing.id);

    const inserted = await Database.table("tb_album")
      .insert({
        jogador_id: jogadorId,
        created_at: DateTime.now().toSQL(),
        updated_at: DateTime.now().toSQL(),
      })
      .returning("id");

    const albumId = Array.isArray(inserted)
      ? Number(inserted[0]?.id ?? inserted[0])
      : Number(inserted);
    return albumId;
  }

  // ===== NOVO: endpoint de status para a loja =====
  public async status({ auth, response }: HttpContextContract) {
    const usuario = await auth.authenticate();

    try {
      const jogador = await Jogadores.query()
        .where("usuario_adm_id", usuario.id)
        .firstOrFail();

      const albumId = await this.ensureAlbum(jogador.id);

      const totalRow = await Database.from("tb_figurinhas")
        .where("ativo", true)
        .count("* as c")
        .first();

      const obtidasRow = await Database.from("tb_album_figurinhas")
        .where("album_id", albumId)
        .count("* as c")
        .first();

      const total = Number(totalRow?.c || 0);
      const obtidas = Number(obtidasRow?.c || 0);
      const completo = total > 0 && obtidas >= total;

      return this.customResponse.sucesso(response, "Status do álbum.", {
        completo,
        progresso: { obtidas, total },
      });
    } catch (error) {
      return this.customResponse.erro(
        response,
        "Erro ao consultar status do álbum.",
        error,
        500
      );
    }
  }

  public async criarAlbum({ auth, response }: HttpContextContract) {
    await auth.authenticate();
    const usuario = auth.user as any;
    if (!usuario?.id) {
      return this.customResponse.erro(
        response,
        "Usuário não autenticado.",
        {},
        401
      );
    }

    try {
      const jogador = await Jogadores.query()
        .where("usuario_adm_id", Number(usuario.id))
        .first();

      if (!jogador) {
        return this.customResponse.erro(
          response,
          "Nenhum jogador vinculado a este usuário. Importe uma partida ou cadastre o jogador antes de criar o álbum.",
          {},
          400
        );
      }

      const existente = await Database.from("tb_album")
        .where("jogador_id", jogador.id)
        .first();

      if (existente?.id) {
        return this.customResponse.sucesso(response, "Álbum já existe.", {
          album_id: Number(existente.id),
          jogador_id: jogador.id,
        });
      }

      let albumId: number | null = null;
      try {
        const inserted = await Database.table("tb_album")
          .insert({
            jogador_id: jogador.id,
            created_at: DateTime.now().toSQL(),
            updated_at: DateTime.now().toSQL(),
          })
          .returning("id");

        albumId = Array.isArray(inserted)
          ? Number((inserted[0] as any)?.id ?? inserted[0])
          : Number(inserted);
      } catch (e: any) {
        if (e?.code === "23505") {
          const ja = await Database.from("tb_album")
            .where("jogador_id", jogador.id)
            .first();
          albumId = Number(ja?.id);
        } else {
          throw e;
        }
      }

      if (!albumId) {
        return this.customResponse.erro(
          response,
          "Não foi possível criar (ou localizar) o álbum.",
          {},
          500
        );
      }

      return this.customResponse.sucesso(
        response,
        "Álbum criado com sucesso.",
        { album_id: albumId, jogador_id: jogador.id },
        201
      );
    } catch (error) {
      console.error("[AlbumController.criarAlbum] erro:", error);
      return this.customResponse.erro(
        response,
        "Erro ao criar álbum.",
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
      const albumId = await this.ensureAlbum(jogador.id);

      const [todas, obtidas] = await Promise.all([
        Figurinhas.query()
          .where("ativo", true)
          .select("id", "nome", "imagem", "raridade", "slot")
          .orderBy("slot", "asc"),
        Database.from("tb_album_figurinhas")
          .where("album_id", albumId)
          .select("figurinha_id"),
      ]);

      const setObtidas = new Set<number>(
        obtidas.map((r: any) => Number(r.figurinha_id))
      );

      const payload = {
        progresso: { obtidas: setObtidas.size, total: todas.length },
        figurinhas: todas.map((f) => ({
          id: f.id,
          slot: f.slot ?? f.id,
          nome: f.nome,
          imagem: f.imagem,
          raridade: f.raridade,
          possui: setObtidas.has(f.id),
        })),
      };

      return this.customResponse.sucesso(response, "Álbum carregado.", payload);
    } catch (error) {
      return this.customResponse.erro(
        response,
        "Erro ao carregar álbum.",
        error,
        500
      );
    }
  }

  public async abrirPacote({ auth, response }: HttpContextContract) {
    const usuario = await auth.authenticate();

    try {
      const jogador = await Jogadores.query()
        .where("usuario_adm_id", usuario.id)
        .firstOrFail();

      const pacote = await Pacotes.query()
        .where("jogador_id", jogador.id)
        .andWhere("status", "fechado")
        .orderBy("id", "asc")
        .first();

      if (!pacote) {
        return this.customResponse.erro(
          response,
          "Você não possui pacotes fechados para abrir.",
          {},
          400
        );
      }

      const albumId = await this.ensureAlbum(jogador.id);
      const qtdItens = pacote.qtd_itens || 4;

      const todasAtivas = await Figurinhas.query()
        .select("id", "nome", "imagem", "raridade")
        .where("ativo", true);

      if (todasAtivas.length < qtdItens) {
        return this.customResponse.erro(
          response,
          "Figurinhas insuficientes para abrir o pacote.",
          {},
          400
        );
      }

      const cartas = PackOpeningService.sortearCartas(todasAtivas, qtdItens);

      const outcome = await PackOpeningService.registrarResultado(
        albumId,
        pacote.id,
        jogador.id,
        cartas
      );

      const payload = {
        pacoteId: pacote.id,
        novas: outcome.novas,
        duplicadas: outcome.duplicadas,
        goldVendidoTotal: outcome.goldVendidoTotal,
        saldoGoldAtual: outcome.saldoGoldAtual,
        progresso: { obtidas: outcome.progresso.obtidas, total: todasAtivas.length },
        mensagens: {
          novas: outcome.novas.length
            ? "Foi adicionada(s) nova(s) carta(s) ao seu álbum!"
            : "Nenhuma carta nova desta vez.",
          repetidas: outcome.duplicadas.length
            ? `Você vendeu ${outcome.duplicadas.length} carta(s) repetida(s) por ${outcome.goldVendidoTotal} gold.`
            : "Nenhuma figurinha repetida.",
        },
      };

      return this.customResponse.sucesso(
        response,
        "Pacote aberto com sucesso.",
        payload
      );
    } catch (error) {
      return this.customResponse.erro(
        response,
        "Erro ao abrir pacote.",
        error,
        500
      );
    }
  }
}
