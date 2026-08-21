"use client";

import { useEffect, useMemo, useState } from "react";

type Player = {
  id?: number | string;
  nickname?: string;
  nick?: string;
  nome?: string;

  // campos de avatar possíveis
  imagem?: string;
  avatar_url?: string;
  avatar?: string;

  pontos?: number;
  score?: number;
  total?: number;
};

function nick(p: Player) {
  return p.nickname ?? p.nick ?? p.nome ?? "Jogador";
}
function pts(p: Player) {
  return Number(p.pontos ?? p.score ?? p.total ?? 0);
}
function avatarUrl(p: Player): string | undefined {
  const raw = (p.imagem || p.avatar_url || p.avatar || "").toString().trim();
  if (!raw) return undefined;
  const url = raw.startsWith("//") ? `https:${raw}` : raw;
  if (!/^https?:\/\//i.test(url)) return undefined;
  return url;
}

export default function RollingRankingPreview({
  height = 260,
  visibleRows = 8,
  speed = 36,
}: {
  height?: number;
  visibleRows?: number;
  speed?: number;
}) {
  const [rows, setRows] = useState<Player[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const url = new URL(`/api/partida/ranking`, window.location.origin);
    url.searchParams.set("limit", String(50));
    fetch(url.toString(), { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json();
      })
      .then((payload) => {
        if (!alive) return;
        const list = Array.isArray(payload)
          ? payload
          : "data" in payload
          ? payload.data
          : "rows" in payload
          ? payload.rows
          : [];
        const norm = [...(list ?? [])]
          .map((p: Player) => ({ ...p }))
          .sort((a, b) => pts(b) - pts(a))
          .slice(0, 30);
        setRows(norm);
      })
      .catch((e) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const loop = useMemo(() => {
    if (!rows.length) return [];
    const base = rows.slice(0, Math.max(rows.length, visibleRows));
    return [...base, ...base];
  }, [rows, visibleRows]);

  const itemH = 50; // ~44px + gap
  const contentH = loop.length * itemH;
  const duration = Math.max(10, Math.round(contentH / speed));

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-line bg-panel"
      style={{
        height,
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)",
        maskImage:
          "linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)",
      }}
      title={err ? `Falha ao carregar: ${err}` : "Preview do ranking"}
    >
      <div
        className="absolute inset-0 will-change-transform animate-[scrollY_var(--dur)_linear_infinite] hover:[animation-play-state:paused]"
        style={{ ["--dur" as any]: `${duration}s`, transform: "translateY(0)" }}
      >
        {loop.map((p, i) => (
          <Row
            key={`${p.id ?? nick(p)}-${i}`}
            idx={(i % rows.length) + 1}
            name={nick(p)}
            pts={pts(p)}
            avatar={avatarUrl(p)}
          />
        ))}
      </div>

      <style>{`
        @keyframes scrollY {
          from {
            transform: translateY(0);
          }
          to {
            transform: translateY(-${contentH / 2}px);
          }
        }
      `}</style>
    </div>
  );
}

function Row({
  idx,
  name,
  pts,
  avatar,
}: {
  idx: number;
  name: string;
  pts: number;
  avatar?: string;
}) {
  const FALLBACK =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <div className="flex items-center gap-3">
        <div className="w-8 text-right text-xs text-ink/60">#{idx}</div>
        {avatar ? (
          <img
            src={avatar}
            alt={name}
            className="h-8 w-8 rounded-full object-cover border border-line/60"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              if (!img.dataset.fallback) {
                img.dataset.fallback = "1";
                img.src = FALLBACK;
              }
            }}
          />
        ) : (
          <div className="h-8 w-8 grid place-items-center rounded-full bg-bg1 text-xs text-ink/60">
            {name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="font-medium leading-none">{name}</div>
      </div>
      <div className="text-sm font-semibold text-gold">{pts}</div>
    </div>
  );
}
