import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class Stickers extends BaseSchema {
  protected tableName = 'tb_stickers'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('nome').notNullable()
      table.integer('ordem').nullable()
      table.integer('slot').nullable()

      table.timestamps(true)
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
