import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class Altertable extends BaseSchema {
  protected tableName = "tb_jogadores";

  public async up() {
    const hasGold = await this.schema.hasColumn(this.tableName, "gold");

    if (!hasGold) {
      this.schema.alterTable(this.tableName, (table) => {
        table.integer("gold").notNullable().defaultTo(0);
      });
    }
  }

  public async down() {
    const hasGold = await this.schema.hasColumn(this.tableName, "gold");

    if (hasGold) {
      this.schema.alterTable(this.tableName, (table) => {
        table.dropColumn("gold");
      });
    }
  }
}
