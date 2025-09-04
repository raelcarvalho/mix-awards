import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, BelongsTo, hasMany, HasMany } from '@ioc:Adonis/Lucid/Orm'
import Jogadores from './Jogadores'
import CapsulasItens from './CapsulasItens'

export type CapsulaStatus = 'fechado' | 'aberto'

export default class Capsulas extends BaseModel {
  public static table = 'tb_capsulas'

  @column({ isPrimary: true })
  public id: number

  @column({ columnName: 'jogador_id' })
  public jogador_id: number

  @belongsTo(() => Jogadores, { foreignKey: 'jogador_id' })
  public jogadores: BelongsTo<typeof Jogadores>

  @column({ columnName: 'preco_gold' })
  public preco_gold: number

  @column({ columnName: 'qtd_itens' })
  public qtd_itens: number

  @column()
  public status: CapsulaStatus

  @column.dateTime({ columnName: 'aberto_em' })
  public abertoEm?: DateTime | null

  @hasMany(() => CapsulasItens, { foreignKey: 'capsulas_id' })
  public itens: HasMany<typeof CapsulasItens>

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}
