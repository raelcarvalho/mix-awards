// database/migrations/XXX_update_tb_figurinhas_raridade_check.ts
import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class UpdateTbFigurinhasRaridadeCheck extends BaseSchema {
  protected tableName = 'tb_figurinhas'

  public async up () {
    this.defer(async (db) => {
      // Remove a constraint antiga (nome veio do erro)
      await db.rawQuery(`
        ALTER TABLE ${this.tableName}
        DROP CONSTRAINT IF EXISTS tb_figurinhas_raridade_check
      `)

      // Recria aceitando as 3 raridades novas
      await db.rawQuery(`
        ALTER TABLE ${this.tableName}
        ADD CONSTRAINT tb_figurinhas_raridade_check
        CHECK (raridade IN ('normal','epica','lendaria'))
      `)
    })
  }

  public async down () {
    this.defer(async (db) => {
      // Volta para a checagem anterior (ajuste se seu original era diferente)
      await db.rawQuery(`
        ALTER TABLE ${this.tableName}
        DROP CONSTRAINT IF EXISTS tb_figurinhas_raridade_check
      `)

      await db.rawQuery(`
        ALTER TABLE ${this.tableName}
        ADD CONSTRAINT tb_figurinhas_raridade_check
        CHECK (raridade IN ('normal','epica','rara'))
      `)
    })
  }
}
