import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class Altertable extends BaseSchema {
  protected tableName = "tb_jogadores";

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string("pontos", 240).notNullable().defaultTo("");
      table.string("qtd_partidas", 240).notNullable().defaultTo("");

    });
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn("pontos");
      table.dropColumn("qtd_partidas");
    });
  }
}
