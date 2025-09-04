import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class PacotesItens extends BaseSchema {
  protected tableName = "tb_pacotes_itens";

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments("id");
      table
        .integer("pacote_id")
        .unsigned()
        .references("id")
        .inTable("tb_pacotes")
        .onDelete("CASCADE")
        .notNullable();
      table
        .integer("figurinha_id")
        .unsigned()
        .references("id")
        .inTable("tb_figurinhas")
        .onDelete("CASCADE")
        .notNullable();
      table.boolean("duplicada").notNullable().defaultTo(false);
      table.timestamp("created_at", { useTz: true });
      table.timestamp("updated_at", { useTz: true });
    });
  }

  public async down() {
    this.schema.dropTable(this.tableName);
  }
}
