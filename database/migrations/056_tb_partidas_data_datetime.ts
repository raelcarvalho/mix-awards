import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class extends BaseSchema {
  protected tableName = "tb_partidas";

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // DATE -> DATETIME para preservar o horário vindo do JSON da GC
      table.datetime("data").alter();
    });
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.date("data").alter();
    });
  }
}
