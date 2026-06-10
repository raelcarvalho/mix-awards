import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class TbCopaFigurinhas extends BaseSchema {
  protected tableName = 'tb_copa_figurinhas'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('slot').notNullable().unique()
      table.string('nome').notNullable()
      table.string('imagem').notNullable()
      table.string('raridade', 20).notNullable().defaultTo('normal')
      table.boolean('ativo').notNullable().defaultTo(true)
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })

    this.defer(async (db) => {
      const now = new Date()
      await db.table(this.tableName).multiInsert([
        { slot: 1, nome: 'Ninfeio', imagem: '/copa/ninfeio.png', raridade: 'normal', created_at: now, updated_at: now },
        { slot: 17, nome: 'Leões de WhatsApp', imagem: '/copa/leoes-whatsapp.png', raridade: 'lendaria', created_at: now, updated_at: now },
        { slot: 18, nome: 'Madkongs', imagem: '/copa/madkongs.png', raridade: 'mitica', created_at: now, updated_at: now },
        { slot: 19, nome: 'Suricalvo', imagem: '/copa/suricalvo.png', raridade: 'mitica', created_at: now, updated_at: now },
        { slot: 20, nome: 'Teteman', imagem: '/copa/teteman.png', raridade: 'god', created_at: now, updated_at: now },
      ])
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
