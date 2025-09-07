import { DateTime } from "luxon";
import {
  BaseModel,
  BelongsTo,
  belongsTo,
  column,
  HasOne,
  hasOne,
  manyToMany,
  ManyToMany,
  HasMany,
  hasMany,
} from "@ioc:Adonis/Lucid/Orm";

import Partidas from "App/Models/Partidas";
import UsuarioAdm from "./UsuarioAdm";
import Album from "./Album";
import Capsulas from "./Capsulas";

export default class Jogadores extends BaseModel {
  public static table = "tb_jogadores";

  @column({ isPrimary: true })
  public id: number;

  @column()
  public imagem: string;

  @column()
  public nome: string;

  @column({ columnName: "nome_normalizado" })
  public nome_normalizado: string;

  @column({ columnName: "usuario_adm_id" })
  public usuario_adm_id?: number | null;

  @column()
  public gold: number;

  @column()
  public adr: string;

  @column()
  public kills: string;

  @column()
  public assistencias: string;

  @column()
  public mortes: string;

  @column()
  public kda_player: string;

  @column()
  public kast: number;

  @column()
  public flash_assist: string;

  @column()
  public first_kill: string;

  @column()
  public multi_kill: string;

  @column()
  public vitorias: string;

  @column()
  public qtd_partidas: string;

  @column()
  public pontos: string;

  @belongsTo(() => UsuarioAdm, { foreignKey: "usuario_adm_id" })
  public usuarioAdm: BelongsTo<typeof UsuarioAdm>;

  @hasOne(() => Album, { foreignKey: "jogador_id" })
  public album: HasOne<typeof Album>;

  @hasMany(() => Capsulas, { foreignKey: "jogador_id" })
  public capsulas: HasMany<typeof Capsulas>;

  @manyToMany(() => Partidas, {
    pivotTable: "tb_partidas_jogadores",
    localKey: "id",
    relatedKey: "id",
    pivotForeignKey: "jogadores_id",
    pivotRelatedForeignKey: "partidas_id",
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
  public partidas: ManyToMany<typeof Partidas>;

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime;

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime;
}
