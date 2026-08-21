// ── className helper ─────────────────────────────────────────────────────────
export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

// ── Cores de acento do projeto ───────────────────────────────────────────────
export const ACCENT = {
  purple: '#c084fc',
  cyan:   '#22d3ee',
  gold:   '#f5c842',
  green:  '#4ade80',
  orange: '#fb923c',
  pink:   '#f472b6',
  red:    '#f87171',
  amber:  '#fbbf24',
} as const

// Lista usada em rankings e listas de jogadores
export const ACCENT_LIST = [
  ACCENT.gold,
  ACCENT.cyan,
  ACCENT.purple,
  ACCENT.green,
  ACCENT.orange,
  ACCENT.pink,
  ACCENT.amber,
  ACCENT.red,
] as const

// ── Estilos de painel reutilizáveis ──────────────────────────────────────────
export const PANEL_STYLE = {
  background: 'rgba(255,255,255,0.025)',
  border:     '1px solid rgba(255,255,255,0.07)',
} as const

export const PANEL_HOVER = {
  background: 'rgba(255,255,255,0.05)',
} as const

// ── Raridades do álbum ───────────────────────────────────────────────────────
export const RARITY = {
  normal:   { color: '#94a3b8', label: 'Normal'   },
  epica:    { color: '#c084fc', label: 'Épica'    },
  lendaria: { color: '#f5c842', label: 'Lendária' },
  mitica:   { color: '#fb923c', label: 'Mítica'   },
  god:      { color: '#f87171', label: 'GOD'      },
  rara:     { color: '#22d3ee', label: 'Rara'     },
} as const

export type RarityKey = keyof typeof RARITY

// ── Formatar números no padrão BR ────────────────────────────────────────────
export const fmtBR = (n: number) =>
  new Intl.NumberFormat('pt-BR').format(n)

// ── Formatar data ────────────────────────────────────────────────────────────
export const fmtDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR') : '—'
