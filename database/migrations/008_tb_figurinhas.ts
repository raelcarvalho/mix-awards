import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class Figurinhas extends BaseSchema {
  protected tableName = "tb_figurinhas";

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments("id");
      table.string("nome").notNullable().unique();
      table.string("imagem").notNullable();
      table
        .enu("raridade", ["normal", "rara", "epica"])
        .notNullable()
        .defaultTo("normal");
      table.boolean("ativo").notNullable().defaultTo(true);
      table.timestamp("created_at", { useTz: true });
      table.timestamp("updated_at", { useTz: true });
    });
  }

  public async down() {
    this.schema.dropTable(this.tableName);
  }
}
