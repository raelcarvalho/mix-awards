import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class AddSeasonToPartidas extends BaseSchema {
  protected tableName = "tb_partidas";
  private readonly indexName = "idx_tb_partidas_season_data";
  private readonly seasonTwoStartDate = "2026-05-25";

  public async up() {
    await this.db.rawQuery(
      `ALTER TABLE ${this.tableName}
       ADD COLUMN IF NOT EXISTS season_id integer`
    );

    await this.db.rawQuery(
      `ALTER TABLE ${this.tableName}
       ALTER COLUMN season_id SET DEFAULT 1`
    );

    await this.db.rawQuery(
      `UPDATE ${this.tableName}
       SET season_id = CASE
         WHEN data >= ? THEN 2
         ELSE 1
       END`,
      [this.seasonTwoStartDate]
    );

    await this.db.rawQuery(
      `ALTER TABLE ${this.tableName}
       ALTER COLUMN season_id SET NOT NULL`
    );

    await this.db.rawQuery(
      `CREATE INDEX IF NOT EXISTS ${this.indexName}
       ON ${this.tableName} (season_id, data)`
    );
  }

  public async down() {
    await this.db.rawQuery(`DROP INDEX IF EXISTS ${this.indexName}`);
    await this.db.rawQuery(
      `ALTER TABLE ${this.tableName}
       DROP COLUMN IF EXISTS season_id`
    );
  }
}
