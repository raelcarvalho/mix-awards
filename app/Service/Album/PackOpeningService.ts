import { DateTime } from "luxon";

import Database from "@ioc:Adonis/Lucid/Database";
import Figurinhas from "App/Models/Figurinhas";
import Jogadores from "App/Models/Jogadores";

export type Raridade = "normal" | "epica" | "lendaria" | "mitica" | "god";

const PESOS: Record<Raridade, number> = {
  normal: 60,
  epica: 24,
  lendaria: 12,
  mitica: 3,
  god: 1,
};

const VALOR_DUP: Record<Raridade, number> = {
  normal: 2,
  epica: 5,
  lendaria: 10,
  mitica: 20,
  god: 50,
};

const ORDEM_FALLBACK: Record<Raridade, Raridade[]> = {
  god: [],
  mitica: ["lendaria", "epica", "normal"],
  lendaria: ["epica", "normal"],
  epica: ["normal"],
  normal: [],
};

function sortearRaridade(): Raridade {
  const r = Math.random() * 100;
  let acc = 0;
  for (const [rar, peso] of Object.entries(PESOS) as [Raridade, number][]) {
    acc += peso;
    if (r < acc) return rar;
  }
  return "normal";
}

function pickRandom<T>(arr: T[]): T | null {
  if (!arr.length) return null;
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx];
}

export interface PackOpeningOutcome {
  novas: Figurinhas[];
  duplicadas: Figurinhas[];
  goldVendidoTotal: number;
  progresso: { obtidas: number; total: number };
  saldoGoldAtual?: number;
}

export default class PackOpeningService {
  /** Sorteia as cartas de um pacote respeitando os pesos de raridade, com fallback para raridades mais comuns quando o pool está vazio. */
  public static sortearCartas(todasAtivas: Figurinhas[], qtdItens: number): Figurinhas[] {
    const pools = new Map<Raridade, Figurinhas[]>([
      ["normal", todasAtivas.filter((f) => f.raridade === "normal")],
      ["epica", todasAtivas.filter((f) => f.raridade === "epica")],
      ["lendaria", todasAtivas.filter((f) => f.raridade === "lendaria")],
      ["mitica", todasAtivas.filter((f) => f.raridade === "mitica")],
      ["god", todasAtivas.filter((f) => f.raridade === "god")],
    ]);

    const cartas: Figurinhas[] = [];
    let tentativas = 0;

    while (cartas.length < qtdItens && tentativas < 20 * qtdItens) {
      tentativas++;

      let rar = sortearRaridade();
      let pool = pools.get(rar) ?? [];

      if (!pool.length) {
        for (const rfb of ORDEM_FALLBACK[rar]) {
          const p = pools.get(rfb) ?? [];
          if (p.length) {
            rar = rfb;
            pool = p;
            break;
          }
        }
      }

      const sorteada = pickRandom(pool);
      if (sorteada && !cartas.some((c) => c.id === sorteada.id)) {
        cartas.push(sorteada);
      }
    }

    return cartas;
  }

  /**
   * Persiste o resultado do sorteio em lote: descobre em uma única consulta
   * quais figurinhas já existem no álbum e grava tudo (novas + itens do
   * pacote) com inserts em massa dentro de uma transação — substitui o
   * antigo fluxo de SELECT+INSERT sequenciais por carta (~3 round-trips
   * por item sorteado).
   */
  public static async registrarResultado(
    albumId: number,
    pacoteId: number,
    jogadorId: number,
    cartas: Figurinhas[]
  ): Promise<PackOpeningOutcome> {
    const candidatoIds = cartas.map((c) => c.id);

    const jaPossuiRows = candidatoIds.length
      ? await Database.from("tb_album_figurinhas")
          .where("album_id", albumId)
          .whereIn("figurinha_id", candidatoIds)
          .select("figurinha_id")
      : [];

    const jaPossui = new Set<number>(jaPossuiRows.map((r: any) => Number(r.figurinha_id)));

    const novas: Figurinhas[] = [];
    const duplicadas: Figurinhas[] = [];
    let goldVendidoTotal = 0;

    // sortearCartas garante ids únicos dentro do pacote, então a única forma
    // de uma carta ser duplicada é o jogador já possuí-la de antes.
    for (const f of cartas) {
      if (jaPossui.has(f.id)) {
        duplicadas.push(f);
        goldVendidoTotal += VALOR_DUP[f.raridade as Raridade] || 0;
      } else {
        novas.push(f);
      }
    }

    await Database.transaction(async (trx) => {
      const agora = DateTime.now().toSQL();

      if (novas.length) {
        await trx.table("tb_album_figurinhas").multiInsert(
          novas.map((f) => ({
            album_id: albumId,
            figurinha_id: f.id,
            obtida_via: "pacote",
            created_at: agora,
          }))
        );
      }

      if (cartas.length) {
        await trx.table("tb_pacotes_itens").multiInsert(
          cartas.map((f) => ({
            pacote_id: pacoteId,
            figurinha_id: f.id,
            duplicada: jaPossui.has(f.id),
          }))
        );
      }

      if (goldVendidoTotal > 0) {
        await trx
          .from("tb_jogadores")
          .where("id", jogadorId)
          .increment("gold", goldVendidoTotal);
      }

      await trx.from("tb_pacotes").where("id", pacoteId).update({
        status: "aberto",
        aberto_em: agora,
        updated_at: agora,
      });
    });

    const countRes = await Database.from("tb_album_figurinhas")
      .where("album_id", albumId)
      .count("* as c")
      .first();

    const jogadorAtualizado = await Jogadores.find(jogadorId);

    return {
      novas,
      duplicadas,
      goldVendidoTotal,
      progresso: {
        obtidas: Number(countRes?.c || 0),
        total: 0,
      },
      saldoGoldAtual: jogadorAtualizado?.gold ?? undefined,
    };
  }
}
