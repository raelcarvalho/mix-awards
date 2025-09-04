import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class AlbumFigurinhas extends BaseSchema {
  protected tableName = 'tb_album_figurinhas'

  public async up () {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('nova').notNullable().defaultTo(true)
    })
  }

  public async down () {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('nova')
    })
  }
}