import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class MigrationUsuariosAdm extends BaseSchema {
  protected tableName = 'tb_usuarios_adm'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      table.string('nome', 100).notNullable()
      table.string('email', 100).notNullable()
      table.string('senha', 100).notNullable()
      table.tinyint('alterar_senha').notNullable().defaultTo(1)
      table.timestamp('dt_exclusao', { useTz: false }).nullable()
      table.timestamp('created_at', { useTz: false }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: false }).notNullable().defaultTo(this.now())
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
