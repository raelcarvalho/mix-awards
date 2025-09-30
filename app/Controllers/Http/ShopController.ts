// app/Controllers/Http/ShopController.ts
import { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import Database from "@ioc:Adonis/Lucid/Database";
import { DateTime } from "luxon";
import CustomResponse from "App/Utils/CustomResponse";
import Jogadores from "App/Models/Jogadores";
import Pacotes from "App/Models/Pacotes";
import Capsulas from "App/Models/Capsulas";

const PRECO_PACOTE = 20;
const PRECO_CAPSULA = 10;
const ITENS_POR_PACOTE = 4;
const ITENS_POR_CAPSULA = 1;
const MAX_COMPRA_POR_VEZ = 50;
const MAX_COMPRA_CAPSULAS = 50;

export default class ShopController {
  protected customResponse = new CustomResponse();

  // ===== Helpers adicionais para bloquear compra se álbum completo =====
  private async ensureAlbumId(jogadorId: number): Promise<number> {
    const existente = await Database.from("tb_album")
      .where("jogador_id", jogadorId)
      .first();

    if (existente?.id) return Number(existente.id);

    const inserted = await Database.table("tb_album")
      .insert({
        jogador_id: jogadorId,
        created_at: DateTime.now().toSQL(),
        updated_at: DateTime.now().toSQL(),
      })
      .returning("id");

    const albumId = Array.isArray(inserted)
      ? Number((inserted[0] as any)?.id ?? inserted[0])
      : Number(inserted);

    return albumId;
  }

  private async getAlbumStatus(
    jogadorId: number
  ): Promise<{ completo: boolean; obtidas: number; total: number }> {
    const albumId = await this.ensureAlbumId(jogadorId);

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
    return { completo: total > 0 && obtidas >= total, obtidas, total };
  }

  // ===== Criação sem trx (já existente) =====
  private async criarPacoteSemTrx(jogadorId: number): Promise<number> {
    try {
      const p = await Pacotes.create({
        jogador_id: jogadorId,
        preco_gold: PRECO_PACOTE,
        qtd_itens: ITENS_POR_PACOTE,
        status: "fechado" as any,
      });
      return p.id;
    } catch (e: any) {
      if (e?.code === "42703") {
        const [row] = await Database.table("tb_pacotes")
          .insert({
            jogador_id: jogadorId,
            preco: PRECO_PACOTE,
            itens: ITENS_POR_PACOTE,
            status: "fechado",
          })
          .returning("id");
        return row?.id ?? row;
      }
      throw e;
    }
  }

  private async criarCapsulaSemTrx(jogadorId: number): Promise<number> {
    try {
      const c = await Capsulas.create({
        jogador_id: jogadorId,
        preco_gold: PRECO_CAPSULA,
        qtd_itens: ITENS_POR_CAPSULA,
        status: "fechado" as any,
      });
      return c.id;
    } catch (e: any) {
      if (e?.code === "42703") {
        const [row] = await Database.table("tb_capsulas")
          .insert({
            jogador_id: jogadorId,
            preco: PRECO_CAPSULA,
            itens: ITENS_POR_CAPSULA,
            status: "fechado",
          })
          .returning("id");
        return row?.id ?? row;
      }
      throw e;
    }
  }

  // ===== COMPRAR PACOTES =====
  public async comprarPacotes({
    auth,
    request,
    response,
  }: HttpContextContract) {
    const user = await auth.authenticate();
    const quantidade = Number(request.input("quantidade", 1));

    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      return this.customResponse.erro(
        response,
        "Quantidade inválida.",
        {},
        400
      );
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

      // 🔒 Guard: impede compra se álbum completo
      const { completo, obtidas, total } = await this.getAlbumStatus(
        jogador.id
      );
      if (completo) {
        return this.customResponse.erro(
          response,
          `Álbum completo (${obtidas}/${total}). Você já possui todas as figurinhas.`,
          { albumCompleto: true, progresso: { obtidas, total } },
          409
        );
      }

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
        const id = await this.criarPacoteSemTrx(jogador.id);
        pacoteIds.push(Number(id));
      }

      jogador.gold = (jogador.gold || 0) - custoTotal;
      await jogador.save();

      return this.customResponse.sucesso(
        response,
        "Pacotes comprados com sucesso.",
        {
          pacoteIds,
          gold_debitado: custoTotal,
          saldo_atual: jogador.gold,
          preco_pacote: PRECO_PACOTE,
          itens_por_pacote: ITENS_POR_PACOTE,
        }
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

  // ===== LISTAR PACOTES FECHADOS =====
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

  // ===== COMPRAR CÁPSULAS =====
  public async comprarCapsulas({
    auth,
    request,
    response,
  }: HttpContextContract) {
    const user = await auth.authenticate();
    const quantidade = Number(request.input("quantidade", 1));

    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      return this.customResponse.erro(
        response,
        "Quantidade inválida.",
        {},
        400
      );
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

      // 🔒 Guard: impede compra se álbum completo
      const { completo, obtidas, total } = await this.getAlbumStatus(
        jogador.id
      );
      if (completo) {
        return this.customResponse.erro(
          response,
          `Álbum completo (${obtidas}/${total}). Você já possui todas as figurinhas.`,
          { albumCompleto: true, progresso: { obtidas, total } },
          409
        );
      }

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
        const id = await this.criarCapsulaSemTrx(jogador.id);
        capsulaIds.push(Number(id));
      }

      jogador.gold = (jogador.gold || 0) - custoTotal;
      await jogador.save();

      return this.customResponse.sucesso(
        response,
        "Capsulas compradas com sucesso.",
        {
          capsulaIds,
          gold_debitado: custoTotal,
          saldo_atual: jogador.gold,
          preco_capsula: PRECO_CAPSULA,
          itens_por_capsula: ITENS_POR_CAPSULA,
        }
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

  // ===== LISTAR CÁPSULAS FECHADAS =====
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
