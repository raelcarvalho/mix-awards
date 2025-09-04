// database/migrations/017_tb_figurinhas_alter.ts
import BaseSchema from '@ioc:Adonis/Lucid/Schema'
import Database from '@ioc:Adonis/Lucid/Database'

export default class AlterFigurinhas extends BaseSchema {
  protected tableName = 'tb_figurinhas'

  public async up () {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('raridade', 20).notNullable().alter()

      table.integer('ordem').nullable()
      table.integer('slot').nullable()
    })

    // 2) backfill
    this.defer(async (db) => {
      await db.from(this.tableName).where('raridade', 'rara').update({ raridade: 'epica' })

      const rows: Array<{ id: number; raridade: string }> = await db
        .from(this.tableName)
        .select('id', 'raridade')
        .orderBy('id', 'asc')

      const buckets: Record<'normal'|'epica'|'lendaria', number[]> = {
        normal: [], epica: [], lendaria: [],
      }
      for (const r of rows) {
        const key =
          r.raridade === 'normal' || r.raridade === 'epica' || r.raridade === 'lendaria'
            ? (r.raridade as 'normal'|'epica'|'lendaria')
            : 'normal'
        buckets[key].push(r.id)
      }

      const start: Record<'normal'|'epica'|'lendaria', number> = {
        normal: 1, epica: 36, lendaria: 51,
      }

      // preencher ordem/slot
      for (const rar of ['normal', 'epica', 'lendaria'] as const) {
        const ids = buckets[rar]
        for (let i = 0; i < ids.length; i++) {
          const id = ids[i]
          const ordem = i + 1
          const slot = start[rar] + i
          await db.from(this.tableName).where('id', id).update({ ordem, slot })
        }
      }

      await db.rawQuery(`
        ALTER TABLE ${this.tableName}
          ALTER COLUMN ordem SET NOT NULL,
          ALTER COLUMN slot  SET NOT NULL
      `)

      await db.rawQuery(`
        CREATE INDEX IF NOT EXISTS idx_${this.tableName}_raridade_ordem
          ON ${this.tableName}(raridade, ordem)
      `)
      await db.rawQuery(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_${this.tableName}_slot
          ON ${this.tableName}(slot)
      `)
    })
  }

  public async down () {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('ordem')
      table.dropColumn('slot')
    })

    this.defer(async (db) => {
      try { await db.rawQuery(`DROP INDEX IF EXISTS idx_${this.tableName}_raridade_ordem`) } catch {}
      try { await db.rawQuery(`DROP INDEX IF EXISTS uq_${this.tableName}_slot`) } catch {}
    })
  }
}
