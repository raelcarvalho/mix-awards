import {
  BaseModel,
  column,
  belongsTo,
  BelongsTo,
  manyToMany,
  ManyToMany,
} from "@ioc:Adonis/Lucid/Orm";
import Jogadores from "App/Models/Jogadores";
import Figurinhas from "./Figurinhas";

export default class Album extends BaseModel {
  public static table = "tb_album";

  @column({ isPrimary: true })
  public id: number;

  @column({ columnName: "jogador_id" })
  public jogador_id: number;

  @belongsTo(() => Jogadores, { foreignKey: "jogador_id" })
  public jogador: BelongsTo<typeof Jogadores>;

  @manyToMany(() => Figurinhas, {
    pivotTable: "tb_album_figurinhas",
    pivotForeignKey: "album_id",
    pivotRelatedForeignKey: "figurinha_id",
    pivotColumns: ["obtida_via", "created_at"],
  })
  public figurinhas: ManyToMany<typeof Figurinhas>;
}
