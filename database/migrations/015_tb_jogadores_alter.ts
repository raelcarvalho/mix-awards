import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class Altertable extends BaseSchema {
  protected tableName = "tb_jogadores";

   public async up () {
    this.schema.alterTable(this.tableName, (table) => {
      table.bigInteger('usuario_adm_id')
        .unsigned()
        .references('id')
        .inTable('tb_usuarios_adm')
        .onDelete('SET NULL')
        .nullable()

      table.string('nome_normalizado', 120).notNullable().defaultTo('')
      table.index(['nome_normalizado'], 'idx_jogadores_nome_normalizado')
      table.index(['usuario_adm_id'], 'idx_jogadores_usuario_adm_id')
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['nome_normalizado'], 'idx_jogadores_nome_normalizado')
      table.dropIndex(['usuario_adm_id'], 'idx_jogadores_usuario_adm_id')
      table.dropColumn('nome_normalizado')
      table.dropColumn('usuario_adm_id')
    })
  }
}
