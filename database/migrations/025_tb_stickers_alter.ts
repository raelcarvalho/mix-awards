// Nenhuma alteração necessária, migration já está correta.
import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class AlterStickers extends BaseSchema {
  protected tableName = 'tb_stickers'

  public async up () {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('ativo').notNullable().defaultTo(true)
      table.string("imagem").notNullable()
    })
  }

  public async down () {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('ativo')
      table.dropColumn('imagem')
    })
  }
}