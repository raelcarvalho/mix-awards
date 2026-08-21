import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class TbOnlineUsuarios extends BaseSchema {
  protected tableName = "tb_online_usuarios";

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments("id");

      table
        .integer("usuario_id")
        .unsigned()
        .references("id")
        .inTable("tb_usuarios_adm")
        .onDelete("CASCADE")
        .notNullable();
      table
        .integer("jogador_id")
        .unsigned()
        .references("id")
        .inTable("tb_jogadores")
        .onDelete("SET NULL")
        .nullable();

      table.string("session_id", 64).notNullable();
      table.timestamp("last_seen", { useTz: true }).notNullable();
      table.string("user_agent", 180).nullable();

      table.unique(["usuario_id", "session_id"]);
      table.index(["last_seen"]);
      table.index(["usuario_id"]);
    });
  }

  public async down() {
    this.schema.dropTable(this.tableName);
  }
}
