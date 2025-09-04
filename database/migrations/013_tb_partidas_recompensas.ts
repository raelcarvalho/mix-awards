import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class PartidasRecompensas extends BaseSchema {
  protected tableName = "tb_partidas_recompensas";

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments("id");
      table
        .integer("partida_id")
        .unsigned()
        .references("id")
        .inTable("tb_partidas")
        .onDelete("CASCADE")
        .notNullable();
      table
        .integer("jogador_id")
        .unsigned()
        .references("id")
        .inTable("tb_jogadores")
        .onDelete("CASCADE")
        .notNullable();
      table.integer("gold_creditado").notNullable();
      table
        .timestamp("created_at", { useTz: true })
        .notNullable()
        .defaultTo(this.now());
      table.unique(["partida_id", "jogador_id"]);
    });
  }

  public async down() {
    this.schema.dropTable(this.tableName);
  }
}
