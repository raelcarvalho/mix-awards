import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class Partidas extends BaseSchema {
  protected tableName = "tb_partidas";

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments("id");
      table.string("mapa");
      table.date("data");
      table.integer("codigo");
      table.string("nome_time1");
      table.integer("resultado_time1");
      table.string("nome_time2");
      table.integer("resultado_time2");

      table.timestamps(true);
    });
  }

  public async down() {
    this.schema.dropTable(this.tableName);
  }
}
