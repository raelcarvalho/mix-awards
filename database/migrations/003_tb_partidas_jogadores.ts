import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class PartidaJogadores extends BaseSchema {
  protected tableName = "tb_partidas_jogadores";

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments("id");

      table
        .integer("partida_id")
        .unsigned()
        .references("id")
        .inTable("tb_partidas")
        .onDelete("CASCADE");

      table
        .integer("jogadores_id")
        .unsigned()
        .references("id")
        .inTable("tb_jogadores")
        .onDelete("CASCADE");

      table.string("adr");
      table.integer("kills");
      table.integer("assistencias");
      table.integer("mortes");
      table.string("kda_player");
      table.integer("kast");
      table.string("time");
      table.integer("flash_assist");
      table.integer("first_kill");
      table.integer("multi_kill");
      table.string("vitorias");

      table.timestamps(true);
    });
  }

  public async down() {
    this.schema.dropTable(this.tableName);
  }
}
