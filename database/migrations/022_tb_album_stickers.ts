import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class AlbumStickers extends BaseSchema {
  protected tableName = 'tb_album_stickers'

  public async up () {
    // Ignorado pois a tabela já existe
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
