import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class TbTirarMixPlayers extends BaseSchema {
  protected tableName = "tb_tirar_mix_players";

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
        .integer("jogador_id")
        .unsigned()
        .references("id")
        .inTable("tb_jogadores")
        .notNullable();

      table.boolean("is_selecionado").notNullable().defaultTo(false);
      table.boolean("is_capitao").notNullable().defaultTo(false);

      table.enum("time", ["A", "B"]).nullable();
      table.integer("ordem_pick").nullable();

      table.timestamps(true);

      table.unique(["sessao_id", "jogador_id"]);
      table.index(["sessao_id"]);
      table.index(["time"]);
    });
  }

  public async down() {
    this.schema.dropTable(this.tableName);
  }
}
