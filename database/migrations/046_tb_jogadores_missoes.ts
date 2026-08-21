import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class TbJogadoresMissoes extends BaseSchema {
  protected tableName = "tb_jogadores_missoes";

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments("id");
      table
        .integer("jogador_id")
        .unsigned()
        .notNullable()
        .references("id")
        .inTable("tb_jogadores")
        .onDelete("CASCADE");
      table.integer("ciclo").notNullable().defaultTo(1);
      table.integer("ordem").notNullable();
      table.string("tipo", 40).notNullable();
      table.string("nome", 120).notNullable();
      table.string("descricao", 220).notNullable();
      table.decimal("meta", 10, 2).notNullable();
      table.decimal("progresso", 10, 2).notNullable().defaultTo(0);
      table.boolean("concluida").notNullable().defaultTo(false);
      table.timestamp("concluida_em", { useTz: true }).nullable();
      table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(this.now());
      table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(this.now());

      table.unique(["jogador_id", "ciclo", "ordem"]);
      table.index(["jogador_id", "ciclo"], "idx_missoes_jogador_ciclo");
      table.index(["jogador_id", "concluida"], "idx_missoes_jogador_concluida");
    });
  }

  public async down() {
    this.schema.dropTable(this.tableName);
  }
}

