import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class Jogadores extends BaseSchema {
  protected tableName = 'tb_jogadores'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('nome').notNullable()
      table.string('adr').notNullable()
      table.string('kills').notNullable()
      table.string('assistencias').notNullable()
      table.string('mortes').notNullable()
      table.string('kda_player').notNullable()
      table.integer('kast').notNullable()
      table.string('flash_assist').notNullable()
      table.string('first_kill').notNullable()
      table.string('multi_kill').notNullable()
      table.string('vitorias').notNullable()

      table.timestamps(true)
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
