import BaseSeeder from "@ioc:Adonis/Lucid/Seeder";
import Figurinhas from "App/Models/Figurinhas";

export default class SeedsFigurinhas extends BaseSeeder {
  public async run() {
    const items: Partial<Figurinhas>[] = [];

    const imgNameBySlot = (slot: number) => `figurinha${slot}_.png`;

    const pushRange = (
      raridade: "normal" | "epica" | "lendaria",
      inicioSlot: number,
      qtd: number
    ) => {
      for (let i = 0; i < qtd; i++) {
        const slot = inicioSlot + i;
        const ordem = i + 1;
        const filename = imgNameBySlot(slot);

        items.push({
          nome: `${raridade.toUpperCase()} #${ordem}`,
          imagem: `/uploads/figurinhas/${filename}`,
          raridade,
          ordem,
          slot,
          ativo: true,
        });
      }
    };

    pushRange("normal", 1, 35);
    pushRange("epica", 36, 15);
    pushRange("lendaria", 51, 10);

    const existentes = await Figurinhas.query().count("* as total");
    const total = Number(existentes[0].$extras.total || 0);
    if (total === 0) {
      await Figurinhas.createMany(items as any);
    } else {
      for (const it of items) {
        await Figurinhas.updateOrCreate({ slot: it.slot as number }, it);
      }
    }
  }
}
