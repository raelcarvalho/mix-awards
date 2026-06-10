import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class TbCopaRevelacoes extends BaseSchema {
  protected tableName = 'tb_copa_revelacoes'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('jogador_id')
        .unsigned()
        .references('id')
        .inTable('tb_jogadores')
        .onDelete('CASCADE')
        .notNullable()
      table
        .integer('figurinha_id')
        .unsigned()
        .references('id')
        .inTable('tb_copa_figurinhas')
        .onDelete('CASCADE')
        .notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.unique(['jogador_id', 'figurinha_id'])
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
