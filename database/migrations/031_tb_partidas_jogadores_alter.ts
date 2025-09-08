import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class AddPartidaGanhaToTbPartidasJogadores extends BaseSchema {
  protected tableName = "tb_partidas_jogadores";

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string("pontos", 240).notNullable().defaultTo("");
    });
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn("pontos");
    });
  }
}
