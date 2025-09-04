// app/Models/PartidaRecompensa.ts
import { DateTime } from 'luxon'
import { BaseModel, BelongsTo, belongsTo, column } from '@ioc:Adonis/Lucid/Orm'
import Partidas from 'App/Models/Partidas'
import Jogadores from 'App/Models/Jogadores'

export default class PartidasRecompensas extends BaseModel {
  public static table = 'tb_partidas_recompensas'

  @column({ isPrimary: true })
  public id: number

  @column({ columnName: 'partida_id' })
  public partida_id: number

  @column({ columnName: 'jogador_id' })
  public jogador_id: number

  @column({ columnName: 'gold_creditado' })
  public gold_creditado: number

  @column.dateTime({ columnName: 'created_at' })
  public createdAt: DateTime

  @belongsTo(() => Partidas, { foreignKey: 'partida_id' })
  public partida: BelongsTo<typeof Partidas>

  @belongsTo(() => Jogadores, { foreignKey: 'jogador_id' })
  public jogador: BelongsTo<typeof Jogadores>
}
