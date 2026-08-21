import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class TbTirarMixMapasEstado extends BaseSchema {
  protected tableName = "tb_tirar_mix_sessoes";

  private async addIfMissing(column: string, add: (table: any) => void) {
    const exists = await this.schema.hasColumn(this.tableName, column);
    if (exists) return;
    this.schema.alterTable(this.tableName, add);
  }

  private async dropIfExists(column: string, drop: (table: any) => void) {
    const exists = await this.schema.hasColumn(this.tableName, column);
    if (!exists) return;
    this.schema.alterTable(this.tableName, drop);
  }

  public async up() {
    await this.addIfMissing("map_stage", (table) => {
      table
        .enum("map_stage", ["idle", "countdown", "dice", "veto", "done"])
        .notNullable()
        .defaultTo("idle");
    });
    await this.addIfMissing("map_countdown_ends_at", (table) => {
      table.timestamp("map_countdown_ends_at", { useTz: true }).nullable();
    });
    await this.addIfMissing("map_dice_first_turn", (table) => {
      table.enum("map_dice_first_turn", ["A", "B"]).nullable();
    });
    await this.addIfMissing("map_dice_turn", (table) => {
      table.enum("map_dice_turn", ["A", "B"]).nullable();
    });
    await this.addIfMissing("map_dice_winner", (table) => {
      table.enum("map_dice_winner", ["A", "B"]).nullable();
    });
    await this.addIfMissing("map_dice_a_d1", (table) => {
      table.integer("map_dice_a_d1").nullable();
    });
    await this.addIfMissing("map_dice_a_d2", (table) => {
      table.integer("map_dice_a_d2").nullable();
    });
    await this.addIfMissing("map_dice_a_total", (table) => {
      table.integer("map_dice_a_total").nullable();
    });
    await this.addIfMissing("map_dice_b_d1", (table) => {
      table.integer("map_dice_b_d1").nullable();
    });
    await this.addIfMissing("map_dice_b_d2", (table) => {
      table.integer("map_dice_b_d2").nullable();
    });
    await this.addIfMissing("map_dice_b_total", (table) => {
      table.integer("map_dice_b_total").nullable();
    });
    await this.addIfMissing("map_veto_turn", (table) => {
      table.enum("map_veto_turn", ["A", "B"]).nullable();
    });
    await this.addIfMissing("map_veto_deadline", (table) => {
      table.timestamp("map_veto_deadline", { useTz: true }).nullable();
    });
    await this.addIfMissing("mapa_escolhido", (table) => {
      table.string("mapa_escolhido", 120).nullable();
    });
    await this.addIfMissing("mapa_escolhido_em", (table) => {
      table.timestamp("mapa_escolhido_em", { useTz: true }).nullable();
    });
  }

  public async down() {
    await this.dropIfExists("mapa_escolhido_em", (table) => table.dropColumn("mapa_escolhido_em"));
    await this.dropIfExists("mapa_escolhido", (table) => table.dropColumn("mapa_escolhido"));
    await this.dropIfExists("map_veto_deadline", (table) => table.dropColumn("map_veto_deadline"));
    await this.dropIfExists("map_veto_turn", (table) => table.dropColumn("map_veto_turn"));
    await this.dropIfExists("map_dice_b_total", (table) => table.dropColumn("map_dice_b_total"));
    await this.dropIfExists("map_dice_b_d2", (table) => table.dropColumn("map_dice_b_d2"));
    await this.dropIfExists("map_dice_b_d1", (table) => table.dropColumn("map_dice_b_d1"));
    await this.dropIfExists("map_dice_a_total", (table) => table.dropColumn("map_dice_a_total"));
    await this.dropIfExists("map_dice_a_d2", (table) => table.dropColumn("map_dice_a_d2"));
    await this.dropIfExists("map_dice_a_d1", (table) => table.dropColumn("map_dice_a_d1"));
    await this.dropIfExists("map_dice_winner", (table) => table.dropColumn("map_dice_winner"));
    await this.dropIfExists("map_dice_turn", (table) => table.dropColumn("map_dice_turn"));
    await this.dropIfExists("map_dice_first_turn", (table) =>
      table.dropColumn("map_dice_first_turn")
    );
    await this.dropIfExists("map_countdown_ends_at", (table) =>
      table.dropColumn("map_countdown_ends_at")
    );
    await this.dropIfExists("map_stage", (table) => table.dropColumn("map_stage"));
  }
}
