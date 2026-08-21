import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class TbJogadoresCosmeticos extends BaseSchema {
  protected tableName = "tb_jogadores_cosmeticos";

  public async up() {
    const exists = await this.schema.hasTable(this.tableName);
    if (exists) return;

    this.schema.createTable(this.tableName, (table) => {
      table.increments("id").primary();
      table
        .integer("jogador_id")
        .unsigned()
        .notNullable()
        .references("id")
        .inTable("tb_jogadores")
        .onDelete("CASCADE");
      table.string("codigo").notNullable();
      table.string("tipo").notNullable();
      table.timestamp("created_at", { useTz: true });
      table.timestamp("updated_at", { useTz: true });
      table.unique(["jogador_id", "codigo"]);
    });
  }

  public async down() {
    this.schema.dropTable(this.tableName);
  }
}
