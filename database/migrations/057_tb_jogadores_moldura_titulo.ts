import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class Altertable extends BaseSchema {
  protected tableName = "tb_jogadores";

  public async up() {
    const hasMoldura = await this.schema.hasColumn(
      this.tableName,
      "moldura_equipada"
    );
    const hasTitulo = await this.schema.hasColumn(
      this.tableName,
      "titulo_equipado"
    );

    if (!hasMoldura || !hasTitulo) {
      this.schema.alterTable(this.tableName, (table) => {
        if (!hasMoldura) table.string("moldura_equipada").nullable();
        if (!hasTitulo) table.string("titulo_equipado").nullable();
      });
    }
  }

  public async down() {
    const hasMoldura = await this.schema.hasColumn(
      this.tableName,
      "moldura_equipada"
    );
    const hasTitulo = await this.schema.hasColumn(
      this.tableName,
      "titulo_equipado"
    );

    if (hasMoldura || hasTitulo) {
      this.schema.alterTable(this.tableName, (table) => {
        if (hasMoldura) table.dropColumn("moldura_equipada");
        if (hasTitulo) table.dropColumn("titulo_equipado");
      });
    }
  }
}
