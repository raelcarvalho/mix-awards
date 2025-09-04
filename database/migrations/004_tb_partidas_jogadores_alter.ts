import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class Altertable extends BaseSchema {
  protected tableName = "tb_partidas_jogadores";

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Adiciona a nova coluna com foreign key
      table
        .integer("partidas_id")
        .unsigned()
        .references("id")
        .inTable("tb_partidas")
        .onDelete("CASCADE");

      // Remove a coluna antiga
      table.dropColumn("partida_id");
    });
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Restaura a coluna antiga
      table
        .integer("partida_id")
        .unsigned()
        .references("id")
        .inTable("tb_partidas")
        .onDelete("CASCADE");

      // Remove a nova
      table.dropColumn("partidas_id");
    });
  }
}
