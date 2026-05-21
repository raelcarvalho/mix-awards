import BaseSchema from "@ioc:Adonis/Lucid/Schema"

export default class AddLevelAuditToPartidasJogadores extends BaseSchema {
  protected tableName = "tb_partidas_jogadores"

  public async up() {
    const hasLevelAntes = await this.schema.hasColumn(this.tableName, "level_antes")
    const hasLevelDepois = await this.schema.hasColumn(this.tableName, "level_depois")
    const hasLevelDelta = await this.schema.hasColumn(this.tableName, "level_delta")

    this.schema.alterTable(this.tableName, (table) => {
      if (!hasLevelAntes) table.integer("level_antes").nullable()
      if (!hasLevelDepois) table.integer("level_depois").nullable()
      if (!hasLevelDelta) table.integer("level_delta").nullable()
    })
  }

  public async down() {
    const hasLevelAntes = await this.schema.hasColumn(this.tableName, "level_antes")
    const hasLevelDepois = await this.schema.hasColumn(this.tableName, "level_depois")
    const hasLevelDelta = await this.schema.hasColumn(this.tableName, "level_delta")

    this.schema.alterTable(this.tableName, (table) => {
      if (hasLevelAntes) table.dropColumn("level_antes")
      if (hasLevelDepois) table.dropColumn("level_depois")
      if (hasLevelDelta) table.dropColumn("level_delta")
    })
  }
}
