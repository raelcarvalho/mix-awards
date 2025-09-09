import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class CapsulasItens extends BaseSchema {
  protected tableName = "tb_capsulas_itens";

  public async up() {
    // Primeiro criar a tabela SEM foreign keys
    this.schema.createTable(this.tableName, (table) => {
      table.increments("id");
      table.integer("capsulas_id").unsigned().notNullable();
      table.integer("sticker_id").unsigned().notNullable();
      table.boolean("duplicada").notNullable().defaultTo(false);
      table.timestamp("created_at", { useTz: true });
      table.timestamp("updated_at", { useTz: true });
    });

  }

  public async down() {
    this.schema.dropTable(this.tableName);
  }
}