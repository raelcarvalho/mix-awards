import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class TbTirarMixSessoes extends BaseSchema {
  protected tableName = "tb_tirar_mix_sessoes";

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments("id");

      table
        .enum("status", [
          "criando",
          "capitaes_definidos",
          "draft_em_andamento",
          "finalizado",
          "cancelado",
        ])
        .notNullable()
        .defaultTo("criando");

      table.integer("par_impar_numero").nullable();
      table.enum("par_impar_vencedor", ["A", "B"]).nullable();

      table
        .integer("time_a_capitao_id")
        .unsigned()
        .references("id")
        .inTable("tb_jogadores")
        .onDelete("SET NULL")
        .nullable();
      table
        .integer("time_b_capitao_id")
        .unsigned()
        .references("id")
        .inTable("tb_jogadores")
        .onDelete("SET NULL")
        .nullable();

      table
        .integer("criado_por_usuario_adm_id")
        .unsigned()
        .references("id")
        .inTable("tb_usuarios_adm")
        .notNullable();

      table.integer("turno_index").notNullable().defaultTo(0);
      table.integer("turno_consumidos").notNullable().defaultTo(0);

      table.timestamp("iniciado_em", { useTz: true }).nullable();
      table.timestamp("finalizado_em", { useTz: true }).nullable();

      table.timestamps(true);

      table.index(["status"]);
      table.index(["criado_por_usuario_adm_id"]);
    });
  }

  public async down() {
    this.schema.dropTable(this.tableName);
  }
}
