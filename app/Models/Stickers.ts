import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, HasMany } from '@ioc:Adonis/Lucid/Orm'
import AlbumStickers from './AlbumStickers'
import CapsulasItens from './CapsulasItens'

export default class Sticker extends BaseModel {
  public static table = 'tb_stickers'

  @column({ isPrimary: true })
  public id: number

  @column()
  public nome: string

  @column()
  public imagem: string

  @column()
  public ordem?: number | null

  @column()
  public slot?: number | null

  @column()
  public ativo: boolean

  @hasMany(() => AlbumStickers, { foreignKey: 'sticker_id' })
  public albumStickers: HasMany<typeof AlbumStickers>

  @hasMany(() => CapsulasItens, { foreignKey: 'sticker_id' })
  public capsulaItens: HasMany<typeof CapsulasItens>

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}
