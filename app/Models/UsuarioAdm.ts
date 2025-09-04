import Hash from "@ioc:Adonis/Core/Hash";
import {
  BaseModel,
  beforeSave,
  column,
  HasOne,
  hasOne,
} from "@ioc:Adonis/Lucid/Orm";
import { DateTime } from "luxon";
import Jogadores from "./Jogadores";

export default class UsuarioAdm extends BaseModel {
  public static table = "tb_usuarios_adm";

  @column({ isPrimary: true })
  public id: number;

  @column()
  public nome: string;

  @column()
  public email: string;

  @column({ serializeAs: null, columnName: "senha" })
  public password: string;

  @column()
  public nome_normalizado: string;

  @column()
  public alterar_senha: number;

  @column.dateTime()
  public dt_exclusao: DateTime | null | undefined;

  @column()
  public usuario_admin: boolean;

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime;

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime;

  @hasOne(() => Jogadores, { foreignKey: "usuario_adm_id" })
  public jogador: HasOne<typeof Jogadores>;

  @beforeSave()
  public static async hashPassword(usuarioAdm: UsuarioAdm) {
    if (usuarioAdm.$dirty.password) {
      usuarioAdm.password = await Hash.make(usuarioAdm.password);
    }
  }

  @beforeSave()
  public static async padronizarCampos(usuarioAdm: UsuarioAdm) {
    usuarioAdm.nome = usuarioAdm.nome.toUpperCase();
    usuarioAdm.email = usuarioAdm.email.toLowerCase();
  }
}
