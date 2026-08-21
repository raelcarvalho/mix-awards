import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class TbTirarMixMapas extends BaseSchema {
  protected tableName = "tb_tirar_mix_mapas";

  public async up() {
    const exists = await this.schema.hasTable(this.tableName);
    if (exists) return;

    this.schema.createTable(this.tableName, (table) => {
      table.increments("id");
      table
        .integer("sessao_id")
        .unsigned()
        .references("id")
        .inTable("tb_tirar_mix_sessoes")
        .onDelete("CASCADE")
        .notNullable();
      table.string("mapa", 120).notNullable();
      table.boolean("banido").notNullable().defaultTo(false);
      table.enum("banido_por_time", ["A", "B"]).nullable();
      table.integer("ordem_ban").nullable();
      table.timestamp("banido_em", { useTz: true }).nullable();
      table.timestamps(true);

      table.unique(["sessao_id", "mapa"]);
      table.index(["sessao_id"]);
      table.index(["banido"]);
    });
  }

  public async down() {
    const exists = await this.schema.hasTable(this.tableName);
    if (!exists) return;
    this.schema.dropTable(this.tableName);
  }
}
