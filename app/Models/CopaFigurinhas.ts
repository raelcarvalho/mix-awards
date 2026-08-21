import { BaseModel, column } from "@ioc:Adonis/Lucid/Orm";

export default class CopaFigurinhas extends BaseModel {
  public static table = "tb_copa_figurinhas";

  @column({ isPrimary: true })
  public id: number;

  @column()
  public slot: number;

  @column()
  public nome: string;

  @column()
  public imagem: string;

  @column()
  public raridade: "normal" | "epica" | "lendaria" | "mitica" | "god";

  @column()
  public ativo: boolean;
}
