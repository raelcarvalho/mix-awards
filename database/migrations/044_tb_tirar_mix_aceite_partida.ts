import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class TbTirarMixAceitePartida extends BaseSchema {
  public async up() {
    const hasAcceptEndsAt = await this.schema.hasColumn(
      "tb_tirar_mix_sessoes",
      "accept_ends_at"
    );
    if (!hasAcceptEndsAt) {
      this.schema.alterTable("tb_tirar_mix_sessoes", (table) => {
        table.timestamp("accept_ends_at", { useTz: true }).nullable();
      });
    }

    const hasAceitou = await this.schema.hasColumn(
      "tb_tirar_mix_players",
      "aceitou"
    );
    if (!hasAceitou) {
      this.schema.alterTable("tb_tirar_mix_players", (table) => {
        table.boolean("aceitou").notNullable().defaultTo(false);
        table.timestamp("aceitou_em", { useTz: true }).nullable();
      });
    }
  }

  public async down() {
    const hasAcceptEndsAt = await this.schema.hasColumn(
      "tb_tirar_mix_sessoes",
      "accept_ends_at"
    );
    if (hasAcceptEndsAt) {
      this.schema.alterTable("tb_tirar_mix_sessoes", (table) => {
        table.dropColumn("accept_ends_at");
      });
    }

    const hasAceitou = await this.schema.hasColumn(
      "tb_tirar_mix_players",
      "aceitou"
    );
    if (hasAceitou) {
      this.schema.alterTable("tb_tirar_mix_players", (table) => {
        table.dropColumn("aceitou");
        table.dropColumn("aceitou_em");
      });
    }
  }
}
