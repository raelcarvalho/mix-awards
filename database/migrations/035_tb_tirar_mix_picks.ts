import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class TbTirarMixPicks extends BaseSchema {
  protected tableName = "tb_tirar_mix_picks";

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments("id");

      table
        .integer("sessao_id")
        .unsigned()
        .references("id")
        .inTable("tb_tirar_mix_sessoes")
        .onDelete("CASCADE")
        .notNullable();

      table
        .integer("captain_id")
        .unsigned()
        .references("id")
        .inTable("tb_jogadores")
        .notNullable();
      table
        .integer("player_id")
        .unsigned()
        .references("id")
        .inTable("tb_jogadores")
        .notNullable();

      table.enum("time", ["A", "B"]).notNullable();
      table.integer("ordem_pick").notNullable();

      table
        .timestamp("created_at", { useTz: true })
        .notNullable()
        .defaultTo(this.now());

      table.unique(["sessao_id", "player_id"]);
      table.unique(["sessao_id", "ordem_pick"]);

      table.index(["sessao_id"]);
      table.index(["time"]);
    });
  }

  public async down() {
    this.schema.dropTable(this.tableName);
  }
}
