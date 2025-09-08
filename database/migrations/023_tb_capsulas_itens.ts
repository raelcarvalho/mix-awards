import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class CapsulasItens extends BaseSchema {
  protected tableName = "tb_capsulas_itens";

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      // migration
      table.increments("id");
      table
        .integer("capsulas_id")
        .unsigned()
        .references("id")
        .inTable("tb_capsulas")
        .onDelete("CASCADE")
        .notNullable();
      table
        .integer("sticker_id")
        .unsigned()
        .references("id")
        .inTable("tb_stickers")
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
