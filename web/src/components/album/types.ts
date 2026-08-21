export interface Figurinha {
  id?: number
  slot: number
  nome: string
  imagem?: string
  raridade: 'normal' | 'epica' | 'lendaria' | 'mitica' | 'god'
  possui: boolean
}

export interface SlotView extends Figurinha {
  nova?: boolean
}

export interface OpenedPackCard {
  key: string
  id: number
  nome: string
  imagem?: string
  raridade: Figurinha['raridade']
  isDuplicate: boolean
  isNew: boolean
}

export const RARITY_STYLE: Record<
  Figurinha['raridade'],
  { color: string; label: string; glow: string; infoLabel: string }
> = {
  normal: {
    color: '#94a3b8',
    label: 'Normal',
    glow: 'rgba(148,163,184,.2)',
    infoLabel: 'Carta Normal',
  },
  epica: {
    color: '#c084fc',
    label: 'Épica',
    glow: 'rgba(192,132,252,.3)',
    infoLabel: 'Carta Épica',
  },
  lendaria: {
    color: '#f5c842',
    label: 'Lendária',
    glow: 'rgba(245,200,66,.35)',
    infoLabel: 'Carta Lendária',
  },
  mitica: {
    color: '#fb923c',
    label: 'Mítica',
    glow: 'rgba(251,146,60,.35)',
    infoLabel: 'Carta Mítica',
  },
  god: {
    color: '#56c1ff',
    label: 'GOD',
    glow: 'rgba(86,193,255,.5)',
    infoLabel: 'Carta God',
  },
}
