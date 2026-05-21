import BaseSchema from "@ioc:Adonis/Lucid/Schema"

export default class AddLevelColumnsToJogadores extends BaseSchema {
  protected tableName = "tb_jogadores"

  public async up() {
    const hasLevel = await this.schema.hasColumn(this.tableName, "level")
    const hasLevelPontos = await this.schema.hasColumn(this.tableName, "level_pontos")

    this.schema.alterTable(this.tableName, (table) => {
      if (!hasLevel) {
        table.integer("level").notNullable().defaultTo(0)
      }
      if (!hasLevelPontos) {
        table.integer("level_pontos").notNullable().defaultTo(0)
      }
    })
  }

  public async down() {
    const hasLevel = await this.schema.hasColumn(this.tableName, "level")
    const hasLevelPontos = await this.schema.hasColumn(this.tableName, "level_pontos")

    this.schema.alterTable(this.tableName, (table) => {
      if (hasLevel) {
        table.dropColumn("level")
      }
      if (hasLevelPontos) {
        table.dropColumn("level_pontos")
      }
    })
  }
}
