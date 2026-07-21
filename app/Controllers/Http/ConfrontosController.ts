import { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import CustomResponse from "App/Utils/CustomResponse";
import Database from "@ioc:Adonis/Lucid/Database";

/**
 * Confrontos (head-to-head) entre dois jogadores dentro de uma temporada.
 *
 * Um "confronto" é uma partida em que os dois jogadores participaram em TIMES
 * OPOSTOS (tb_partidas_jogadores.time diferente). Não existe tabela de eventos
 * de kill no schema, então não há como saber "quem matou quem": as kills
 * expostas aqui são o total de kills de cada jogador NAS partidas de confronto.
 */
export default class ConfrontosController {
  protected customResponse: CustomResponse;
  private readonly DEFAULT_SEASON_ID = 2;
  private readonly SEASON_TWO_START_DATE = "2026-05-25";

  constructor() {
    this.customResponse = new CustomResponse();
  }

  private parseSeasonId(raw: any): number {
    const n = Number(raw);
    if (n === 1 || n === 2) return n;
    return this.DEFAULT_SEASON_ID;
  }

  private parsePlayerId(raw: any): number | null {
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0) return null;
    return n;
  }

  private async hasSeasonColumn(): Promise<boolean> {
    const col = await Database.from("information_schema.columns")
      .where("table_name", "tb_partidas")
      .where("column_name", "season_id")
      .first();
    return !!col;
  }

  private applySeasonFilter(query: any, alias: string, seasonId: number, hasColumn: boolean) {
    if (hasColumn) {
      query.where(`${alias}.season_id`, seasonId);
      return;
    }
    if (seasonId === 1) {
      query.where(`${alias}.data`, "<", this.SEASON_TWO_START_DATE);
      return;
    }
    query.where(`${alias}.data`, ">=", this.SEASON_TWO_START_DATE);
  }

  /**
   * GET /api/confrontos/jogadores?season_id=2
   * Jogadores que participaram de pelo menos uma partida da temporada.
   * Uma única query com join — sem N+1.
   */
  public async jogadores({ request, response }: HttpContextContract) {
    try {
      const seasonId = this.parseSeasonId(request.input("season_id"));
      const hasSeasonColumn = await this.hasSeasonColumn();

      const query = Database.from("tb_partidas_jogadores as pj")
        .innerJoin("tb_partidas as p", "p.id", "pj.partidas_id")
        .innerJoin("tb_jogadores as j", "j.id", "pj.jogadores_id")
        .groupBy("j.id", "j.nome", "j.imagem")
        .select("j.id", "j.nome", "j.imagem")
        .select(Database.raw("COUNT(DISTINCT pj.partidas_id)::int as qtd_partidas"))
        .orderBy("j.nome", "asc");

      this.applySeasonFilter(query, "p", seasonId, hasSeasonColumn);

      const jogadores = await query;

      return this.customResponse.sucesso(response, "Jogadores da temporada.", {
        season_id: seasonId,
        jogadores,
      });
    } catch (erro) {
      return this.customResponse.exception(
        response,
        "Erro ao listar jogadores da temporada.",
        erro
      );
    }
  }

  /**
   * GET /api/confrontos?season_id=2&jogador_a=1&jogador_b=2
   * Agregado do confronto + lista das partidas. Duas queries fixas
   * (agregado e histórico), independentes do nº de partidas.
   */
  public async comparar({ request, response }: HttpContextContract) {
    try {
      const seasonId = this.parseSeasonId(request.input("season_id"));
      const jogadorA = this.parsePlayerId(request.input("jogador_a"));
      const jogadorB = this.parsePlayerId(request.input("jogador_b"));

      if (!jogadorA || !jogadorB) {
        return this.customResponse.erro(
          response,
          "Informe os dois jogadores para comparar.",
          null,
          400
        );
      }

      if (jogadorA === jogadorB) {
        return this.customResponse.erro(
          response,
          "Selecione dois jogadores diferentes.",
          null,
          400
        );
      }

      const hasSeasonColumn = await this.hasSeasonColumn();

      // Base: partidas em que A e B jogaram em times opostos.
      const baseQuery = () => {
        const q = Database.from("tb_partidas_jogadores as pa")
          .innerJoin("tb_partidas_jogadores as pb", (join) => {
            join
              .on("pb.partidas_id", "=", "pa.partidas_id")
              .andOnVal("pb.jogadores_id", jogadorB);
          })
          .innerJoin("tb_partidas as p", "p.id", "pa.partidas_id")
          .where("pa.jogadores_id", jogadorA)
          // times opostos (coluna `time` é string, pode ser nula em dados antigos)
          .whereNotNull("pa.time")
          .whereNotNull("pb.time")
          .whereRaw("pa.time <> pb.time");

        this.applySeasonFilter(q, "p", seasonId, hasSeasonColumn);
        return q;
      };

      const [resumo, partidas] = await Promise.all([
        baseQuery()
          .select(
            Database.raw("COUNT(*)::int as confrontos"),
            Database.raw(
              "COALESCE(SUM(CASE WHEN pa.partida_ganha = TRUE THEN 1 ELSE 0 END),0)::int as vitorias_a"
            ),
            Database.raw(
              "COALESCE(SUM(CASE WHEN pb.partida_ganha = TRUE THEN 1 ELSE 0 END),0)::int as vitorias_b"
            ),
            Database.raw("COALESCE(SUM(COALESCE(pa.kills,0)),0)::int as kills_a"),
            Database.raw("COALESCE(SUM(COALESCE(pb.kills,0)),0)::int as kills_b"),
            Database.raw("COALESCE(SUM(COALESCE(pa.mortes,0)),0)::int as mortes_a"),
            Database.raw("COALESCE(SUM(COALESCE(pb.mortes,0)),0)::int as mortes_b"),
            // adr é string e pode vir com vírgula decimal (mesmo tratamento do ranking)
            Database.raw(
              "COALESCE(AVG(NULLIF(REPLACE(COALESCE(pa.adr::text,''), ',', '.'),'')::numeric),0)::float as adr_a"
            ),
            Database.raw(
              "COALESCE(AVG(NULLIF(REPLACE(COALESCE(pb.adr::text,''), ',', '.'),'')::numeric),0)::float as adr_b"
            )
          )
          .first(),
        baseQuery()
          .select(
            "p.id as partida_id",
            "p.codigo",
            "p.mapa",
            "p.data",
            "pa.kills as kills_a",
            "pb.kills as kills_b",
            "pa.partida_ganha as venceu_a",
            "pb.partida_ganha as venceu_b"
          )
          .orderBy("p.data", "desc")
          .limit(20),
      ]);

      const confrontos = Number(resumo?.confrontos || 0);
      const vitoriasA = Number(resumo?.vitorias_a || 0);
      const vitoriasB = Number(resumo?.vitorias_b || 0);

      return this.customResponse.sucesso(response, "Confronto calculado.", {
        season_id: seasonId,
        confrontos,
        empates: Math.max(0, confrontos - vitoriasA - vitoriasB),
        jogador_a: {
          id: jogadorA,
          vitorias: vitoriasA,
          kills: Number(resumo?.kills_a || 0),
          mortes: Number(resumo?.mortes_a || 0),
          adr: Number(resumo?.adr_a || 0),
        },
        jogador_b: {
          id: jogadorB,
          vitorias: vitoriasB,
          kills: Number(resumo?.kills_b || 0),
          mortes: Number(resumo?.mortes_b || 0),
          adr: Number(resumo?.adr_b || 0),
        },
        partidas,
      });
    } catch (erro) {
      return this.customResponse.exception(response, "Erro ao calcular confronto.", erro);
    }
  }
}
