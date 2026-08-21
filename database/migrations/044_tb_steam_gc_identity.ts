import BaseSchema from "@ioc:Adonis/Lucid/Schema";

export default class AddSteamGcIdentity extends BaseSchema {
  protected usuariosTable = "tb_usuarios_adm";
  protected jogadoresTable = "tb_jogadores";

  public async up() {
    this.schema.alterTable(this.usuariosTable, (table) => {
      table.string("steam_id", 32).nullable();
      table.string("steam_profile_url", 255).nullable();
      table.string("steam_persona", 120).nullable();
      table.string("steam_avatar", 255).nullable();

      table.bigInteger("gc_id").unsigned().nullable();
      table.string("gc_profile_url", 255).nullable();
      table.string("gc_nick", 120).nullable();
      table.string("gc_nick_normalizado", 120).notNullable().defaultTo("");
      table.timestamp("gc_verified_at", { useTz: false }).nullable();

      table.unique(["steam_id"], "uq_usuarios_adm_steam_id");
      table.unique(["gc_id"], "uq_usuarios_adm_gc_id");
      table.index(
        ["gc_nick_normalizado"],
        "idx_usuarios_adm_gc_nick_normalizado"
      );
    });

    this.schema.alterTable(this.jogadoresTable, (table) => {
      table.bigInteger("gc_id").unsigned().nullable();
      table.string("steam_id", 32).nullable();
      table.string("gc_nick", 120).nullable();
      table.string("gc_nick_normalizado", 120).notNullable().defaultTo("");

      table.unique(["gc_id"], "uq_jogadores_gc_id");
      table.index(["steam_id"], "idx_jogadores_steam_id");
      table.index(
        ["gc_nick_normalizado"],
        "idx_jogadores_gc_nick_normalizado"
      );
    });
  }

  public async down() {
    this.schema.alterTable(this.jogadoresTable, (table) => {
      table.dropIndex(["gc_nick_normalizado"], "idx_jogadores_gc_nick_normalizado");
      table.dropIndex(["steam_id"], "idx_jogadores_steam_id");
      table.dropUnique(["gc_id"], "uq_jogadores_gc_id");

      table.dropColumn("gc_nick_normalizado");
      table.dropColumn("gc_nick");
      table.dropColumn("steam_id");
      table.dropColumn("gc_id");
    });

    this.schema.alterTable(this.usuariosTable, (table) => {
      table.dropIndex(
        ["gc_nick_normalizado"],
        "idx_usuarios_adm_gc_nick_normalizado"
      );
      table.dropUnique(["gc_id"], "uq_usuarios_adm_gc_id");
      table.dropUnique(["steam_id"], "uq_usuarios_adm_steam_id");

      table.dropColumn("gc_verified_at");
      table.dropColumn("gc_nick_normalizado");
      table.dropColumn("gc_nick");
      table.dropColumn("gc_profile_url");
      table.dropColumn("gc_id");

      table.dropColumn("steam_avatar");
      table.dropColumn("steam_persona");
      table.dropColumn("steam_profile_url");
      table.dropColumn("steam_id");
    });
  }
}

