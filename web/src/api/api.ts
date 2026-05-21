// ─── Token helpers ─────────────────────────────────────────────────────────
const normalizeToken = (raw: string | null): string => {
  if (!raw) return ''
  if (raw.startsWith('{') || raw.startsWith('[')) {
    try {
      const obj = JSON.parse(raw)
      return obj?.token?.token || obj?.token || ''
    } catch { return '' }
  }
  return String(raw).replace(/^"+|"+$/g, '')
}

export const getToken = () => normalizeToken(localStorage.getItem('auth_token'))
export const getUser  = (): Record<string, any> | null => {
  try { return JSON.parse(localStorage.getItem('auth_user') || 'null') }
  catch { return null }
}
export const setAuth = (token: string, user: object) => {
  localStorage.setItem('auth_token', token)
  localStorage.setItem('auth_user', JSON.stringify(user))
}
export const clearAuth = () => {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('auth_user')
}

// ─── Base fetch ─────────────────────────────────────────────────────────────
async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(url, { credentials: 'include', ...options, headers })
  const raw = await res.text()

  let data: any = {}
  if (raw) {
    try {
      data = JSON.parse(raw)
    } catch {
      data = { message: raw }
    }
  }

  if (res.status === 401) {
    clearAuth()
    throw new Error(data?.mensagem || data?.message || 'Unauthorized')
  }

  if (!res.ok) throw new Error(data?.mensagem || data?.message || 'Erro na requisição')
  return data as T
}

const unwrapArray = (data: any): any[] => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.resultados)) return data.resultados
  if (Array.isArray(data?.resultados?.jogadores)) return data.resultados.jogadores
  if (Array.isArray(data?.resultados?.partidas)) return data.resultados.partidas
  if (Array.isArray(data?.jogadores)) return data.jogadores
  if (Array.isArray(data?.partidas)) return data.partidas
  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data?.rows)) return data.rows
  return []
}

// ─── Auth ───────────────────────────────────────────────────────────────────
export const login = (email: string, senha: string) =>
  apiFetch<any>('/login', { method: 'POST', body: JSON.stringify({ email, senha }) })

export const logout = () =>
  apiFetch<any>('/api/logout', { method: 'POST' }).catch(() => {})

export const cadastrar = (
  nome: string,
  email: string,
  senha: string,
  nome_normalizado?: string
) =>
  apiFetch<any>('/cadastrar', {
    method: 'POST',
    body: JSON.stringify({ nome, email, senha, nome_normalizado }),
  })

export const alterarSenha = (senha_anterior: string, nova_senha: string) =>
  apiFetch<any>('/alterar-senha', { method: 'POST', body: JSON.stringify({ senha_anterior, nova_senha }) })

// ─── Jogadores / Ranking ────────────────────────────────────────────────────
export const listarJogadores = async () =>
  unwrapArray(
    await apiFetch<any>('/api/players').catch(() => apiFetch<any>('/api/partida/ranking'))
  )

export const meuGold = (usuario_id?: number) =>
  apiFetch<{ gold: number; jogador_id?: number; imagem?: string; level?: number; level_pontos?: number }>(
    `/api/players/me${usuario_id ? `?usuario_id=${usuario_id}` : ''}`
  ).catch(() =>
    apiFetch<{ gold: number; jogador_id?: number; imagem?: string; level?: number; level_pontos?: number }>(
      `/api/jogadores/gold${usuario_id ? `?usuario_id=${usuario_id}` : ''}`
    )
  )

export const vincularJogador = (id: number) =>
  apiFetch<any>(`/api/players/${id}/link`, { method: 'POST' }).catch(() =>
    apiFetch<any>(`/api/jogadores/vincular/${id}`, { method: 'POST' })
  )

// ─── Partidas ───────────────────────────────────────────────────────────────
export const listarPartidas = async (player?: string) =>
  unwrapArray(
    await apiFetch<any>(
      `/api/matches${
        player && String(player).trim()
          ? `?player=${encodeURIComponent(String(player).trim())}`
          : ''
      }`
    ).catch(() =>
      apiFetch<any>(
        `/api/partida/listar${
          player && String(player).trim()
            ? `?player=${encodeURIComponent(String(player).trim())}`
            : ''
        }`
      )
    )
  )

export const detalhesPartida = (codigo: string) =>
  apiFetch<any>(`/api/matches/${codigo}`).catch(() =>
    apiFetch<any>(`/api/partida/detalhes/${codigo}`)
  )

export const importarJson = (json: object) =>
  apiFetch<any>('/api/matches', { method: 'POST', body: JSON.stringify(json) }).catch(() =>
    apiFetch<any>('/api/partida/importar-json', { method: 'POST', body: JSON.stringify(json) })
  )

export const deletarPartida = (id: number) =>
  apiFetch<any>(`/api/matches/${id}`, { method: 'DELETE' }).catch(() =>
    apiFetch<any>(`/api/partida/deletar/${id}`, { method: 'DELETE' })
  )

// ─── Levels ─────────────────────────────────────────────────────────────────
export interface LevelInfo {
  level: number
  nome: string
  tier: 'bronze' | 'prata' | 'ouro' | 'platina' | 'apex'
  pts_inicio: number
  pts_para_proximo: number | null
}

export interface LevelProgress {
  pontos_no_level: number
  pontos_para_proximo: number | null
  percentual: number
}

export interface PlayerLevelSnapshot {
  jogador_id: number
  nome: string
  pontos_totais: number
  level: number
  level_nome: string
  tier: LevelInfo['tier']
  progresso: LevelProgress
}

export interface LevelSimulationInput {
  jogador_id: number
  kills: number
  deaths: number
  assists: number
  adr: number
  partida_ganha: boolean
  levels_adversarios: number[]
}

export const listarLevels = async () =>
  unwrapArray(await apiFetch<any>('/api/levels'))

export const buscarLevelJogador = async (jogadorId: number) =>
  ((await apiFetch<any>(`/api/levels/players/${jogadorId}`))?.resultados || null) as PlayerLevelSnapshot | null

export const simularLevel = async (payload: LevelSimulationInput) =>
  (await apiFetch<any>('/api/levels/simulations', {
    method: 'POST',
    body: JSON.stringify(payload),
  }))?.resultados

// ─── Shop ───────────────────────────────────────────────────────────────────
export const comprarPacotes = (quantidade: number) =>
  apiFetch<any>('/shop/comprar', { method: 'POST', body: JSON.stringify({ quantidade }) })

export const comprarCapsulas = (quantidade: number) =>
  apiFetch<any>('/shop/comprar-capsulas', { method: 'POST', body: JSON.stringify({ quantidade }) })

export const comprarBonusPontos = () =>
  apiFetch<any>('/shop/comprar-bonus-pontos', { method: 'POST' })

export const listarPacotesFechados = () =>
  apiFetch<any>('/shop/listar-pacote-fechado')

export const albumStatus = () =>
  apiFetch<any>('/shop/album-status')

// ─── Álbum Figurinhas ───────────────────────────────────────────────────────
export const meuAlbum = () =>
  apiFetch<any>('/album')

export const abrirPacote = (pacote_id: number) =>
  apiFetch<any>('/album/pacotes/abrir', { method: 'POST', body: JSON.stringify({ pacote_id }) })

export const ackFigurinhasNovas = (figurinhaIds: number[]) =>
  apiFetch<any>('/album/ack-novas', {
    method: 'POST',
    body: JSON.stringify({ figurinhaIds }),
  })

// ─── Álbum Stickers ─────────────────────────────────────────────────────────
export const meuAlbumStickers = () =>
  apiFetch<any>('/album/stickers')

export const revelarSticker = (slot: number) =>
  apiFetch<any>('/album/stickers/revelar', {
    method: 'POST',
    // Compatível com backend novo (slot) e legado (capsulas_itens_id).
    body: JSON.stringify({ slot, capsulas_itens_id: slot }),
  })

export const stickersRevelados = () =>
  apiFetch<any>('/album/stickers/revelados')

const unwrapResult = <T = any>(data: any): T => (data?.resultados ?? data) as T

type MixTeam = 'A' | 'B'

export interface MixMapPlayerStats {
  jogador_id: number
  nome: string
  partidas: number
  vitorias: number
  winRate: number
  mirrored: boolean
}

export interface MixMapCard {
  id: number
  mapa: string
  image: string
  banido: boolean
  banidoPorTeam: MixTeam | null
  ordemBan: number | null
  selected: boolean
  stats: {
    A: MixMapPlayerStats[]
    B: MixMapPlayerStats[]
  }
}

export interface MixPlayer {
  id: number
  sessao_id: number
  jogador_id: number
  is_selecionado: boolean
  is_capitao: boolean
  time: MixTeam | null
  ordem_pick: number | null
  nome: string
  imagem: string | null
  kda_player: string | null
  pontos: string | null
  kills: string | null
  adr: string | null
  vitorias: string | null
  qtd_partidas: string | null
  level: number | string | null
}

export interface TirarMixSnapshot {
  id: number
  status: 'criando' | 'capitaes_definidos' | 'draft_em_andamento' | 'finalizado' | 'cancelado'
  fase: 'aguardando_capitaes' | 'aguardando_inicio' | 'countdown' | 'dice' | 'draft' | 'finalizado'
  message: string
  start: {
    readyA: boolean
    readyB: boolean
    readyCount: number
    total: number
    countdownSeconds: number
  }
  dice: {
    firstTurn: MixTeam | null
    turn: MixTeam | null
    winner: MixTeam | null
    a: { d1: number | null; d2: number | null; total: number | null }
    b: { d1: number | null; d2: number | null; total: number | null }
  }
  draft: {
    pickTurn: MixTeam | null
    pickSecondsLeft: number
  }
  mapDraft: {
    stage: 'idle' | 'countdown' | 'dice' | 'veto' | 'done'
    countdownSeconds: number
    vetoSecondsLeft: number
    selectedMap: string | null
    dice: {
      firstTurn: MixTeam | null
      turn: MixTeam | null
      winner: MixTeam | null
      a: { d1: number | null; d2: number | null; total: number | null }
      b: { d1: number | null; d2: number | null; total: number | null }
    }
    veto: {
      turn: MixTeam | null
    }
    maps: MixMapCard[]
  }
  teams: {
    A: { captain: MixPlayer | null; picks: MixPlayer[]; total: number }
    B: { captain: MixPlayer | null; picks: MixPlayer[]; total: number }
  }
  pool: MixPlayer[]
  online: Array<{
    id: number
    nome: string
    imagem: string | null
    kda_player: string | null
    pontos: string | null
    kills: string | null
    adr: string | null
    vitorias: string | null
    qtd_partidas: string | null
    level: number | string | null
    usuario_id: number
    last_seen: string
  }>
  me: {
    jogador_id: number | null
    role: 'capitao' | 'jogador' | 'fora'
    team: MixTeam | null
  }
}

const MIX_CLIENT_SESSION_KEY = 'mix_client_session'
const getMixClientSession = () => {
  const existing = localStorage.getItem(MIX_CLIENT_SESSION_KEY)
  if (existing) return existing
  const generated = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  localStorage.setItem(MIX_CLIENT_SESSION_KEY, generated)
  return generated
}
const mixHeaders = () => ({ 'x-client-session': getMixClientSession() })

export const mixHeartbeat = async () =>
  unwrapResult<{ online_count: number }>(
    await apiFetch<any>('/api/tirar-mix/heartbeat', { method: 'POST', headers: mixHeaders() })
  )

export const mixOnline = async () =>
  unwrapArray(await apiFetch<any>('/api/tirar-mix/online'))

export const mixSessaoAtual = async () =>
  unwrapResult<TirarMixSnapshot>(
    await apiFetch<any>('/api/tirar-mix/sessao/atual', { headers: mixHeaders() })
  )

export const mixSessaoNova = async () =>
  unwrapResult<TirarMixSnapshot>(
    await apiFetch<any>('/api/tirar-mix/sessao/nova', {
      method: 'POST',
      headers: mixHeaders(),
    })
  )

export const mixEntrar = async (role: 'capitao' | 'jogador') =>
  unwrapResult<TirarMixSnapshot>(
    await apiFetch<any>('/api/tirar-mix/entrar', {
      method: 'POST',
      headers: mixHeaders(),
      body: JSON.stringify({ role }),
    })
  )

export const mixSair = async () =>
  unwrapResult<TirarMixSnapshot>(
    await apiFetch<any>('/api/tirar-mix/sair', {
      method: 'POST',
      headers: mixHeaders(),
    })
  )

export const mixMockCapitaoOponente = async (sessaoId?: number) =>
  unwrapResult<TirarMixSnapshot>(
    await apiFetch<any>('/api/tirar-mix/mock/capitao-oponente', {
      method: 'POST',
      headers: mixHeaders(),
      body: JSON.stringify(sessaoId ? { sessao_id: sessaoId } : {}),
    })
  )

export const mixMockIniciarOponente = async (sessaoId?: number) =>
  unwrapResult<TirarMixSnapshot>(
    await apiFetch<any>('/api/tirar-mix/mock/iniciar-oponente', {
      method: 'POST',
      headers: mixHeaders(),
      body: JSON.stringify(sessaoId ? { sessao_id: sessaoId } : {}),
    })
  )

export const mixMockRolarDadosOponente = async (sessaoId?: number) =>
  unwrapResult<TirarMixSnapshot>(
    await apiFetch<any>('/api/tirar-mix/mock/dados-oponente', {
      method: 'POST',
      headers: mixHeaders(),
      body: JSON.stringify(sessaoId ? { sessao_id: sessaoId } : {}),
    })
  )

export const mixMockOitoJogadores = async (sessaoId?: number) =>
  unwrapResult<TirarMixSnapshot>(
    await apiFetch<any>('/api/tirar-mix/mock/8-jogadores', {
      method: 'POST',
      headers: mixHeaders(),
      body: JSON.stringify(sessaoId ? { sessao_id: sessaoId } : {}),
    })
  )

export const mixMockPickAleatorio = async (sessaoId?: number) =>
  unwrapResult<TirarMixSnapshot>(
    await apiFetch<any>('/api/tirar-mix/mock/pick-aleatorio', {
      method: 'POST',
      headers: mixHeaders(),
      body: JSON.stringify(sessaoId ? { sessao_id: sessaoId } : {}),
    })
  )

export const mixIniciar = async (sessaoId?: number) =>
  unwrapResult<TirarMixSnapshot>(
    await apiFetch<any>('/api/tirar-mix/draft/iniciar', {
      method: 'POST',
      headers: mixHeaders(),
      body: JSON.stringify(sessaoId ? { sessao_id: sessaoId } : {}),
    })
  )

export const mixRolarDados = async (sessaoId?: number) =>
  unwrapResult<TirarMixSnapshot>(
    await apiFetch<any>('/api/tirar-mix/dados/rolar', {
      method: 'POST',
      headers: mixHeaders(),
      body: JSON.stringify(sessaoId ? { sessao_id: sessaoId } : {}),
    })
  )

export const mixPick = async (playerId: number, sessaoId?: number) =>
  unwrapResult<TirarMixSnapshot>(
    await apiFetch<any>(`/api/tirar-mix/pick/${playerId}`, {
      method: 'POST',
      headers: mixHeaders(),
      body: JSON.stringify(sessaoId ? { sessao_id: sessaoId } : {}),
    })
  )

export const mixBanMapa = async (mapa: string, sessaoId?: number) =>
  unwrapResult<TirarMixSnapshot>(
    await apiFetch<any>(`/api/tirar-mix/mapas/ban/${encodeURIComponent(mapa)}`, {
      method: 'POST',
      headers: mixHeaders(),
      body: JSON.stringify(sessaoId ? { sessao_id: sessaoId } : {}),
    })
  )

export const mixUndo = async (sessaoId?: number) =>
  unwrapResult<TirarMixSnapshot>(
    await apiFetch<any>('/api/tirar-mix/draft/desfazer', {
      method: 'POST',
      headers: mixHeaders(),
      body: JSON.stringify(sessaoId ? { sessao_id: sessaoId } : {}),
    })
  )

export const mixSnapshot = async (sessaoId?: number) => {
  const path = sessaoId ? `/api/tirar-mix/snapshot/${sessaoId}` : '/api/tirar-mix/snapshot'
  return unwrapResult<TirarMixSnapshot>(
    await apiFetch<any>(path, {
      headers: mixHeaders(),
    })
  )
}
