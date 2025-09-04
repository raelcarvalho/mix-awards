import {
  BaseModel,
  column,
  belongsTo,
  BelongsTo,
  hasMany,
  HasMany,
} from "@ioc:Adonis/Lucid/Orm";
import Jogadores from "App/Models/Jogadores";
import PacotesItens from "./PacotesItens";
import { DateTime } from "luxon";

export default class Pacotes extends BaseModel {
  public static table = "tb_pacotes";

  @column({ isPrimary: true })
  public id: number;

  @column()
  public jogador_id: number;

  @column()
  public preco_gold: number;

  @column()
  public qtd_itens: number;

  @column()
  public status: "fechado" | "aberto";

  @column.dateTime()
  public abertoEm: DateTime;

  @belongsTo(() => Jogadores, { foreignKey: "jogadorId" })
  public jogador: BelongsTo<typeof Jogadores>;

  @hasMany(() => PacotesItens, { foreignKey: "pacoteId" })
  public itens: HasMany<typeof PacotesItens>;
}
