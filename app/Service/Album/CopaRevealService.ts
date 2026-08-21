import { DateTime } from "luxon";

import Database from "@ioc:Adonis/Lucid/Database";
import CopaFigurinhas from "App/Models/CopaFigurinhas";

export type Raridade = "normal" | "epica" | "lendaria" | "mitica" | "god";

export const PRECO_REVELACAO: Record<Raridade, number> = {
  normal: 20,
  epica: 25,
  lendaria: 30,
  mitica: 35,
  god: 40,
};

export default class CopaRevealService {
  public static async getRevealedFigurinhaIds(jogadorId: number): Promise<number[]> {
    const rows = await Database.from("tb_copa_revelacoes")
      .where("jogador_id", jogadorId)
      .select("figurinha_id");
    return rows.map((r: any) => Number(r.figurinha_id));
  }

  public static async revelarCarta(jogadorId: number, figurinhaId: number) {
    const figurinha = await CopaFigurinhas.query()
      .where("id", figurinhaId)
      .andWhere("ativo", true)
      .first();

    if (!figurinha) {
      throw new Error("FIGURINHA_NAO_ENCONTRADA");
    }

    const jaTem = await Database.from("tb_copa_revelacoes")
      .where({ jogador_id: jogadorId, figurinha_id: figurinhaId })
      .first();

    const preco = PRECO_REVELACAO[figurinha.raridade];

    if (jaTem) {
      const jogadorAtual = await Database.from("tb_jogadores")
        .where("id", jogadorId)
        .select("gold")
        .first();
      return {
        figurinhaId,
        precoGold: preco,
        saldoGoldAtual: Number(jogadorAtual?.gold ?? 0),
        jaRevelada: true,
      };
    }

    let saldoApos: number | null = null;

    await Database.transaction(async (trx) => {
      const now = DateTime.now().toSQL();
      const deb = await trx.rawQuery(
        `
        UPDATE tb_jogadores
           SET gold = gold - ?, updated_at = ?
         WHERE id = ? AND gold >= ?
      RETURNING gold
      `,
        [preco, now, jogadorId, preco]
      );

      if (!deb.rows?.length) {
        throw new Error("SALDO_INSUFICIENTE");
      }

      saldoApos = Number(deb.rows[0].gold);

      await trx.rawQuery(
        `
        INSERT INTO tb_copa_revelacoes (jogador_id, figurinha_id)
             VALUES (?, ?)
        ON CONFLICT (jogador_id, figurinha_id) DO NOTHING
      `,
        [jogadorId, figurinhaId]
      );
    });

    return {
      figurinhaId,
      precoGold: preco,
      saldoGoldAtual: saldoApos,
      jaRevelada: false,
    };
  }
}
