import { DateTime } from "luxon";
import { BaseModel, column, belongsTo, BelongsTo } from "@ioc:Adonis/Lucid/Orm";
import Jogadores from "./Jogadores";

export default class PartidasJogadores extends BaseModel {
  public static table = "tb_partidas_jogadores";

  @column({ isPrimary: true })
  public id: number;

  @column()
  public nome: string;

  @column()
  public partidas_id: number;

  @column()
  public jogadores_id: number;

  @column()
  public adr: string;

  @column()
  public kills: number;

  @column()
  public assistencias: number;

  @column()
  public mortes: number;

  @column()
  public kda_player: string;

  @column()
  public kast: number;

  @column()
  public time: string;

  @column()
  public flash_assist: number;

  @column()
  public first_kill: number;

  @column()
  public multi_kill: number;

  @column()
  public vitorias: string;

  @column()
  public qtd_partidas: string;

  @column()
  public pontos: string;

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime;

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime;

  @belongsTo(() => Jogadores, {
    foreignKey: "jogadores_id",
  })
  public jogador: BelongsTo<typeof Jogadores>;
}
