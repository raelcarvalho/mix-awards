import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class AddPartidaGanhaToTbPartidasJogadores extends BaseSchema {
  protected tableName = "tb_partidas_jogadores";

  public async up() {
    const hasPontos = await this.schema.hasColumn(this.tableName, "pontos");

    if (!hasPontos) {
      this.schema.alterTable(this.tableName, (table) => {
        table.string("pontos", 240).notNullable().defaultTo("");
      });
    }
  }

  public async down() {
    const hasPontos = await this.schema.hasColumn(this.tableName, "pontos");

    if (hasPontos) {
      this.schema.alterTable(this.tableName, (table) => {
        table.dropColumn("pontos");
      });
    }
  }
}
