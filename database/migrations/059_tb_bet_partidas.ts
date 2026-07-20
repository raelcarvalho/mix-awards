import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class TbBetPartidas extends BaseSchema {
  protected tableName = "tb_bet_partidas";

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments("id");

      // ID público da partida/bet (gerado ao fim do veto de mapas)
      table.string("codigo", 40).notNullable().unique();

      table
        .integer("sessao_id")
        .unsigned()
        .references("id")
        .inTable("tb_tirar_mix_sessoes")
        .onDelete("CASCADE")
        .notNullable()
        .unique();

      table.string("mapa", 60).notNullable();

      table.integer("time_a_capitao_id").unsigned().nullable();
      table.integer("time_b_capitao_id").unsigned().nullable();
      table.string("nome_time_a", 120).nullable();
      table.string("nome_time_b", 120).nullable();

      table
        .enum("status", ["aberta", "fechada", "liquidada", "cancelada"])
        .notNullable()
        .defaultTo("aberta");

      table.timestamp("abre_em", { useTz: true }).notNullable();
      table.timestamp("fecha_em", { useTz: true }).notNullable();

      // Snapshot completo das odds calculado UMA vez na criação
      // (jogadores, categorias, faixas e multiplicadores). Nenhuma
      // query pesada é feita depois — leitura direta do JSON.
      table.text("odds_json", "longtext").notNullable();

      // Lista dos 10 jogadores da partida (id, time) — usada para
      // bloquear apostas de participantes e para liquidar.
      table.text("jogadores_json").notNullable();

      table
        .integer("partida_id")
        .unsigned()
        .references("id")
        .inTable("tb_partidas")
        .onDelete("SET NULL")
        .nullable();

      table.timestamp("liquidada_em", { useTz: true }).nullable();

      table.timestamps(true);

      table.index(["status"]);
      table.index(["sessao_id"]);
    });
  }

  public async down() {
    this.schema.dropTable(this.tableName);
  }
}
