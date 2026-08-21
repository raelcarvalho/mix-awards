import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class AddForeignKeysCapsulasItens extends BaseSchema {
  protected tableName = "tb_capsulas_itens";

  private async hasForeignKeyOnColumn(columnName: string) {
    const result = await this.db.rawQuery(
      `
      select 1
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name
       and tc.table_schema = kcu.table_schema
      where tc.constraint_type = 'FOREIGN KEY'
        and tc.table_name = ?
        and kcu.column_name = ?
      limit 1
      `,
      [this.tableName, columnName]
    );

    return Boolean(result.rows?.length);
  }

  public async up() {
    const hasCapsulasFk = await this.hasForeignKeyOnColumn("capsulas_id");
    const hasStickerFk = await this.hasForeignKeyOnColumn("sticker_id");

    this.schema.alterTable(this.tableName, (table) => {
      if (!hasCapsulasFk) {
        table
          .foreign("capsulas_id")
          .references("id")
          .inTable("tb_capsulas")
          .onDelete("CASCADE");
      }

      if (!hasStickerFk) {
        table
          .foreign("sticker_id")
          .references("id")
          .inTable("tb_stickers")
          .onDelete("CASCADE");
      }
    });
  }

  public async down() {
    const hasCapsulasFk = await this.hasForeignKeyOnColumn("capsulas_id");
    const hasStickerFk = await this.hasForeignKeyOnColumn("sticker_id");

    this.schema.alterTable(this.tableName, (table) => {
      if (hasCapsulasFk) {
        table.dropForeign(["capsulas_id"]);
      }

      if (hasStickerFk) {
        table.dropForeign(["sticker_id"]);
      }
    });
  }
}
