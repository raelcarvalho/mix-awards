import { PlayerItem, CategoryKey } from './categories'

function normPhoto(raw?: string): string {
  if (!raw) return '/images/avatar-default.png'
  const src = String(raw).trim()
  if (/^data:/i.test(src)) return src
  if (src.startsWith('/')) return src
  if (/^https?:\/\//i.test(src)) {
    return `/api/proxy-img?u=${encodeURIComponent(src)}`
  }
  return '/' + src
}

type AnyPlayer = {
  id?: number | string
  jogador_id?: number | string
  nome?: string
  name?: string
  nick?: string
  nickname?: string
  player?: string
  imagem?: string
  jogador_imagem?: string
  avatar?: string
  foto_url?: string
  steam_avatar?: string
  avatar_url?: string
  foto?: string
}

function pickName(p: AnyPlayer) {
  return p.nick ?? p.nickname ?? p.name ?? p.nome ?? p.player ?? ''
}

function pickId(p: AnyPlayer) {
  return (p.id ?? p.jogador_id) as string | number | undefined
}

function pickImage(p: AnyPlayer) {
  return (
    p.foto_url ??
    p.steam_avatar ??
    p.avatar_url ??
    p.imagem ??
    p.jogador_imagem ??
    p.avatar ??
    p.foto ??
    ''
  )
}

function unwrapJson(j: any): AnyPlayer[] {
  if (Array.isArray(j)) return j as AnyPlayer[]
  if (!j || typeof j !== 'object') return []
  return (
    j.jogadores ||
    j.resultados?.jogadores ||
    j.resultados ||
    j.data?.jogadores ||
    j.items ||
    []
  )
}

async function fetchPlayersForAvatars(): Promise<AnyPlayer[]> {
  const urls = [
    `/api/jogadores/ranking?t=${Date.now()}`,
    `/api/partida/ranking?t=${Date.now()}`,
    `/api/jogadores?t=${Date.now()}`,
    `/jogadores?t=${Date.now()}`,
  ]

  for (const u of urls) {
    try {
      const r = await fetch(u, { cache: 'no-store', headers: { Accept: 'application/json' } })
      if (!r.ok) continue
      const j = await r.json().catch(() => null)
      const arr = unwrapJson(j)
      if (Array.isArray(arr) && arr.length) return arr as AnyPlayer[]
    } catch {
      // tenta a próxima URL
    }
  }

  return []
}

function buildAvatarIndex(list: AnyPlayer[]) {
  const byId = new Map<string | number, string>()
  const byKey = new Map<string, string>()

  for (const p of list) {
    const img = pickImage(p)
    if (!img) continue
    const url = normPhoto(img)
    const id = pickId(p)
    if (id !== undefined) byId.set(id, url)
    const name = pickName(p)
    if (name) {
      const k = name.toLowerCase()
      if (!byKey.has(k)) byKey.set(k, url)
    }
  }

  return { byId, byKey }
}

export async function fetchCategoryTop5(key: CategoryKey): Promise<PlayerItem[]> {
  const mapKeyToEndpoint: Record<CategoryKey, string> = {
    avgAdr: '/api/partida/ranking?metric=avgAdr&limit=5',
    avgKills: '/api/partida/ranking?metric=avgKills&limit=5',
    avgDeaths: '/api/partida/ranking?metric=avgDeaths&limit=5',
    avgAssists: '/api/partida/ranking?metric=avgAssists&limit=5',
    avgKdr: '/api/partida/ranking?metric=avgKdr&limit=5',
    avgFirstKill: '/api/partida/ranking?metric=avgFirstKill&limit=5',
    maxSingleScore: '/api/partida/ranking?metric=maxSingleScore&limit=5',
    bestWinrate: '/api/partida/ranking?metric=bestWinrate&limit=5',
    worstWinrate: '/api/partida/ranking?metric=worstWinrate&limit=5',
    top5RankingPoints: '/api/partida/ranking?metric=points&limit=5',
    top5FlashAssists: '/api/partida/ranking?metric=flashAssists&limit=5',
  }

  const url = mapKeyToEndpoint[key]
  const res = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Falha ao buscar ${key} — ${res.status} ${res.statusText} ${text}`)
  }

  const baseRows: AnyPlayer[] = await res.json()

  let items: PlayerItem[] = baseRows.map((r: any, i: number) => ({
    id: r.id ?? r.jogador_id ?? i + 1,
    name: r.nome ?? r.name ?? r.player ?? r.nick ?? `Jogador ${i + 1}`,
    nick: r.nick ?? r.nickname ?? r.nome ?? r.player ?? `J${i + 1}`,
    photoUrl: normPhoto(pickImage(r)),
    value: Number(r.valor ?? r.metric_value ?? r.pontos ?? 0),
    rank: Number(r.rank ?? i + 1),
  }))

  const needsEnrich = items.some((p) => p.photoUrl.endsWith('avatar-default.png'))
  if (needsEnrich) {
    const refList = await fetchPlayersForAvatars()
    const idx = buildAvatarIndex(refList)

    items = items.map((p) => {
      if (p.photoUrl && !p.photoUrl.endsWith('avatar-default.png')) return p

      const byId = idx.byId.get(p.id as any)
      if (byId) return { ...p, photoUrl: byId }

      const k1 = p.nick?.toLowerCase() || ''
      const k2 = p.name?.toLowerCase() || ''
      const byK = idx.byKey.get(k1) || idx.byKey.get(k2)
      if (byK) return { ...p, photoUrl: byK }

      return p
    })
  }

  return items
}
