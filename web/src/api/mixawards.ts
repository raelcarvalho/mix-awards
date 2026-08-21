// Client da cerimônia Mix Awards 2° Season

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err: any = new Error(data?.mensagem || 'Erro na requisição')
    err.status = res.status
    throw err
  }
  return (data?.resultados ?? data) as T
}

export interface DossieStats {
  partidas: number
  winrate: number
  adr: number
  kdr: number
  kast: number
  kills: number
  flash_assist: number
  first_kill: number
  multi_kill: number
  pontos: number
}

export interface AwardJogador {
  id: number
  nome: string
  imagem: string | null
  moldura_equipada: string | null
  stats: DossieStats
  valor?: number
}

export interface AwardFile {
  codigo: string
  file: string
  titulo: string
  descricao: string
  titulo_recompensa?: string
  valor?: number
  jogador: AwardJogador | null
  indicados: AwardJogador[]
}

export interface FinalReport {
  season: string
  reveal_at: string
  liberado: boolean
  preview_admin: boolean
  files: AwardFile[]
}

export interface RetrospectivaMapa {
  mapa: string
  jogos: number
  vitorias: number
  winrate: number
  adr: number
  kills: number
}

export interface Retrospectiva {
  season: string
  jogador: {
    id: number
    nome: string
    imagem: string | null
    moldura_equipada: string | null
    titulo_equipado: string | null
  }
  resumo: DossieStats
  derrotas: number
  assistencias: number
  posicao_ranking: number
  total_jogadores: number
  percentil: number
  melhor_streak: number
  mapas: RetrospectivaMapa[]
  melhor_partida: {
    mapa: string
    data: string
    codigo: number
    kills: number
    mortes: number
    assistencias: number
    adr: number
    placar: string
    vitoria: boolean
  } | null
  parceiro: {
    id: number
    nome: string
    imagem: string | null
    jogos_juntos: number
    winrate_juntos: number
  } | null
}

export interface RecompensaMixAwards {
  codigo: string
  tipo: 'titulo' | 'moldura'
  nome: string
  valor: string
}

export const getFinalReport = () => apiFetch<FinalReport>('/api/mixawards/final')

export const getRetrospectiva = () =>
  apiFetch<Retrospectiva>('/api/mixawards/retrospectiva')

export const resgatarRecompensas = () =>
  apiFetch<{ recompensas: RecompensaMixAwards[]; novas: RecompensaMixAwards[] }>(
    '/api/mixawards/resgatar',
    { method: 'POST' }
  )

export const equiparRecompensa = (codigo: string) =>
  apiFetch<{ tipo: string; valor: string }>('/api/mixawards/equipar', {
    method: 'POST',
    body: JSON.stringify({ codigo }),
  })
