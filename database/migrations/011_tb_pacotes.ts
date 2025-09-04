import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class Pacotes extends BaseSchema {
  protected tableName = "tb_pacotes";

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments("id");
      table
        .integer("jogador_id")
        .unsigned()
        .references("id")
        .inTable("tb_jogadores")
        .onDelete("CASCADE")
        .notNullable();
      table.integer("preco_gold").notNullable();
      table.integer("qtd_itens").notNullable().defaultTo(4);
      table
        .enu("status", ["fechado", "aberto"])
        .notNullable()
        .defaultTo("fechado");
      table.timestamp("aberto_em", { useTz: true });
      table.timestamp("created_at", { useTz: true });
      table.timestamp("updated_at", { useTz: true });
    });
  }

  public async down() {
    this.schema.dropTable(this.tableName);
  }
}
