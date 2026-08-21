// app/Controllers/Http/MixAwardsController.ts
import { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import Database from "@ioc:Adonis/Lucid/Database";
import { DateTime } from "luxon";
import CustomResponse from "App/Utils/CustomResponse";
import Jogadores from "App/Models/Jogadores";
import {
  AWARD_CATEGORIES,
  MIN_PARTIDAS_CATEGORIA,
  MIX_AWARDS_REVEAL_AT,
  MIX_AWARDS_SEASON_ID,
  MIX_AWARDS_SEASON_LABEL,
  categoriaCosmeticoCodigo,
} from "App/Systems/MixAwards/MixAwardsConfig";

interface PlayerAgg {
  jogadores_id: number;
  nome: string;
  imagem: string | null;
  moldura_equipada: string | null;
  partidas: number;
  vitorias: number;
  kills: number;
  mortes: number;
  assistencias: number;
  flash_assist: number;
  first_kill: number;
  multi_kill: number;
  adr_avg: number;
  kast_avg: number;
  pontos: number;
  kdr: number;
  winrate: number;
}

export default class MixAwardsController {
  protected customResponse = new CustomResponse();

  private revealLiberado(): boolean {
    const revealAt = DateTime.fromISO(MIX_AWARDS_REVEAL_AT);
    return DateTime.now() >= revealAt;
  }

  private async isAdmin(auth: any): Promise<boolean> {
    try {
      const user = await auth.authenticate();
      return !!(user?.usuario_admin || user?.admin);
    } catch {
      return false;
    }
  }

  // Agrega os stats da temporada por jogador direto da pivot de partidas.
  private async aggregatePlayers(): Promise<PlayerAgg[]> {
    // Se houver partidas marcadas com a season atual, filtra por ela;
    // caso contrário considera todas as partidas.
    const [{ total: comSeason }] = await Database.from("tb_partidas")
      .where("season_id", MIX_AWARDS_SEASON_ID)
      .count("* as total");

    const rows = await Database.from("tb_partidas_jogadores as pj")
      .join("tb_partidas as p", "p.id", "pj.partidas_id")
      .join("tb_jogadores as j", "j.id", "pj.jogadores_id")
      .if(Number(comSeason) > 0, (q) =>
        q.where("p.season_id", MIX_AWARDS_SEASON_ID)
      )
      .groupBy("pj.jogadores_id", "j.nome", "j.imagem", "j.moldura_equipada")
      .select(
        "pj.jogadores_id",
        "j.nome",
        "j.imagem",
        "j.moldura_equipada",
        Database.raw("count(*) as partidas"),
        Database.raw(
          "sum(case when pj.partida_ganha then 1 else 0 end) as vitorias"
        ),
        Database.raw("coalesce(sum(pj.kills), 0) as kills"),
        Database.raw("coalesce(sum(pj.mortes), 0) as mortes"),
        Database.raw("coalesce(sum(pj.assistencias), 0) as assistencias"),
        Database.raw("coalesce(sum(pj.flash_assist), 0) as flash_assist"),
        Database.raw("coalesce(sum(pj.first_kill), 0) as first_kill"),
        Database.raw("coalesce(sum(pj.multi_kill), 0) as multi_kill"),
        Database.raw("coalesce(avg(cast(pj.adr as decimal)), 0) as adr_avg"),
        Database.raw("coalesce(avg(pj.kast), 0) as kast_avg"),
        Database.raw(
          "coalesce(sum(cast(pj.pontos as decimal)), 0) as pontos"
        )
      );

    return rows.map((r: any) => {
      const kills = Number(r.kills) || 0;
      const mortes = Number(r.mortes) || 0;
      const partidas = Number(r.partidas) || 0;
      const vitorias = Number(r.vitorias) || 0;
      return {
        jogadores_id: Number(r.jogadores_id),
        nome: String(r.nome || ""),
        imagem: r.imagem || null,
        moldura_equipada: r.moldura_equipada || null,
        partidas,
        vitorias,
        kills,
        mortes,
        assistencias: Number(r.assistencias) || 0,
        flash_assist: Number(r.flash_assist) || 0,
        first_kill: Number(r.first_kill) || 0,
        multi_kill: Number(r.multi_kill) || 0,
        adr_avg: Number(r.adr_avg) || 0,
        kast_avg: Number(r.kast_avg) || 0,
        pontos: Number(r.pontos) || 0,
        kdr: mortes > 0 ? kills / mortes : kills,
        winrate: partidas > 0 ? (vitorias / partidas) * 100 : 0,
      };
    });
  }

  private metricValue(p: PlayerAgg, metric: string): number {
    switch (metric) {
      case "pontos":
        return p.pontos;
      case "winrate":
        return p.winrate;
      case "adr":
        return p.adr_avg;
      case "flash_assist":
        return p.flash_assist;
      case "first_kill":
        return p.first_kill;
      case "multi_kill":
        return p.multi_kill;
      case "kills":
        return p.kills;
      case "kdr":
        return p.kdr;
      case "kast":
        return p.kast_avg;
      case "partidas":
        return p.partidas;
      default:
        return 0;
    }
  }

  private buildDossieStats(p: PlayerAgg) {
    return {
      partidas: p.partidas,
      winrate: Number(p.winrate.toFixed(1)),
      adr: Number(p.adr_avg.toFixed(1)),
      kdr: Number(p.kdr.toFixed(2)),
      kast: Number(p.kast_avg.toFixed(1)),
      kills: p.kills,
      flash_assist: p.flash_assist,
      first_kill: p.first_kill,
      multi_kill: p.multi_kill,
      pontos: Math.round(p.pontos),
    };
  }

  private buildAwardJogador(p: PlayerAgg) {
    return {
      id: p.jogadores_id,
      nome: p.nome,
      imagem: p.imagem,
      moldura_equipada: p.moldura_equipada,
      stats: this.buildDossieStats(p),
    };
  }

  private async computeWinners() {
    const players = await this.aggregatePlayers();

    const files = AWARD_CATEGORIES.map((cat) => {
      const elegiveis =
        cat.modo === "avg"
          ? players.filter((p) => p.partidas >= MIN_PARTIDAS_CATEGORIA)
          : players;
      const pool = elegiveis.length > 0 ? elegiveis : players;
      const ranking = [...pool].sort(
        (a, b) => this.metricValue(b, cat.metric) - this.metricValue(a, cat.metric)
      );
      const vencedor = ranking[0];

      return {
        codigo: cat.codigo,
        file: cat.file,
        titulo: cat.titulo,
        descricao: cat.descricao,
        titulo_recompensa: cat.tituloRecompensa,
        valor: vencedor
          ? Number(this.metricValue(vencedor, cat.metric).toFixed(2))
          : 0,
        jogador: vencedor ? this.buildAwardJogador(vencedor) : null,
        indicados: ranking.slice(0, 5).map((p) => ({
          ...this.buildAwardJogador(p),
          valor: Number(this.metricValue(p, cat.metric).toFixed(2)),
        })),
      };
    });

    return { files };
  }

  /**
   * GET /api/mixawards/final
   * Relatório final: categorias com 5 indicados e vencedor.
   * Antes da data de revelação só admins recebem os dados.
   */
  public async final({ auth, response }: HttpContextContract) {
    try {
      const liberado = this.revealLiberado();
      const admin = await this.isAdmin(auth);

      const payload: any = {
        season: MIX_AWARDS_SEASON_LABEL,
        reveal_at: MIX_AWARDS_REVEAL_AT,
        liberado,
        preview_admin: !liberado && admin,
      };

      if (liberado || admin) {
        const { files } = await this.computeWinners();
        payload.files = files;
      } else {
        // Mantém a página funcional antes da cerimônia, sem revelar dados.
        payload.files = AWARD_CATEGORIES.map((cat) => ({
          codigo: cat.codigo,
          file: cat.file,
          titulo: cat.titulo,
          descricao: cat.descricao,
          jogador: null,
          indicados: [],
        }));
      }

      return this.customResponse.sucesso(
        response,
        "Relatório final carregado",
        payload
      );
    } catch (error) {
      return this.customResponse.exception(
        response,
        "Erro ao carregar o relatório final",
        error
      );
    }
  }

  /**
   * GET /api/mixawards/retrospectiva
   * Retrospectiva pessoal da temporada do jogador logado.
   */
  public async retrospectiva({ auth, response }: HttpContextContract) {
    try {
      const user = await auth.authenticate();
      const jogador = await Jogadores.query()
        .where("usuario_adm_id", user.id)
        .first();

      if (!jogador) {
        return this.customResponse.erro(
          response,
          "Nenhum jogador vinculado a este usuário.",
          {},
          404
        );
      }

      const players = await this.aggregatePlayers();
      const me = players.find((p) => p.jogadores_id === jogador.id);

      if (!me || me.partidas === 0) {
        return this.customResponse.erro(
          response,
          "Você ainda não tem partidas nesta temporada.",
          {},
          404
        );
      }

      const ordenado = [...players].sort((a, b) => b.pontos - a.pontos);
      const posicao =
        ordenado.findIndex((p) => p.jogadores_id === jogador.id) + 1;
      const percentil = Math.max(
        1,
        Math.round((posicao / ordenado.length) * 100)
      );

      const seasonFilterSub = Database.from("tb_partidas")
        .where("season_id", MIX_AWARDS_SEASON_ID)
        .count("* as total");
      const [{ total: comSeason }] = await seasonFilterSub;
      const usaSeason = Number(comSeason) > 0;

      // Partidas do jogador em ordem cronológica (mapas, streak, melhor jogo)
      const minhasPartidas = await Database.from("tb_partidas_jogadores as pj")
        .join("tb_partidas as p", "p.id", "pj.partidas_id")
        .where("pj.jogadores_id", jogador.id)
        .if(usaSeason, (q) => q.where("p.season_id", MIX_AWARDS_SEASON_ID))
        .orderBy("p.data", "asc")
        .select(
          "p.id as partida_id",
          "p.mapa",
          "p.data",
          "p.codigo",
          "p.resultado_time1",
          "p.resultado_time2",
          "pj.kills",
          "pj.mortes",
          "pj.assistencias",
          "pj.adr",
          "pj.multi_kill",
          "pj.partida_ganha"
        );

      // Stats por mapa
      const porMapa = new Map<
        string,
        { jogos: number; vitorias: number; kills: number; adrSoma: number }
      >();
      let melhorStreak = 0;
      let streakAtual = 0;
      let melhorPartida: any = null;

      for (const m of minhasPartidas) {
        const mapa = String(m.mapa || "desconhecido");
        const entry = porMapa.get(mapa) || {
          jogos: 0,
          vitorias: 0,
          kills: 0,
          adrSoma: 0,
        };
        entry.jogos += 1;
        if (m.partida_ganha) entry.vitorias += 1;
        entry.kills += Number(m.kills) || 0;
        entry.adrSoma += Number(m.adr) || 0;
        porMapa.set(mapa, entry);

        if (m.partida_ganha) {
          streakAtual += 1;
          melhorStreak = Math.max(melhorStreak, streakAtual);
        } else {
          streakAtual = 0;
        }

        if (!melhorPartida || Number(m.kills) > Number(melhorPartida.kills)) {
          melhorPartida = m;
        }
      }

      const mapas = Array.from(porMapa.entries())
        .map(([mapa, s]) => ({
          mapa,
          jogos: s.jogos,
          vitorias: s.vitorias,
          winrate: Number(((s.vitorias / s.jogos) * 100).toFixed(1)),
          adr: Number((s.adrSoma / s.jogos).toFixed(1)),
          kills: s.kills,
        }))
        .sort((a, b) => b.jogos - a.jogos);

      // Parceiro mais frequente (mesmo time, mesma partida)
      const duplas = await Database.from("tb_partidas_jogadores as eu")
        .join("tb_partidas_jogadores as par", (join) => {
          join
            .on("par.partidas_id", "eu.partidas_id")
            .andOn("par.time", "eu.time");
        })
        .join("tb_partidas as p", "p.id", "eu.partidas_id")
        .join("tb_jogadores as j", "j.id", "par.jogadores_id")
        .where("eu.jogadores_id", jogador.id)
        .whereNot("par.jogadores_id", jogador.id)
        .if(usaSeason, (q) => q.where("p.season_id", MIX_AWARDS_SEASON_ID))
        .groupBy("par.jogadores_id", "j.nome", "j.imagem")
        .select(
          "par.jogadores_id",
          "j.nome",
          "j.imagem",
          Database.raw("count(*) as jogos_juntos"),
          Database.raw(
            "sum(case when eu.partida_ganha then 1 else 0 end) as vitorias_juntos"
          )
        )
        .orderBy("jogos_juntos", "desc")
        .limit(1);

      const parceiro = duplas[0]
        ? {
            id: Number(duplas[0].jogadores_id),
            nome: String(duplas[0].nome),
            imagem: duplas[0].imagem || null,
            jogos_juntos: Number(duplas[0].jogos_juntos),
            winrate_juntos: Number(
              (
                (Number(duplas[0].vitorias_juntos) /
                  Number(duplas[0].jogos_juntos)) *
                100
              ).toFixed(1)
            ),
          }
        : null;

      return this.customResponse.sucesso(response, "Retrospectiva carregada", {
        season: MIX_AWARDS_SEASON_LABEL,
        jogador: {
          id: jogador.id,
          nome: jogador.nome,
          imagem: jogador.imagem,
          moldura_equipada: jogador.moldura_equipada,
          titulo_equipado: jogador.titulo_equipado || null,
        },
        resumo: this.buildDossieStats(me),
        derrotas: me.partidas - me.vitorias,
        assistencias: me.assistencias,
        posicao_ranking: posicao,
        total_jogadores: ordenado.length,
        percentil,
        melhor_streak: melhorStreak,
        mapas,
        melhor_partida: melhorPartida
          ? {
              mapa: melhorPartida.mapa,
              data: melhorPartida.data,
              codigo: melhorPartida.codigo,
              kills: Number(melhorPartida.kills) || 0,
              mortes: Number(melhorPartida.mortes) || 0,
              assistencias: Number(melhorPartida.assistencias) || 0,
              adr: Number(melhorPartida.adr) || 0,
              placar: `${melhorPartida.resultado_time1} x ${melhorPartida.resultado_time2}`,
              vitoria: !!melhorPartida.partida_ganha,
            }
          : null,
        parceiro,
      });
    } catch (error) {
      return this.customResponse.exception(
        response,
        "Erro ao carregar a retrospectiva",
        error
      );
    }
  }

  /**
   * POST /api/mixawards/resgatar
   * Concede ao jogador logado os títulos/molduras das premiações que ele venceu.
   */
  public async resgatar({ auth, response }: HttpContextContract) {
    try {
      if (!this.revealLiberado()) {
        return this.customResponse.erro(
          response,
          "As recompensas só podem ser resgatadas após a cerimônia.",
          {},
          403
        );
      }

      const user = await auth.authenticate();
      const jogador = await Jogadores.query()
        .where("usuario_adm_id", user.id)
        .firstOrFail();

      const { files } = await this.computeWinners();
      const recompensas: {
        codigo: string;
        tipo: "titulo" | "moldura";
        nome: string;
        valor: string;
      }[] = [];

      for (const f of files) {
        if (f.jogador?.id === jogador.id) {
          recompensas.push({
            codigo: categoriaCosmeticoCodigo(f.codigo),
            tipo: "titulo",
            nome: f.titulo_recompensa,
            valor: f.titulo_recompensa,
          });
        }
      }
      if (recompensas.length === 0) {
        return this.customResponse.erro(
          response,
          "Você não venceu nenhuma premiação desta temporada.",
          {},
          404
        );
      }

      const concedidas: typeof recompensas = [];
      for (const r of recompensas) {
        const existente = await Database.from("tb_jogadores_cosmeticos")
          .where("jogador_id", jogador.id)
          .where("codigo", r.codigo)
          .first();
        if (!existente) {
          await Database.table("tb_jogadores_cosmeticos").insert({
            jogador_id: jogador.id,
            codigo: r.codigo,
            tipo: r.tipo,
            created_at: DateTime.now().toSQL(),
            updated_at: DateTime.now().toSQL(),
          });
          concedidas.push(r);
        }
      }

      return this.customResponse.sucesso(
        response,
        concedidas.length > 0
          ? "Recompensas resgatadas!"
          : "Recompensas já haviam sido resgatadas.",
        { recompensas, novas: concedidas }
      );
    } catch (error) {
      return this.customResponse.exception(
        response,
        "Erro ao resgatar recompensas",
        error
      );
    }
  }

  /**
   * POST /api/mixawards/equipar
   * Equipa um título ou moldura conquistado nos Mix Awards.
   * body: { codigo }
   */
  public async equipar({ auth, request, response }: HttpContextContract) {
    try {
      const user = await auth.authenticate();
      const jogador = await Jogadores.query()
        .where("usuario_adm_id", user.id)
        .firstOrFail();

      const codigo = String(request.input("codigo", "")).trim();
      const possui = await Database.from("tb_jogadores_cosmeticos")
        .where("jogador_id", jogador.id)
        .where("codigo", codigo)
        .first();

      if (!possui) {
        return this.customResponse.erro(
          response,
          "Você não possui essa recompensa.",
          {},
          403
        );
      }

      // Resolve o valor do cosmético a partir da configuração dos awards
      let tipo: "titulo" | null = null;
      let valor: string | null = null;

      for (const c of AWARD_CATEGORIES) {
        if (codigo === categoriaCosmeticoCodigo(c.codigo)) {
          tipo = "titulo";
          valor = c.tituloRecompensa;
        }
      }

      if (!tipo || !valor) {
        return this.customResponse.erro(
          response,
          "Recompensa inválida.",
          {},
          400
        );
      }

      jogador.titulo_equipado = valor;
      await jogador.save();

      return this.customResponse.sucesso(response, "Recompensa equipada!", {
        tipo,
        valor,
      });
    } catch (error) {
      return this.customResponse.exception(
        response,
        "Erro ao equipar recompensa",
        error
      );
    }
  }
}
