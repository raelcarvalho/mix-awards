import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class TbTirarMixSessoesEstadoExtra extends BaseSchema {
  protected tableName = "tb_tirar_mix_sessoes";

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .enum("fase", [
          "aguardando_capitaes",
          "aguardando_inicio",
          "countdown",
          "dice",
          "draft",
          "finalizado",
        ])
        .notNullable()
        .defaultTo("aguardando_capitaes");

      table.boolean("start_ready_a").notNullable().defaultTo(false);
      table.boolean("start_ready_b").notNullable().defaultTo(false);

      table.timestamp("start_countdown_started_at", { useTz: true }).nullable();
      table.timestamp("start_countdown_ends_at", { useTz: true }).nullable();

      table.enum("dice_first_turn", ["A", "B"]).nullable();
      table.enum("dice_turn", ["A", "B"]).nullable();
      table.enum("dice_winner", ["A", "B"]).nullable();

      table.integer("dice_a_d1").nullable();
      table.integer("dice_a_d2").nullable();
      table.integer("dice_a_total").nullable();
      table.integer("dice_b_d1").nullable();
      table.integer("dice_b_d2").nullable();
      table.integer("dice_b_total").nullable();

      table.enum("pick_turn", ["A", "B"]).nullable();
      table.timestamp("pick_deadline", { useTz: true }).nullable();
    });
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn("fase");
      table.dropColumn("start_ready_a");
      table.dropColumn("start_ready_b");
      table.dropColumn("start_countdown_started_at");
      table.dropColumn("start_countdown_ends_at");
      table.dropColumn("dice_first_turn");
      table.dropColumn("dice_turn");
      table.dropColumn("dice_winner");
      table.dropColumn("dice_a_d1");
      table.dropColumn("dice_a_d2");
      table.dropColumn("dice_a_total");
      table.dropColumn("dice_b_d1");
      table.dropColumn("dice_b_d2");
      table.dropColumn("dice_b_total");
      table.dropColumn("pick_turn");
      table.dropColumn("pick_deadline");
    });
  }
}
