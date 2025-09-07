import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class Altertable extends BaseSchema {
  protected tableName = "tb_jogadores";

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer("gold").notNullable().defaultTo(0);
    });
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn("gold");
    });
  }
}
