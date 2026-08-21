import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class TbCopaFigurinhasPandemonium extends BaseSchema {
  protected tableName = 'tb_copa_figurinhas'

  public async up () {
    this.defer(async (db) => {
      const now = new Date()
      await db.table(this.tableName).insert({
        slot: 16,
        nome: 'Pandemonium',
        imagem: '/copa/pandemonium.png',
        raridade: 'lendaria',
        created_at: now,
        updated_at: now,
      })
    })
  }

  public async down () {
    this.defer(async (db) => {
      await db.from(this.tableName).where('slot', 16).delete()
    })
  }
}
