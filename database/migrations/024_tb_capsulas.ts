import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class Capsulas extends BaseSchema {
  protected tableName = "tb_capsulas";

  public async up () {
    // Ignorado pois a tabela já existe
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
