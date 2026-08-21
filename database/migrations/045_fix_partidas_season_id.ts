import BaseSchema from "@ioc:Adonis/Lucid/Schema";
import Database from "@ioc:Adonis/Lucid/Database";

export default class FixPartidasSeasonId extends BaseSchema {
  // Mesma regra usada nos controllers: season 2 começa em 25/05/2026.
  private readonly SEASON_TWO_START_DATE = "2026-05-25";

  public async up() {
    const hasSeasonColumn = await this.schema.hasColumn(
      "tb_partidas",
      "season_id"
    );

    // Garante a coluna season_id (se ainda não existir).
    if (!hasSeasonColumn) {
      this.schema.alterTable("tb_partidas", (table) => {
        table.integer("season_id").nullable();
      });
    }

    // Recalcula o season_id de TODAS as partidas a partir da data real.
    this.defer(async () => {
      await Database.rawQuery(
        `UPDATE tb_partidas
         SET season_id = CASE WHEN data < ? THEN 1 ELSE 2 END
         WHERE data IS NOT NULL`,
        [this.SEASON_TWO_START_DATE]
      );
    });
  }

  public async down() {
    // Sem rollback de dados (apenas recalculo de season_id).
  }
}
