import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class TbTirarMixConvites extends BaseSchema {
  protected tableName = 'tb_tirar_mix_convites'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.integer('sessao_id').unsigned().references('id').inTable('tb_tirar_mix_sessoes').onDelete('CASCADE').notNullable()
      table.integer('jogador_id').unsigned().references('id').inTable('tb_jogadores').onDelete('CASCADE').notNullable()

      table.enum('role', ['capitao']).notNullable().defaultTo('capitao')
      table.enum('time', ['A', 'B']).notNullable()

      table.enum('status', ['pendente', 'aceito', 'recusado', 'expirado']).notNullable().defaultTo('pendente')
      table.uuid('token').notNullable()

      table.timestamp('solicitado_em', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('respondido_em', { useTz: true }).nullable()

      table.timestamps(true)

      table.unique(['sessao_id', 'time'])
      table.index(['sessao_id'])
      table.index(['status'])
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
