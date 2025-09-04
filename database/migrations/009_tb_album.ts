import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class Album extends BaseSchema {
  protected tableName = "tb_album";

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments("id");
      table
        .integer("jogador_id")
        .unsigned()
        .references("id")
        .inTable("tb_jogadores")
        .onDelete("CASCADE")
        .notNullable()
        .unique();
      table.timestamp("created_at", { useTz: true });
      table.timestamp("updated_at", { useTz: true });
    });
  }

  public async down() {
    this.schema.dropTable(this.tableName);
  }
}
