// app/Controllers/Http/ShopController.ts
import { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import Database from "@ioc:Adonis/Lucid/Database";
import { DateTime } from "luxon";
import CustomResponse from "App/Utils/CustomResponse";
import Jogadores from "App/Models/Jogadores";
import Pacotes from "App/Models/Pacotes";
import Capsulas from "App/Models/Capsulas";
import PartidasJogadores from "App/Models/PartidasJogadores";

const PRECO_PACOTE = 20;
const ITENS_POR_PACOTE = 4;
const MAX_COMPRA_POR_VEZ = 50;
const PRECO_BONUS_PONTOS = 100;
const BONUS_PONTOS = 10;

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

  // COMPRAR BONUS POR PARTIDA
  public async comprarBonusPontos({ auth, response }: HttpContextContract) {
    const user = await auth.authenticate();

    try {
      const jogador = await Jogadores.query()
        .where("usuario_adm_id", user.id)
        .firstOrFail();

      if ((jogador.gold || 0) < PRECO_BONUS_PONTOS) {
        return this.customResponse.erro(
          response,
          "Gold insuficiente.",
          {},
          400
        );
      }

      // Última partida do jogador na pivot tb_partidas_jogadores
      const ultimaPartidaJogador = await PartidasJogadores.query()
        .where("jogadores_id", jogador.id)
        .orderBy("id", "desc")
        .first();

      if (!ultimaPartidaJogador) {
        return this.customResponse.erro(
          response,
          "Nenhuma partida encontrada para adicionar pontos.",
          {},
          400
        );
      }

      // 'pontos' é string na pivot -> converter com segurança
      const pontosAtuais =
        parseInt(ultimaPartidaJogador.pontos ?? "0", 10) || 0;
      const novosPontos = pontosAtuais + BONUS_PONTOS;

      // Atualiza os pontos na própria pivot
      await PartidasJogadores.query()
        .where("id", ultimaPartidaJogador.id)
        .update({
          pontos: String(novosPontos),
          updated_at: DateTime.now().toSQL(),
        });

      // Debita o gold do jogador
      jogador.gold = (jogador.gold || 0) - PRECO_BONUS_PONTOS;
      await jogador.save();

      return this.customResponse.sucesso(
        response,
        `Bônus de pontos comprado com sucesso. ${BONUS_PONTOS} pontos adicionados na última partida.`,
        {
          saldo_atual: jogador.gold,
          pontos_adicionados: BONUS_PONTOS,
          preco: PRECO_BONUS_PONTOS,
        }
      );
    } catch (error) {
      return this.customResponse.erro(
        response,
        "Erro ao comprar bônus de pontos.",
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
}
