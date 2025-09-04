import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, BelongsTo } from '@ioc:Adonis/Lucid/Orm'
import AlbumAssinaturas from './AlbumAssinaturas'
import Stickers from './Stickers'

export type ObtidaVia = 'capsulas' | 'outros'  // adicione outros canais se necessário

export default class AlbumSticker extends BaseModel {
  public static table = 'tb_album_stickers'

  @column({ isPrimary: true })
  public id: number

  @column({ columnName: 'album_assinaturas_id' })
  public album_assinaturas_id: number

  @column({ columnName: 'sticker_id' })
  public sticker_id: number

  @column()
  public obtida_via: ObtidaVia

  @belongsTo(() => AlbumAssinaturas, { foreignKey: 'album_assinaturas_id' })
  public albumAssinaturas: BelongsTo<typeof AlbumAssinaturas>

  @belongsTo(() => Stickers, { foreignKey: 'sticker_id' })
  public stickers: BelongsTo<typeof Stickers>

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime
}
