import { BaseModel, column, belongsTo, BelongsTo } from "@ioc:Adonis/Lucid/Orm";
import Pacotes from "App/Models/Pacotes";
import Figurinha from "App/Models/Figurinhas";

export default class PacotesItens extends BaseModel {
  public static table = "tb_pacotes_itens";

  @column({ isPrimary: true })
  public id: number;

  @column({ columnName: 'pacote_id' })
  public pacotes_id: number;

  @column({ columnName: 'figurinha_id' })
  public figurinha_id: number;

  @column()
  public duplicada: boolean;

  @belongsTo(() => Pacotes, { foreignKey: "pacotes_id" })
  public pacotes: BelongsTo<typeof Pacotes>;

  @belongsTo(() => Figurinha, { foreignKey: "figurinha_id" })
  public figurinha: BelongsTo<typeof Figurinha>;
}
