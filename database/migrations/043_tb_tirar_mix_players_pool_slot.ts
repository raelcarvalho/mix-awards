import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class TbTirarMixPlayersPoolSlot extends BaseSchema {
  protected tableName = "tb_tirar_mix_players";

  public async up() {
    const hasPoolSlot = await this.schema.hasColumn(this.tableName, "pool_slot");

    if (!hasPoolSlot) {
      this.schema.alterTable(this.tableName, (table) => {
        table.integer("pool_slot").nullable();
        table.index(["sessao_id", "pool_slot"], "idx_tirar_mix_players_pool_slot");
      });
    }
  }

  public async down() {
    const hasPoolSlot = await this.schema.hasColumn(this.tableName, "pool_slot");

    if (hasPoolSlot) {
      this.schema.alterTable(this.tableName, (table) => {
        table.dropIndex(["sessao_id", "pool_slot"], "idx_tirar_mix_players_pool_slot");
        table.dropColumn("pool_slot");
      });
    }
  }
}
