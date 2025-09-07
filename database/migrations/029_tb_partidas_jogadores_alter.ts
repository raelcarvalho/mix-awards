import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class AddPartidaGanhaToTbPartidasJogadores extends BaseSchema {
  protected tableName = "tb_partidas_jogadores";

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean("partida_ganha").notNullable().defaultTo(false);
      table.index(["partida_ganha"], "tb_partidas_jogadores_partida_ganha_idx");
    });
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(
        ["partida_ganha"],
        "tb_partidas_jogadores_partida_ganha_idx"
      );
      table.dropColumn("partida_ganha");
    });
  }
}
