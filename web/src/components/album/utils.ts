import type { Figurinha, OpenedPackCard } from './types'

export const FALLBACK_TOTAL = 82
export const PER_PAGE = 10

export function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0
  const n = Number(String(value).replace(',', '.').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function fixImagePath(path?: string | null): string {
  const raw = String(path || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  if (raw.startsWith('/')) return raw
  return `/${raw}`
}

export function canonRarity(value: unknown): Figurinha['raridade'] {
  const s = String(value ?? '')
    .trim()
    .toLowerCase()

  if (s === '4') return 'mitica'
  if (s === '3') return 'lendaria'
  if (s === '2') return 'epica'
  if (s === '1' || s === '0') return 'normal'
  if (['normal', 'comum', 'common'].includes(s)) return 'normal'
  if (['épica', 'epica', 'epic', 'rara', 'rare'].includes(s)) return 'epica'
  if (/(legend|lend[aá]r[io]a)/.test(s)) return 'lendaria'
  if (/(mythic|mitic[ao])/i.test(s)) return 'mitica'
  if (/(god|zeus)/.test(s)) return 'god'
  return 'normal'
}

export function rarityBySlot(slot: number): Figurinha['raridade'] {
  if (slot <= 50) return 'normal'
  if (slot <= 70) return 'epica'
  if (slot <= 78) return 'lendaria'
  if (slot <= 81) return 'mitica'
  return 'god'
}

export function normalizeOpenedPackCards(raw: any): OpenedPackCard[] {
  const payload = raw?.resultados ?? raw ?? {}
  const novas = Array.isArray(payload?.novas) ? payload.novas : []
  const duplicadas = Array.isArray(payload?.duplicadas) ? payload.duplicadas : []
  const combined = [
    ...novas.map((item: any) => ({ item, isNew: true, isDuplicate: false })),
    ...duplicadas.map((item: any) => ({ item, isNew: false, isDuplicate: true })),
  ]

  return combined.map((entry: any, idx: number) => {
    const f = entry?.item?.figurinha || entry?.item || {}
    const id = toNumber(f?.id) || idx + 1
    const nome = String(f?.nome || entry?.item?.nome || `Carta #${idx + 1}`).trim() || `Carta #${idx + 1}`
    const imagem = fixImagePath(f?.imagem || f?.img || entry?.item?.imagem || entry?.item?.img || '')
    const raridade = canonRarity(
      f?.raridade ||
        entry?.item?.raridade ||
        f?.raridade_id ||
        f?.raridadeId ||
        entry?.item?.raridade_id ||
        entry?.item?.raridadeId
    )

    return {
      key: `${id}-${idx}-${entry.isDuplicate ? 'dup' : 'new'}`,
      id,
      nome,
      imagem,
      raridade,
      isDuplicate: Boolean(entry.isDuplicate),
      isNew: Boolean(entry.isNew),
    }
  })
}

export function normalizeAlbum(raw: any): { total: number; obtidas: number; figurinhas: Figurinha[] } {
  const payload = raw?.resultados ?? raw ?? {}

  let figurinhas: Figurinha[] = []

  if (Array.isArray(payload?.figurinhas)) {
    figurinhas = payload.figurinhas.map((f: any, idx: number) => {
      const slot = toNumber(f?.slot) || idx + 1
      const raridade = String(f?.raridade || rarityBySlot(slot)).toLowerCase()
      return {
        id: f?.id,
        slot,
        nome: String(f?.nome || `Figurinha ${slot}`),
        imagem: f?.imagem || f?.img,
        raridade: (['normal', 'epica', 'lendaria', 'mitica', 'god'].includes(raridade)
          ? raridade
          : rarityBySlot(slot)) as Figurinha['raridade'],
        possui: Boolean(f?.possui ?? f?.colada),
      }
    })
  } else if (Array.isArray(payload?.slots)) {
    figurinhas = payload.slots.map((f: any, idx: number) => {
      const slot = toNumber(f?.slot) || idx + 1
      const raridade = String(f?.raridade || rarityBySlot(slot)).toLowerCase()
      return {
        id: f?.figurinha?.id,
        slot,
        nome: String(f?.figurinha?.nome || `Figurinha ${slot}`),
        imagem: f?.figurinha?.img || f?.figurinha?.imagem,
        raridade: (['normal', 'epica', 'lendaria', 'mitica', 'god'].includes(raridade)
          ? raridade
          : rarityBySlot(slot)) as Figurinha['raridade'],
        possui: Boolean(f?.colada),
      }
    })
  }

  figurinhas = figurinhas.sort((a, b) => a.slot - b.slot)

  const total = toNumber(payload?.progresso?.total) || figurinhas.length || FALLBACK_TOTAL
  const obtidas = toNumber(payload?.progresso?.obtidas) || figurinhas.filter((f) => f.possui).length

  return { total, obtidas, figurinhas }
}

export function updateHoloPointerVars(target: HTMLElement, xClient: number, yClient: number) {
  const rect = target.getBoundingClientRect()
  const x = ((xClient - rect.left) / rect.width) * 100
  const y = ((yClient - rect.top) / rect.height) * 100
  target.style.setProperty('--mouse-x', `${x}%`)
  target.style.setProperty('--mouse-y', `${y}%`)
}
