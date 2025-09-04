import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class Altertable extends BaseSchema {
  protected tableName = "tb_partidas_jogadores";

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
     table.string('nome', 255).nullable()
    });
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn("nome");
    });
  }
}
