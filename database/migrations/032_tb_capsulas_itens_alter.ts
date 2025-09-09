import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class AddForeignKeysCapsulasItens extends BaseSchema {
  protected tableName = "tb_capsulas_itens";

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .foreign("capsulas_id")
        .references("id")
        .inTable("tb_capsulas")
        .onDelete("CASCADE");

      table
        .foreign("sticker_id")
        .references("id")
        .inTable("tb_stickers")
        .onDelete("CASCADE");
    });
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(["capsulas_id"]);
      table.dropForeign(["sticker_id"]);
    });
  }
}
