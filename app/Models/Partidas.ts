import { DateTime } from "luxon";
import {
  BaseModel,
  column,
  manyToMany,
  ManyToMany,
} from "@ioc:Adonis/Lucid/Orm";
import Jogadores from "App/Models/Jogadores";

export default class Partidas extends BaseModel {
  public static table = "tb_partidas";

  @column({ isPrimary: true })
  public id: number;

  @column()
  public mapa: string;

  @column()
  public data: Date;

  @column()
  public codigo: number;

  @column()
  public resultado_time1: number;

  @column()
  public resultado_time2: number;

  @column()
  public nome_time1: string;

  @column()
  public nome_time2: string;

  @manyToMany(() => Jogadores, {
    pivotTable: "tb_partidas_jogadores",
    localKey: "id",
    relatedKey: "id",
    pivotForeignKey: "partidas_id",
    pivotRelatedForeignKey: "jogadores_id",
    pivotColumns: [
      "nome",
      "time",
      "vitorias",
      "kills",
      "assistencias",
      "mortes",
      "kast",
      "flash_assist",
      "first_kill",
      "multi_kill",
      "adr",
      "qtd_partidas",
      "pontos",
      "partida_ganha",
    ],
  })
  public jogadores: ManyToMany<typeof Jogadores>;

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime;

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime;
}
