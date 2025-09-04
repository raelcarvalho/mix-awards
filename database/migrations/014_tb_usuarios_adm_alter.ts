import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class Altertable extends BaseSchema {
  protected tableName = "tb_usuarios_adm";

   public async up () {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('nome_normalizado', 120).notNullable().defaultTo('')
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('nome_normalizado')
    });
  }
}
