import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class Altertable extends BaseSchema {
  protected tableName = "tb_usuarios_adm";

   public async up () {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('usuario_admin').notNullable().defaultTo(false)
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('usuario_admin')
    });
  }
}
