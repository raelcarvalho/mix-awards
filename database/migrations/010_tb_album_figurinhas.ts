import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class AlbumFigurinhas extends BaseSchema {
  protected tableName = "tb_album_figurinhas";

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments("id");
      table
        .integer("album_id")
        .unsigned()
        .references("id")
        .inTable("tb_album")
        .onDelete("CASCADE")
        .notNullable();
      table
        .integer("figurinha_id")
        .unsigned()
        .references("id")
        .inTable("tb_figurinhas")
        .onDelete("CASCADE")
        .notNullable();
      table.string("obtida_via").notNullable().defaultTo("pacotes");
      table
        .timestamp("created_at", { useTz: true })
        .notNullable()
        .defaultTo(this.now());
      table.unique(["album_id", "figurinha_id"]);
    });
  }

  public async down() {
    this.schema.dropTable(this.tableName);
  }
}
