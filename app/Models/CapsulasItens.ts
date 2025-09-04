import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, BelongsTo } from '@ioc:Adonis/Lucid/Orm'
import Capsulas from './Capsulas'
import Stickers from './Stickers'

export default class CapsulaItem extends BaseModel {
  public static table = 'tb_capsulas_itens'

  @column({ isPrimary: true })
  public id: number

  @column({ columnName: 'capsulas_id' })
  public capsulas_id: number

  @column({ columnName: 'sticker_id' })
  public sticker_id: number

  @column()
  public duplicada: boolean

  @belongsTo(() => Capsulas, { foreignKey: 'capsulas_id' })
  public capsulas: BelongsTo<typeof Capsulas>

  @belongsTo(() => Stickers, { foreignKey: 'sticker_id' })
  public stickers: BelongsTo<typeof Stickers>

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}
