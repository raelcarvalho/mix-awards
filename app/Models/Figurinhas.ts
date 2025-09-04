import {
  BaseModel,
  column,
  manyToMany,
  ManyToMany,
} from "@ioc:Adonis/Lucid/Orm";
import Album from "App/Models/Album";

export default class Figurinhas extends BaseModel {
  public static table = "tb_figurinhas";

  @column({ isPrimary: true })
  public id: number;

  @column()
  public nome: string;

  @column()
  public imagem: string;

  @column()
  public raridade: "normal" | "epica" | "lendaria";

  @column()
  public ordem: number

  @column()
  public slot: number

  @column()
  public ativo: boolean;

  @manyToMany(() => Album, {
    pivotTable: "tb_album_figurinhas",
    pivotColumns: ['obtida_via', 'nova', 'created_at', 'updated_at'],
  })
  public albuns: ManyToMany<typeof Album>;
}
