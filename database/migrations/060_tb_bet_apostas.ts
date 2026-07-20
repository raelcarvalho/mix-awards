import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class TbBetApostas extends BaseSchema {
  protected tableName = "tb_bet_apostas";

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments("id");

      table
        .integer("bet_partida_id")
        .unsigned()
        .references("id")
        .inTable("tb_bet_partidas")
        .onDelete("CASCADE")
        .notNullable();

      table
        .integer("jogador_id")
        .unsigned()
        .references("id")
        .inTable("tb_jogadores")
        .notNullable();

      // Seleções: [{ categoria, jogador_id|null, jogador_nome|null, faixa, odd }]
      table.text("selecoes_json").notNullable();

      table.decimal("multiplicador", 10, 2).notNullable();
      table.integer("valor").notNullable();
      table.integer("retorno_potencial").notNullable();

      table
        .enum("status", ["pendente", "ganha", "perdida", "cancelada"])
        .notNullable()
        .defaultTo("pendente");

      // Resultado por seleção após liquidação:
      // [{ ...selecao, acertou: boolean, valor_real: number|null }]
      table.text("resultado_json").nullable();

      table.boolean("resgatada").notNullable().defaultTo(false);
      table.timestamp("resgatada_em", { useTz: true }).nullable();

      table.timestamps(true);

      table.index(["bet_partida_id"]);
      table.index(["jogador_id"]);
      table.index(["status"]);
    });
  }

  public async down() {
    this.schema.dropTable(this.tableName);
  }
}
