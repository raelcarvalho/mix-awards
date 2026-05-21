"use client";

import React, { useEffect, useState } from "react";
import RevealCard from "./RevealCard";
import { Category, CategoryKey, PlayerItem } from "@/lib/categories";
import { fetchCategoryTop5 } from "@/lib/fetchers";

type Props = { category: Category };
type PlayerWithUi = PlayerItem & { _title?: string };

// 🔹 nomes de tema aceitos pelo RevealCard
type ThemeName =
  | "amber"
  | "violet"
  | "cyan"
  | "rose"
  | "gold"
  | "red"
  | "green"
  | "sky"
  | "purple"
  | "gray"
  | "black";

const THEME_BY_CATEGORY: Record<CategoryKey, ThemeName> = {
  avgAdr: "amber",
  avgKills: "red",
  avgDeaths: "gray",
  avgAssists: "sky",
  avgKdr: "purple",
  avgFirstKill: "green",
  maxSingleScore: "gold",
  bestWinrate: "violet",
  worstWinrate: "black",
  top5RankingPoints: "rose",
  top5FlashAssists: "cyan",
};

export default function CategoryAccordion({ category }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PlayerWithUi[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || items) return;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const rows = await fetchCategoryTop5(category.key as CategoryKey);

        // Garante rank 1..5, cria um Map por rank
        const byRank = new Map<number, PlayerItem>();
        rows
          .slice(0, 5)
          .forEach((r, i) =>
            byRank.set(r.rank || i + 1, { ...r, rank: r.rank || i + 1 })
          );

        // Ordem customizada: 5,3,1,2,4
        const displayOrder = [5, 3, 1, 2, 4];
        const ordered: PlayerWithUi[] = [];
        for (const rk of displayOrder) {
          const it = byRank.get(rk);
          if (it) ordered.push({ ...it, _title: `TOP${rk}` });
        }

        setItems(ordered);
      } catch (e: any) {
        setErr(e?.message ?? "Erro ao carregar");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, items, category.key]);

  // 🔹 pega o tema da categoria (fallback para amber)
  const theme: ThemeName =
    THEME_BY_CATEGORY[category.key as CategoryKey] ?? "amber";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03]">
      {/* Cabeçalho do acordeon */}
      <button
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.05] rounded-2xl"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`panel-${category.key}`}
      >
        <div className="min-w-0">
          <div className="font-semibold text-slate-100">{category.title}</div>
          {!!category.hint && (
            <div className="text-xs text-slate-400">{category.hint}</div>
          )}
        </div>

        <span
          className={`shrink-0 text-slate-300 transition-transform ${
            open ? "rotate-180" : "rotate-0"
          }`}
        >
          ▾
        </span>
      </button>

      {/* Painel */}
      {open && (
        <div id={`panel-${category.key}`} className="px-4 pb-5">
          {loading && (
            <div className="text-slate-300 text-sm py-3">Carregando…</div>
          )}

          {err && <div className="text-red-300 text-sm py-3">Erro: {err}</div>}

          {items && !items.length && (
            <div className="text-slate-400 text-sm py-3">
              Sem dados para esta categoria.
            </div>
          )}

          {items && items.length > 0 && (
            <div className="mt-4">
              {/* grid dos cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
                {items.map((p) => (
                  <RevealCard
                    key={p.id}
                    title={p._title ?? `TOP${p.rank}`}
                    name={p.name}
                    nick={p.nick}
                    photoUrl={p.photoUrl}
                    theme={theme} // 🔹 tema aplicado aqui
                    // color="#22c55e" // (opcional) cor livre que sobrepõe o tema
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
