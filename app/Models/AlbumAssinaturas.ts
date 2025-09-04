import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, BelongsTo, hasMany, HasMany } from '@ioc:Adonis/Lucid/Orm'
import AlbumStickers from './AlbumStickers'
import Jogadores from './Jogadores'

export default class AlbumAssinatura extends BaseModel {
  public static table = 'tb_album_assinaturas'

  @column({ isPrimary: true })
  public id: number

  @column({ columnName: 'jogador_id' })
  public jogador_id: number

  @belongsTo(() => Jogadores, { foreignKey: 'jogador_id' })
  public jogadores: BelongsTo<typeof Jogadores>

  @hasMany(() => AlbumStickers, { foreignKey: 'album_assinaturas_id' })
  public albumStickers: HasMany<typeof AlbumStickers>

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}
