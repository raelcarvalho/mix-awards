import BaseSchema from "@ioc:Adonis/Lucid/Schema";

// FKs no Postgres não criam índice automaticamente (diferente de PK). A tela
// "Tirar Time" faz poll a cada ~1.2s enquanto uma sessão está ativa, e cada
// poll monta as estatísticas de mapa via join em tb_partidas_jogadores
// filtrando por jogadores_id — sem índice, isso era um seq scan repetido na
// tabela inteira a cada poll de cada cliente conectado.
export default class TbPartidasJogadoresIndexes extends BaseSchema {
  protected tableName = "tb_partidas_jogadores";

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.index(["jogadores_id"], "tb_partidas_jogadores_jogadores_id_idx");
      table.index(["partidas_id"], "tb_partidas_jogadores_partidas_id_idx");
    });
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(["jogadores_id"], "tb_partidas_jogadores_jogadores_id_idx");
      table.dropIndex(["partidas_id"], "tb_partidas_jogadores_partidas_id_idx");
    });
  }
}
