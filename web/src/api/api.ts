// ─── Token helpers ─────────────────────────────────────────────────────────
const COOKIE_SESSION_MARKER = '__cookie_session__'

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
export const setAuth = (_token: string, user: object) => {
  localStorage.setItem('auth_token', COOKIE_SESSION_MARKER)
  localStorage.setItem('auth_user', JSON.stringify(user))
}
export const clearAuth = () => {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('auth_user')
}

// ─── Base fetch ─────────────────────────────────────────────────────────────
async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  }

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
    const err: any = new Error(data?.mensagem || data?.message || 'Unauthorized')
    err.status = 401
    err.payload = data
    throw err
  }

  if (!res.ok) {
    const err: any = new Error(data?.mensagem || data?.message || 'Erro na requisição')
    err.status = res.status
    err.payload = data
    throw err
  }
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

export type SeasonFilters = {
  seasonId?: number
  month?: string | null
}

const DEFAULT_SEASON_ID = 2

const parseSeasonId = (value: unknown): number => {
  const n = Number(value)
  if (n === 1 || n === 2) return n
  return DEFAULT_SEASON_ID
}

const normalizeMonth = (value: unknown): string | null => {
  const month = String(value ?? '').trim().toLowerCase()
  if (!month || month === 'all' || month === 'todos') return null
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null
  return month
}

const buildSeasonQuery = (
  filters?: SeasonFilters & {
    player?: string
  }
) => {
  const q = new URLSearchParams()
  if (filters?.seasonId !== undefined && filters?.seasonId !== null && String(filters.seasonId).trim() !== '') {
    q.set('season_id', String(parseSeasonId(filters.seasonId)))
  }
  const month = normalizeMonth(filters?.month)
  if (month) q.set('month', month)
  const player = String(filters?.player ?? '').trim()
  if (player) q.set('player', player)
  const query = q.toString()
  return query ? `?${query}` : ''
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

export const steamLoginUrl = (params?: {
  redirect?: string
  gc_profile_url?: string
  gc_id?: number
}) => {
  const q = new URLSearchParams()
  if (typeof window !== 'undefined' && window.location?.origin) {
    q.set('origin', window.location.origin)
  }
  if (params?.redirect) q.set('redirect', params.redirect)
  if (params?.gc_profile_url) q.set('gc_profile_url', params.gc_profile_url)
  if (Number.isFinite(Number(params?.gc_id)) && Number(params?.gc_id) > 0) {
    q.set('gc_id', String(Number(params?.gc_id)))
  }
  return `/auth/steam/login${q.toString() ? `?${q.toString()}` : ''}`
}

export const steamStatus = () =>
  apiFetch<any>('/api/auth/steam/status')

export const steamLoginUrlForLogged = async (params?: {
  redirect?: string
  gc_profile_url?: string
  gc_id?: number
}) => {
  const q = new URLSearchParams()
  if (typeof window !== 'undefined' && window.location?.origin) {
    q.set('origin', window.location.origin)
  }
  if (params?.redirect) q.set('redirect', params.redirect)
  if (params?.gc_profile_url) q.set('gc_profile_url', params.gc_profile_url)
  if (Number.isFinite(Number(params?.gc_id)) && Number(params?.gc_id) > 0) {
    q.set('gc_id', String(Number(params?.gc_id)))
  }
  const data = await apiFetch<any>(
    `/api/auth/steam/login-url${q.toString() ? `?${q.toString()}` : ''}`
  )
  const url = String(data?.resultados?.url || data?.url || '').trim()
  if (!url) throw new Error('Não foi possível iniciar o login Steam.')
  return url
}

export const steamVincularGc = (payload: { gc_profile_url?: string; gc_id?: number }) =>
  apiFetch<any>('/api/auth/steam/vincular-gc', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  })

// ─── Jogadores / Ranking ────────────────────────────────────────────────────
export const listarJogadores = async (filters?: SeasonFilters) => {
  const query = buildSeasonQuery(filters)
  return unwrapArray(
    !getToken()
      ? await apiFetch<any>(`/api/partida/ranking${query}`)
      : await apiFetch<any>(`/api/players${query}`).catch(() =>
          apiFetch<any>(`/api/partida/ranking${query}`)
        )
  )
}

export const meuGold = (usuario_id?: number) =>
  apiFetch<{
    gold: number
    jogador_id?: number
    imagem?: string
    level?: number
    level_pontos?: number
    nome?: string
    gc_nick?: string
  }>(
    `/api/players/me${usuario_id ? `?usuario_id=${usuario_id}` : ''}`
  ).catch(() =>
    apiFetch<{
      gold: number
      jogador_id?: number
      imagem?: string
      level?: number
      level_pontos?: number
      nome?: string
      gc_nick?: string
    }>(
      `/api/jogadores/gold${usuario_id ? `?usuario_id=${usuario_id}` : ''}`
    )
  )

export const vincularJogador = (id: number) =>
  apiFetch<any>(`/api/players/${id}/link`, { method: 'POST' }).catch(() =>
    apiFetch<any>(`/api/jogadores/vincular/${id}`, { method: 'POST' })
  )

export interface PlayerMission {
  id: number
  jogador_id: number
  cycle: number
  order: number
  type: 'kills' | 'assistencias' | 'adr' | 'first_kill' | 'multi_kill' | 'vitorias'
  name: string
  description: string
  target: number
  progress: number
  percentage: number
  completed: boolean
  completed_at: string | null
}

export const resgatarMissoes = async (_jogadorId?: number) => {
  const data = await apiFetch<any>('/api/missions/claim', {
    method: 'POST',
  })
  const payload = data?.resultados ?? data ?? {}
  return {
    missoes: Array.isArray(payload?.missoes) ? (payload.missoes as PlayerMission[]) : [],
    gold_creditado: Number(payload?.gold_creditado || 0),
  }
}

export const listarMissoesJogador = async (jogadorId: number): Promise<PlayerMission[]> => {
  const data = await apiFetch<any>(`/api/missions/players/${jogadorId}`)
  if (Array.isArray(data)) return data as PlayerMission[]
  if (Array.isArray(data?.resultados?.missoes)) return data.resultados.missoes as PlayerMission[]
  if (Array.isArray(data?.missoes)) return data.missoes as PlayerMission[]
  return []
}

// ─── Partidas ───────────────────────────────────────────────────────────────
export const listarPartidas = async (player?: string, filters?: SeasonFilters) => {
  const query = buildSeasonQuery({ ...filters, player })
  return unwrapArray(
    await apiFetch<any>(`/api/matches${query}`).catch(() =>
      apiFetch<any>(`/api/partida/listar${query}`)
    )
  )
}

export const detalhesPartida = (codigo: string) =>
  apiFetch<any>(`/api/matches/${codigo}`).catch(() =>
    apiFetch<any>(`/api/partida/detalhes/${codigo}`)
  )

export const importarJson = (json: object) =>
  apiFetch<any>('/api/matches', { method: 'POST', body: JSON.stringify(json) }).catch((err: any) => {
    const status = Number(err?.status || 0)
    if (status === 404 || status === 405) {
      return apiFetch<any>('/api/partida/importar-json', { method: 'POST', body: JSON.stringify(json) })
    }
    throw err
  })

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

export const listarPacotesFechados = () =>
  apiFetch<any>('/shop/listar-pacote-fechado')

export const listarCosmeticos = () =>
  apiFetch<any>('/shop/cosmeticos')

export const comprarCosmetico = (codigo: string) =>
  apiFetch<any>('/shop/cosmeticos/comprar', { method: 'POST', body: JSON.stringify({ codigo }) })

export const equiparCosmetico = (codigo: string) =>
  apiFetch<any>('/shop/cosmeticos/equipar', { method: 'POST', body: JSON.stringify({ codigo }) })

export const albumStatus = () =>
  apiFetch<any>('/shop/album-status')

// ─── Álbum Figurinhas ───────────────────────────────────────────────────────
export const meuAlbum = () =>
  apiFetch<any>('/api/album')

export const abrirPacote = (pacote_id: number) =>
  apiFetch<any>('/api/album/pacotes/abrir', { method: 'POST', body: JSON.stringify({ pacote_id }) })

export const ackFigurinhasNovas = (figurinhaIds: number[]) =>
  apiFetch<any>('/album/ack-novas', {
    method: 'POST',
    body: JSON.stringify({ figurinhaIds }),
  })

// ─── Álbum Copa do Mundo ────────────────────────────────────────────────────
export const meuAlbumCopa = () =>
  apiFetch<any>('/api/copa')

export const revelarCartaCopa = (figurinha_id: number) =>
  apiFetch<any>('/api/copa/cartas/revelar', {
    method: 'POST',
    body: JSON.stringify({ figurinha_id }),
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
  pool_slot: number | null
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
  accept: {
    active: boolean
    secondsLeft: number
    total: number
    acceptedCount: number
    meAceitou: boolean
    players: Array<{
      jogador_id: number
      nome: string
      imagem: string | null
      is_capitao: boolean
      time: MixTeam | null
      aceitou: boolean
    }>
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

export const mixEntrar = async (
  role: 'capitao' | 'jogador',
  poolSlot?: number | null,
  captainTeam?: MixTeam | null
) =>
  unwrapResult<TirarMixSnapshot>(
    await apiFetch<any>('/api/tirar-mix/entrar', {
      method: 'POST',
      headers: mixHeaders(),
      body: JSON.stringify({
        role,
        ...(Number.isFinite(Number(poolSlot)) ? { pool_slot: Number(poolSlot) } : {}),
        ...((captainTeam === 'A' || captainTeam === 'B') ? { team: captainTeam } : {}),
      }),
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

export const mixAceitarPartida = async (sessaoId?: number) =>
  unwrapResult<TirarMixSnapshot>(
    await apiFetch<any>('/api/tirar-mix/aceitar', {
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

// ─── Mix Bet ─────────────────────────────────────────────────────────────────
// Feature desativada por enquanto (não está em uso). Para reativar, descomente
// este bloco inteiro (também usado por web/src/pages/BetPage.tsx, que precisa
// ser reativado junto — ver comentários "Mix Bet" em App.tsx e AppLayout.tsx).
/*
export type BetFaixa = { faixa: string; min: number; max: number | null; odd: number }

export interface BetPlayerOdds {
  jogador_id: number
  nome: string
  imagem: string | null
  time: 'A' | 'B'
  media_kills: number
  media_mortes: number
  media_assistencias: number
  media_multi_kills: number
  media_first_kills: number
  partidas: number
  kills: BetFaixa[]
  mortes: BetFaixa[]
  assistencias: BetFaixa[]
  multi_kills: BetFaixa[]
  first_kills: BetFaixa[]
}

export interface BetAtiva {
  bet: {
    id: number
    codigo: string
    sessao_id: number
    mapa: string
    nome_time_a: string
    nome_time_b: string
    status: 'aberta' | 'fechada' | 'liquidada' | 'cancelada'
    fecha_em: string
    segundos_restantes: number
    sou_participante: boolean
    odds: {
      jogadores: BetPlayerOdds[]
      rounds: BetFaixa[]
      vitoria: Array<{ time: 'A' | 'B'; nome: string; capitao_id: number | null; odd: number }>
    } | null
  } | null
  minhas_apostas: BetAposta[]
  meu_gold?: number
}

export interface BetSelecao {
  categoria: string
  jogador_id: number | null
  jogador_nome: string | null
  time: 'A' | 'B' | null
  faixa: string
  odd: number
  acertou?: boolean
  valor_real?: number | null
}

export interface BetAposta {
  id: number
  bet_partida_id: number
  selecoes: BetSelecao[]
  resultado: BetSelecao[] | null
  multiplicador: number
  valor: number
  retorno_potencial: number
  status: 'pendente' | 'ganha' | 'perdida' | 'cancelada'
  resgatada: boolean
  created_at?: string
  bet?: { codigo: string; mapa: string; nome_time_a: string; nome_time_b: string; status: string }
}

export const betAtiva = async () =>
  unwrapResult<BetAtiva>(await apiFetch<any>('/api/bet/ativa'))

export const betApostar = async (
  betId: number,
  valor: number,
  selecoes: Array<{ categoria: string; jogador_id?: number | null; faixa: string }>
) =>
  unwrapResult<{ aposta_id: number; multiplicador: number; retorno_potencial: number; saldo_atual: number }>(
    await apiFetch<any>('/api/bet/apostar', {
      method: 'POST',
      body: JSON.stringify({ bet_id: betId, valor, selecoes }),
    })
  )

export const betMinhas = async () =>
  unwrapResult<{ apostas: BetAposta[] }>(await apiFetch<any>('/api/bet/minhas'))

export const betResgatar = async (apostaId: number) =>
  unwrapResult<{ premio: number; saldo_atual: number }>(
    await apiFetch<any>(`/api/bet/resgatar/${apostaId}`, { method: 'POST' })
  )
*/

export const mixMockFluxoCompleto = async (sessaoId?: number) =>
  unwrapResult<TirarMixSnapshot>(
    await apiFetch<any>('/api/tirar-mix/mock/fluxo-completo', {
      method: 'POST',
      headers: mixHeaders(),
      body: JSON.stringify(sessaoId ? { sessao_id: sessaoId } : {}),
    })
  )
