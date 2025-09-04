import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'

export default class ApiTokens extends BaseModel {
  public static table = 'tb_usuarios_adm_tokens'

  @column({ isPrimary: true })
  public id: number

  @column()
  public user_id: string

  @column()
  public name: string

  @column()
  public type: string

  @column()
  public token: string
}
