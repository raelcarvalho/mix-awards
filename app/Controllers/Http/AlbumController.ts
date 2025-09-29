import { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import Database from "@ioc:Adonis/Lucid/Database";
import { DateTime } from "luxon";

import CustomResponse from "App/Utils/CustomResponse";
import Jogadores from "App/Models/Jogadores";
import Figurinhas from "App/Models/Figurinhas";
import Pacotes from "App/Models/Pacotes";
import PacotesItens from "App/Models/PacotesItens";

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

    // em alguns drivers inserted pode ser number[]; normaliza:
    const albumId = Array.isArray(inserted)
      ? Number(inserted[0]?.id ?? inserted[0])
      : Number(inserted);
    return albumId;
  }

  private async addIfMissing(
    albumId: number,
    figurinhaId: number
  ): Promise<boolean> {
    const exists = await Database.from("tb_album_figurinhas")
      .where("album_id", albumId)
      .andWhere("figurinha_id", figurinhaId)
      .first();

    if (exists) return false;

    await Database.table("tb_album_figurinhas").insert({
      album_id: albumId,
      figurinha_id: figurinhaId,
      obtida_via: "pacote",
      created_at: DateTime.now().toSQL(),
    });
    return true;
  }

  private pickNUnique<T>(arr: T[], n: number): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, n);
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
          .orderBy("slot", "asc"), // << ordenar pelo slot
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
          slot: f.slot ?? f.id, // << mande o slot
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

      const poolNormal = todasAtivas.filter((f) => f.raridade === "normal");
      const poolEpica = todasAtivas.filter((f) => f.raridade === "epica");
      const poolLendaria = todasAtivas.filter((f) => f.raridade === "lendaria");
      const poolMitica = todasAtivas.filter((f) => f.raridade === "mitica");
      const poolGod = todasAtivas.filter((f) => f.raridade === "god");

      // Probabilidades: 40% normal | 45% épica | 12% lendária | 3% mítica | 0,009% god
      type Raridade = "normal" | "epica" | "lendaria" | "mitica" | "god";
      const PESOS = {
        normal: 39,
        epica: 45,
        lendaria: 12,
        mitica: 3,
        god: 1,
      } as const;

      function sortearRaridade(): Raridade {
        const r = Math.random() * 100;
        let acc = 0;
        for (const [rar, peso] of Object.entries(PESOS) as [
          Raridade,
          number
        ][]) {
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

      function poolByRaridade(r: Raridade): any[] {
        if (r === "normal") return poolNormal;
        if (r === "epica") return poolEpica;
        if (r === "lendaria") return poolLendaria;
        if (r === "mitica") return poolMitica;
        return poolGod;
      }

      const cartas: any[] = [];
      let tentativas = 0;

      while (cartas.length < qtdItens && tentativas < 20 * qtdItens) {
        tentativas++;

        let rar: Raridade = sortearRaridade();
        let pool = poolByRaridade(rar);

        if (!pool.length) {
          const ordemFallback: Raridade[] =
            rar === "mitica"
              ? ["lendaria", "epica", "normal"]
              : rar === "lendaria"
              ? ["epica", "normal"]
              : rar === "epica"
              ? ["normal"]
              : [];

          for (const rfb of ordemFallback) {
            const p = poolByRaridade(rfb);
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

      const novas: any[] = [];
      const duplicadas: any[] = [];

      const VALOR_DUP: Record<Raridade, number> = {
        normal: 2,
        epica: 5,
        lendaria: 10,
        mitica: 20,
        god: 50,
      };

      let goldVendidoTotal = 0;

      for (const f of cartas) {
        const nova = await this.addIfMissing(albumId, f.id);

        await PacotesItens.create({
          pacotes_id: pacote.id,
          figurinha_id: f.id,
          duplicada: !nova,
        });

        if (nova) {
          novas.push(f);
        } else {
          duplicadas.push(f);
          const val = VALOR_DUP[f.raridade as Raridade] || 0;
          goldVendidoTotal += val;
        }
      }

      if (goldVendidoTotal > 0) {
        await Jogadores.query()
          .where("id", jogador.id)
          .increment("gold", goldVendidoTotal);
      }

      await Database.from("tb_pacotes").where("id", pacote.id).update({
        status: "aberto",
        aberto_em: DateTime.now().toSQL(),
        updated_at: DateTime.now().toSQL(),
      });

      const countRes = await Database.from("tb_album_figurinhas")
        .where("album_id", albumId)
        .count("* as c")
        .first();

      const progresso = {
        obtidas: Number(countRes?.c || 0),
        total: todasAtivas.length,
      };

      const jogadorAtualizado = await Jogadores.find(jogador.id);

      const payload = {
        pacoteId: pacote.id,
        novas,
        duplicadas,
        goldVendidoTotal,
        saldoGoldAtual: jogadorAtualizado?.gold ?? undefined,
        progresso,
        mensagens: {
          novas: novas.length
            ? "Foi adicionada(s) nova(s) carta(s) ao seu álbum!"
            : "Nenhuma carta nova desta vez.",
          repetidas: duplicadas.length
            ? `Você vendeu ${duplicadas.length} carta(s) repetida(s) por ${goldVendidoTotal} gold.`
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
