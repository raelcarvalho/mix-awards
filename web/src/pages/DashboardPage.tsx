import { useEffect, useMemo, useRef, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/hooks/useAuth'
import * as api from '@/services/api'
import PlayerProfilePreview from '@/components/profile/PlayerProfilePreview'

interface Jogador {
  id: number
  nome: string
  kills?: string
  adr?: string
  mortes?: string
  assistencias?: string
  vitorias?: string
  pontos?: string
  qtd_partidas?: string
  kda_player?: string
  first_kill?: string
  multi_kill?: string
  kast?: number | string
  imagem?: string
  level?: number | string
  level_pontos?: number | string
  level_nome?: string
  level_tier?: 'bronze' | 'prata' | 'ouro' | 'platina' | 'apex' | string
  moldura_equipada?: string | null
  level_progresso?: {
    pontos_no_level?: number | string
    pontos_para_proximo?: number | null
    percentual?: number | string
  }
}

interface Partida {
  id: number
  codigo?: number
  mapa?: string
  nome_time1?: string
  nome_time2?: string
  data?: string
  created_at?: string
  season_id?: number
  partida_ganha?: boolean | number | string
  score_time_1?: number | string
  score_time_2?: number | string
  resultado_time1?: number | string
  resultado_time2?: number | string
  jogador_nome?: string
  pontos_jogador?: number | string
  kills_jogador?: number | string
  assistencias_jogador?: number | string
  mortes_jogador?: number | string
  adr_jogador?: number | string
  kast_jogador?: number | string
  first_kill_jogador?: number | string
  multi_kill_jogador?: number | string
  kda_jogador?: number | string
  players?: any[]
}

type MapStat = {
  key: string
  label: string
  matches: number
  wins: number
  winRate: number
  imageCandidates: string[]
}

type MissionCardItem = {
  id: string | number
  order?: number
  type: 'kills' | 'assistencias' | 'adr' | 'first_kill' | 'multi_kill' | 'vitorias'
  name: string
  description: string
  target: number
  progress: number
  percentage: number
  completed: boolean
}

type DashboardDropdownOption = {
  value: string | number
  label: string
}

const RADAR_LABELS = ['KDA', 'ADR', 'WinRate%', 'First Kill', 'KAST%', 'Assistencia']
const RADAR_COLORS = ['#c084fc', '#22d3ee', '#4ade80', '#fb923c', '#f472b6', '#fbbf24']
const HISTORY_POINTS_PER_PAGE = 10
const DASHBOARD_OPEN_PARTIDA_CODE_KEY = 'dashboard_open_partida_codigo'
const DEFAULT_SEASON_ID = 2
const SEASON_OPTIONS = [
  { id: 2, label: 'Temporada 2' },
  { id: 1, label: 'Temporada 1' },
] as const
const MAP_CANONICAL_ORDER = [
  'de_ancient',
  'de_anubis',
  'de_cache',
  'de_dust2',
  'de_inferno',
  'de_mirage',
  'de_nuke',
  'de_overpass',
]

const MISSION_PLACEHOLDERS: MissionCardItem[] = [
  {
    id: 'mission-placeholder-kills',
    type: 'kills',
    name: 'Matador',
    description: 'Mate 30 jogadores',
    target: 30,
    progress: 0,
    percentage: 0,
    completed: false,
  },
  {
    id: 'mission-placeholder-assist',
    type: 'assistencias',
    name: 'Garçom',
    description: 'Dê 15 assistências',
    target: 15,
    progress: 0,
    percentage: 0,
    completed: false,
  },
  {
    id: 'mission-placeholder-adr',
    type: 'adr',
    name: 'Bate em coitado',
    description: 'Cause 130 de ADR',
    target: 130,
    progress: 0,
    percentage: 0,
    completed: false,
  },
  {
    id: 'mission-placeholder-fk',
    type: 'first_kill',
    name: 'Entry',
    description: 'Faça 15 first kills',
    target: 15,
    progress: 0,
    percentage: 0,
    completed: false,
  },
  {
    id: 'mission-placeholder-mk',
    type: 'multi_kill',
    name: 'Assasino',
    description: 'Faça 15 multi kills',
    target: 15,
    progress: 0,
    percentage: 0,
    completed: false,
  },
]

function missionIconByType(type: MissionCardItem['type']) {
  switch (type) {
    case 'kills':
      return '🎯'
    case 'assistencias':
      return '🤝'
    case 'adr':
      return '💥'
    case 'first_kill':
      return '⚡'
    case 'multi_kill':
      return '🔥'
    case 'vitorias':
      return '🏆'
    default:
      return '•'
  }
}

function seasonLabel(seasonId: number) {
  return `Temporada ${seasonId}`
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const normalized = String(value ?? '')
    .trim()
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : 0
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function normalizeName(raw: string) {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function compactName(raw: string) {
  return normalizeName(raw).replace(/[^a-z0-9]/g, '')
}

function isSamePlayerName(a: string, b: string) {
  const an = normalizeName(a)
  const bn = normalizeName(b)
  if (!an || !bn) return false
  if (an === bn) return true

  const ac = compactName(a)
  const bc = compactName(b)
  if (!ac || !bc) return false
  if (ac === bc) return true

  const minLen = Math.min(ac.length, bc.length)
  if (minLen < 4) return false

  return ac.includes(bc) || bc.includes(ac)
}

function normalizeMapKey(raw?: string | null) {
  const clean = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
  if (!clean) return ''
  if (clean.startsWith('de_')) return clean
  return `de_${clean}`
}

function mapDisplayLabel(mapKey: string) {
  const cleaned = String(mapKey || '')
    .replace(/^de_/i, '')
    .replace(/_/g, ' ')
    .trim()
  return cleaned || 'sem mapa'
}

function mapImageCandidates(mapKey: string) {
  const normalized = normalizeMapKey(mapKey)
  const withoutPrefix = normalized.replace(/^de_/i, '')
  const list = [
    `/uploads/mapas/${normalized}.png`,
    `/uploads/mapas/${normalized}.jpg`,
    `/uploads/mapas/${normalized}.jpeg`,
    `/uploads/mapas/${normalized}.webp`,
    `/uploads/mapas/${withoutPrefix}.png`,
    `/uploads/mapas/${withoutPrefix}.jpg`,
    `/uploads/mapas/${withoutPrefix}.jpeg`,
    `/uploads/mapas/${withoutPrefix}.webp`,
  ]
  return Array.from(new Set(list))
}

function asDateLabel(value?: string) {
  if (!value) return '-'
  const ts = new Date(value).getTime()
  if (!Number.isFinite(ts)) return '-'
  const now = Date.now()
  const days = Math.floor((now - ts) / (24 * 60 * 60 * 1000))
  if (days <= 0) return 'hoje'
  if (days === 1) return 'ontem'
  if (days < 7) return `${days}d`
  return new Date(ts).toLocaleDateString('pt-BR')
}

function scoreFrom(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = toNumber(value)
  return Number.isFinite(n) ? n : null
}

function readScoreA(p: Partida): number | null {
  return scoreFrom(p.score_time_1 ?? p.resultado_time1)
}

function readScoreB(p: Partida): number | null {
  return scoreFrom(p.score_time_2 ?? p.resultado_time2)
}

function readWon(p: Partida): boolean | null {
  if (typeof p.partida_ganha === 'boolean') return p.partida_ganha
  const ganhoNum = scoreFrom(p.partida_ganha)
  if (ganhoNum !== null) return ganhoNum > 0

  const scoreA = readScoreA(p)
  const scoreB = readScoreB(p)
  if (scoreA !== null && scoreB !== null) return scoreA > scoreB
  return null
}

function readMatchDate(p: Partida): string {
  return String(p.data || p.created_at || '')
}

function readMonthKey(value?: string | null): string | null {
  const raw = String(value || '').trim()
  if (!raw) return null
  const ts = new Date(raw).getTime()
  if (!Number.isFinite(ts)) return null
  const d = new Date(ts)
  const year = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function monthLabel(monthKey: string): string {
  const [yearRaw, monthRaw] = monthKey.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return monthKey
  }
  return new Date(Date.UTC(year, month - 1, 1))
    .toLocaleDateString('pt-BR', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    })
    .replace('.', '')
    .toUpperCase()
}

function DashboardDropdown({
  value,
  options,
  onChange,
  width = 140,
  rightSpacing = 0,
  buttonHeight = 32,
  optionHeight = 38,
  selectedFontSize = 12,
  optionFontSize = 12,
  title,
}: {
  value: string | number
  options: DashboardDropdownOption[]
  onChange: (nextValue: string) => void
  width?: number
  rightSpacing?: number
  buttonHeight?: number
  optionHeight?: number
  selectedFontSize?: number
  optionFontSize?: number
  title?: string
}) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const selected =
    options.find((opt) => String(opt.value) === String(value))?.label ||
    options[0]?.label ||
    ''

  useEffect(() => {
    const onDocMouseDown = (event: MouseEvent) => {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
    }
  }, [])

  return (
    <div
      ref={wrapperRef}
      style={{ position: 'relative', width, marginRight: rightSpacing }}
      title={title}
    >
      <button
        type='button'
        onClick={() => setOpen((prev) => !prev)}
        style={{
          width: '100%',
          height: buttonHeight,
          display: 'grid',
          gridTemplateColumns: '1fr 34px',
          alignItems: 'center',
          background: 'linear-gradient(180deg, rgba(26,31,58,.94), rgba(20,24,48,.96))',
          border: '1px solid rgba(139,92,246,.62)',
          borderRadius: 10,
          color: '#f3f4ff',
          cursor: 'pointer',
          overflow: 'hidden',
          boxShadow: '0 0 0 1px rgba(109,40,217,.18) inset',
        }}
      >
        <span
          style={{
            padding: '0 12px',
            textAlign: 'left',
            fontFamily: "'Rajdhani',sans-serif",
            fontSize: selectedFontSize,
            fontWeight: 800,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: '#f8fafc',
          }}
        >
          {selected}
        </span>
        <span
          style={{
            height: '100%',
            borderLeft: '1px solid rgba(139,92,246,.5)',
            display: 'grid',
            placeItems: 'center',
            color: '#e2e8ff',
            fontSize: 14,
            lineHeight: 1,
          }}
          aria-hidden
        >
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 5px)',
            right: 0,
            width: '100%',
            zIndex: 80,
            background: 'linear-gradient(180deg, rgba(24,30,58,.98), rgba(18,24,48,.98))',
            border: '1px solid rgba(139,92,246,.72)',
            borderRadius: 10,
            boxShadow: '0 14px 30px rgba(3,6,20,.6)',
            maxHeight: 220,
            overflowY: 'auto',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(139,92,246,.72) rgba(255,255,255,.06)',
          }}
        >
          {options.map((opt, idx) => {
            const isSelected = String(opt.value) === String(value)
            return (
              <button
                key={String(opt.value)}
                type='button'
                onClick={() => {
                  onChange(String(opt.value))
                  setOpen(false)
                }}
                style={{
                  width: '100%',
                  height: optionHeight,
                  border: 0,
                  borderBottom:
                    idx < options.length - 1
                      ? '1px solid rgba(255,255,255,.08)'
                      : 'none',
                  background: isSelected ? 'rgba(97,125,181,.35)' : 'transparent',
                  color: '#f8fafc',
                  cursor: 'pointer',
                  textAlign: 'left',
                  padding: '0 12px',
                  fontFamily: "'Rajdhani',sans-serif",
                  fontSize: optionFontSize,
                  fontWeight: 800,
                  letterSpacing: 0.45,
                  textTransform: 'uppercase',
                  lineHeight: 1,
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.background =
                    'rgba(97,125,181,.38)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.background =
                    isSelected ? 'rgba(97,125,181,.35)' : 'transparent'
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MapPlayedTile({ stat }: { stat: MapStat }) {
  const [imageIndex, setImageIndex] = useState(0)
  const src = stat.imageCandidates[imageIndex] || ''

  return (
    <div style={{ width: 120, minWidth: 120, display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: 1,
          borderRadius: 11,
          background:
            'linear-gradient(160deg, rgba(192,132,252,.85) 0%, rgba(139,92,246,.55) 40%, rgba(99,102,241,.5) 100%)',
          boxShadow: '0 0 20px rgba(192,132,252,.22)',
        }}
      >
        <div
          style={{
            borderRadius: 10,
            background: 'linear-gradient(180deg, rgba(13,19,36,.98) 0%, rgba(12,17,31,.98) 100%)',
            border: '1px solid rgba(192,132,252,.25)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: 214,
              background:
                'radial-gradient(120% 100% at 50% 0%, rgba(192,132,252,.14) 0%, rgba(10,15,28,.95) 78%)',
              position: 'relative',
            }}
          >
            {src ? (
              <img
                src={src}
                alt={stat.label}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition:
                    stat.key === 'de_inferno'
                      ? 'calc(50% + 7px) center'
                      : stat.key === 'de_dust2'
                      ? 'calc(50% - 9px) center'
                      : '50% center',
                }}
                onError={() => {
                  setImageIndex((prev) => {
                    const next = prev + 1
                    return next < stat.imageCandidates.length ? next : prev
                  })
                }}
              />
            ) : null}
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                padding: '8px 7px 7px',
                background:
                  'linear-gradient(180deg, rgba(8,12,24,0) 0%, rgba(8,12,24,.92) 64%, rgba(8,12,24,.98) 100%)',
                fontFamily: "'Orbitron',monospace",
                fontSize: 11,
                letterSpacing: 0.8,
                fontWeight: 700,
                color: '#fff',
                textAlign: 'center',
                textTransform: 'uppercase',
              }}
            >
              {stat.label}
            </div>
          </div>

          <div style={{ padding: '8px 9px 10px', fontFamily: "'Rajdhani',sans-serif" }}>
            <div style={{ color: 'rgba(255,255,255,.84)', fontSize: 14, fontWeight: 700, lineHeight: 1.1 }}>
              Partidas: <span style={{ color: '#fff' }}>{stat.matches}</span>
            </div>
            <div
              style={{
                color: 'rgba(255,255,255,.84)',
                fontSize: 14,
                fontWeight: 700,
                lineHeight: 1.1,
                marginTop: 4,
              }}
            >
              Vitórias: <span style={{ color: '#4ade80' }}>{stat.wins}</span>
            </div>
            <div
              style={{
                color: 'rgba(255,255,255,.84)',
                fontSize: 14,
                fontWeight: 700,
                lineHeight: 1.1,
                marginTop: 4,
              }}
            >
              Winrate:{' '}
              <span
                style={{
                  color:
                    stat.winRate >= 60 ? '#4ade80' : stat.winRate >= 50 ? '#f5c842' : stat.winRate > 0 ? '#fb923c' : '#94a3b8',
                }}
              >
                {stat.winRate.toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function HighlightMapIcon({
  mapKey,
  size = 34,
}: {
  mapKey?: string
  size?: number
}) {
  const candidates = mapKey ? mapImageCandidates(mapKey) : []
  const [imageIndex, setImageIndex] = useState(0)
  const src = candidates[imageIndex] || ''
  const label = mapKey ? mapDisplayLabel(mapKey) : 'N/A'

  if (!src) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,.18)',
          background: 'rgba(255,255,255,.04)',
          color: '#fff',
          display: 'grid',
          placeItems: 'center',
          fontFamily: "'Orbitron',monospace",
          fontSize: 11,
          textTransform: 'uppercase',
        }}
      >
        {label.slice(0, 2)}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={label}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        border: '1px solid rgba(255,255,255,.24)',
        boxShadow: '0 0 12px rgba(129,140,248,.22)',
      }}
      onError={() => {
        setImageIndex((prev) => {
          const next = prev + 1
          return next < candidates.length ? next : prev
        })
      }}
    />
  )
}

type DashboardPageProps = {
  setPage?: (p: any) => void
  dashboardPlayerId?: number | null
}

export default function DashboardPage({ setPage, dashboardPlayerId }: DashboardPageProps) {
  const { user, jogadorId, isLogged, refreshGold } = useAuth()
  const [jogador, setJogador] = useState<Jogador | null>(null)
  const [claimingMissions, setClaimingMissions] = useState(false)
  const [claimToast, setClaimToast] = useState('')
  const [allJogadores, setAllJogadores] = useState<Jogador[]>([])
  const [partidas, setPartidas] = useState<Partida[]>([])
  const [missions, setMissions] = useState<api.PlayerMission[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [animated, setAnimated] = useState(false)
  const [historyPage, setHistoryPage] = useState(0)
  const [hoveredHistoryPointKey, setHoveredHistoryPointKey] = useState<string | null>(null)
  const [seasonId, setSeasonId] = useState<number>(DEFAULT_SEASON_ID)
  const [monthKey, setMonthKey] = useState<string>('all')

  useEffect(() => {
    if (!isLogged) {
      setJogador(null)
      setAllJogadores([])
      setPartidas([])
      setMissions([])
      setLoadError('')
      setLoading(false)
      return
    }

    let alive = true
    setLoading(true)
    setLoadError('')
    const filters: api.SeasonFilters =
      monthKey === 'all'
        ? { seasonId }
        : {
            month: monthKey,
          }

    Promise.all([
      api.listarJogadores(filters).catch((err: any) => {
        if (alive) setLoadError(err?.message || 'Erro ao carregar ranking')
        return []
      }),
      api.listarPartidas(undefined, filters).catch((err: any) => {
        if (alive) setLoadError(err?.message || 'Erro ao carregar partidas')
        return []
      }),
    ])
      .then(async ([jogs, parts]) => {
        if (!alive) return

        const ranking = safeArray<Jogador>(jogs).sort(
          (a, b) =>
            toNumber(b.level_pontos ?? b.pontos) -
            toNumber(a.level_pontos ?? a.pontos)
        )
        setAllJogadores(ranking)

        const selectedJogadorId = toNumber(dashboardPlayerId)
        const authJogadorId = toNumber(jogadorId)
        const userName = normalizeName(String(user?.nome || ''))

        const meBySelectedId =
          selectedJogadorId > 0
            ? ranking.find((j) => toNumber(j.id) === selectedJogadorId)
            : null

        const meByAuthId =
          authJogadorId > 0
            ? ranking.find((j) => toNumber(j.id) === authJogadorId)
            : null

        const meByName = ranking.find(
          (j) => normalizeName(String(j.nome || '')) === userName
        )

        const me = meBySelectedId ?? meByAuthId ?? meByName ?? ranking[0] ?? null
        setJogador(me)

        let preferredParts = safeArray<Partida>(parts)
        if (me?.nome) {
          try {
            const filtered = safeArray<Partida>(await api.listarPartidas(me.nome, filters))
            if (filtered.length > 0) preferredParts = filtered
          } catch {}
        }

        const sortedParts = preferredParts.sort((a, b) => {
          const ta = readMatchDate(a) ? new Date(readMatchDate(a)).getTime() : 0
          const tb = readMatchDate(b) ? new Date(readMatchDate(b)).getTime() : 0
          return tb - ta
        })
        setPartidas(sortedParts)
      })
      .finally(() => {
        if (!alive) return
        setLoading(false)
        setTimeout(() => setAnimated(true), 200)
      })

    return () => {
      alive = false
    }
  }, [isLogged, user?.id, user?.nome, jogadorId, dashboardPlayerId, seasonId, monthKey])

  useEffect(() => {
    if (!isLogged) {
      setMissions([])
      return
    }

    const selectedId = toNumber(jogador?.id)
    if (selectedId <= 0) {
      setMissions([])
      return
    }

    let alive = true
    api
      .listarMissoesJogador(selectedId)
      .then((rows) => {
        if (!alive) return
        setMissions(safeArray<api.PlayerMission>(rows))
      })
      .catch(() => {
        if (!alive) return
        setMissions([])
      })

    return () => {
      alive = false
    }
  }, [isLogged, jogador?.id])

  useEffect(() => {
    setHistoryPage(0)
    setHoveredHistoryPointKey(null)
  }, [jogador?.id, seasonId, monthKey])

  const mapStats = useMemo<MapStat[]>(() => {
    const mapCount = new Map<string, { matches: number; wins: number }>()
    for (const mapKey of MAP_CANONICAL_ORDER) {
      mapCount.set(mapKey, { matches: 0, wins: 0 })
    }

    for (const p of partidas) {
      const mapKey = normalizeMapKey(p.mapa)
      if (!mapKey || !mapCount.has(mapKey)) continue
      const prev = mapCount.get(mapKey) ?? { matches: 0, wins: 0 }
      const won = readWon(p) === true
      mapCount.set(mapKey, {
        matches: prev.matches + 1,
        wins: prev.wins + (won ? 1 : 0),
      })
    }

    return MAP_CANONICAL_ORDER.map((mapKey) => {
      const data = mapCount.get(mapKey) ?? { matches: 0, wins: 0 }
      return {
        key: mapKey,
        label: mapDisplayLabel(mapKey),
        matches: data.matches,
        wins: data.wins,
        winRate: data.matches > 0 ? (data.wins / data.matches) * 100 : 0,
        imageCandidates: mapImageCandidates(mapKey),
      }
    })
  }, [partidas])

  const monthOptions = useMemo(() => {
    const keys = new Set<string>()
    for (const p of partidas) {
      const key = readMonthKey(readMatchDate(p))
      if (key) keys.add(key)
    }
    const sorted = Array.from(keys).sort((a, b) => b.localeCompare(a))
    return [
      { value: 'all', label: 'TODOS' },
      ...sorted.map((value) => ({ value, label: monthLabel(value) })),
    ]
  }, [partidas])

  useEffect(() => {
    if (monthKey === 'all') return
    const exists = monthOptions.some((opt) => opt.value === monthKey)
    if (!exists) setMonthKey('all')
  }, [monthKey, monthOptions])

  const currentPlayerName = normalizeName(String(jogador?.nome || user?.nome || ''))
  const currentPlayerId = toNumber(jogador?.id)
  const currentPlayerAdr = toNumber(jogador?.adr)
  const fallbackPartsCount = toNumber(jogador?.qtd_partidas)
  const historyRows = useMemo(() => {
    if (!currentPlayerName) return []

    const rows = partidas.flatMap((p) => {
      const won = readWon(p)

      const player = safeArray<any>(p.players).find((pl) => {
        const plId = toNumber(pl?.id ?? pl?.jogador_id ?? pl?.id_jogador)
        if (currentPlayerId > 0 && plId > 0 && plId === currentPlayerId) return true

        const plName = String(pl?.nome || pl?.nickname || '')
        return isSamePlayerName(plName, currentPlayerName)
      })

      const inlineMatch = p.jogador_nome
        ? isSamePlayerName(String(p.jogador_nome), currentPlayerName)
        : false

      if (!player && !inlineMatch) return []

      const rowKills = toNumber(
        player?.kills ??
          player?.abates ??
          player?.nb_kill ??
          p.kills_jogador
      )
      const rowDeaths = toNumber(
        player?.deaths ??
          player?.mortes ??
          player?.nb_death ??
          p.mortes_jogador
      )
      const rowAssists = toNumber(
        player?.assistencias ??
          player?.assists ??
          player?.assist ??
          player?.nb_assist ??
          p.assistencias_jogador
      )
      const rowAdrRaw = toNumber(
        player?.adr ??
          player?.average_damage ??
          player?.avg_adr ??
          p.adr_jogador
      )
      const rowAdr = rowAdrRaw > 0 ? rowAdrRaw : currentPlayerAdr
      const rowKast = toNumber(player?.kast ?? player?.kast_percentage ?? p.kast_jogador)
      const rowFk = toNumber(player?.first_kill ?? player?.fk ?? player?.firstkill ?? p.first_kill_jogador)
      const rowMulti = toNumber(
        player?.multi_kill ??
          player?.multiKills ??
          player?.multikills ??
          p.multi_kill_jogador
      )
      const rowHs = toNumber(
        player?.hs ??
          player?.hs_percent ??
          player?.hs_percentage ??
          player?.headshot ??
          player?.headshot_percent ??
          player?.headshot_percentage ??
          (p as any)?.hs_jogador ??
          (p as any)?.hs_percent ??
          (p as any)?.headshot_percent
      )
      const rowKda = rowDeaths > 0 ? rowKills / rowDeaths : rowKills

      return [
        {
          id: p.id,
          codigo: p.codigo ?? null,
          mapa: String(p.mapa || '-'),
          team1Name: String(p.nome_time1 || 'Time A'),
          team2Name: String(p.nome_time2 || 'Time B'),
          scoreA: readScoreA(p),
          scoreB: readScoreB(p),
          createdAt: readMatchDate(p),
          won,
          kills: rowKills,
          deaths: rowDeaths,
          assists: rowAssists,
          adr: rowAdr,
          kast: rowKast,
          firstKill: rowFk,
          multiKill: rowMulti,
          hsRate: rowHs,
          kda: rowKda,
          ratingPoints: toNumber(p.pontos_jogador),
        },
      ]
    })
    if (rows.length > 0) return rows

    if (fallbackPartsCount <= 0) return []
    const maxFallback = fallbackPartsCount
    return Array.from({ length: maxFallback }, (_, idx) => ({
      id: -(idx + 1),
      codigo: null as number | string | null,
      mapa: '-',
      team1Name: 'Time A',
      team2Name: 'Time B',
      scoreA: null as number | null,
      scoreB: null as number | null,
      createdAt: '',
      won: null as boolean | null,
      kills: 0,
      deaths: 0,
      assists: 0,
      adr: currentPlayerAdr,
      kast: 0,
      firstKill: 0,
      multiKill: 0,
      hsRate: 0,
      kda: 0,
      ratingPoints: 0,
    }))
  }, [currentPlayerAdr, currentPlayerId, currentPlayerName, fallbackPartsCount, partidas])

  if (!isLogged) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
          color: '#ffffff',
          fontFamily: "'Rajdhani',sans-serif",
          fontSize: 22,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          textAlign: 'center',
          padding: '24px 12px',
        }}
      >
        Você precisa logar no site para visualizar seu dashboard
      </div>
    )
  }

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '50vh',
          color: 'rgba(255,255,255,.3)',
          fontFamily: "'Rajdhani',sans-serif",
          fontSize: 16,
        }}
      >
        Carregando dashboard...
      </div>
    )
  }

  if (!jogador) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 18, color: 'rgba(255,255,255,.2)', letterSpacing: 4 }}>SEM DADOS</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.3)', fontFamily: "'Rajdhani',sans-serif" }}>Nenhum jogador encontrado no ranking.</div>
        {!!loadError && (
          <div style={{ fontSize: 12, color: '#fda4af', fontFamily: "'Rajdhani',sans-serif" }}>{loadError}</div>
        )}
      </div>
    )
  }

  const kills = toNumber(jogador.kills)
  const adr = toNumber(jogador.adr)
  const wins = toNumber(jogador.vitorias)
  const fk = toNumber(jogador.first_kill)
  const multiKills = toNumber(jogador.multi_kill)
  const kast = toNumber(jogador.kast)
  const asst = toNumber(jogador.assistencias)
  const deaths = toNumber(jogador.mortes)
  const kda = toNumber(jogador.kda_player)
  const pts = toNumber(jogador.pontos)
  const level = toNumber(jogador.level)
  const normalizedLevel = Math.max(0, Math.min(15, Math.round(level)))
  const levelPontos = toNumber(jogador.level_pontos || 0)
  const levelProgressPayload = jogador.level_progresso
  const nParts = toNumber(jogador.qtd_partidas)
  const losses = Math.max(0, nParts - wins)
  const winRate = nParts > 0 ? (wins / nParts) * 100 : 0
  const avgFkPerMatch = nParts > 0 ? fk / nParts : 0
  const avgAssistPerMatch = nParts > 0 ? asst / nParts : 0
  const pontosNoLevel = toNumber(levelProgressPayload?.pontos_no_level)
  const pontosParaProximo = levelProgressPayload?.pontos_para_proximo
  const isMaxLevel = normalizedLevel >= 15 || pontosParaProximo === null
  const xpCurrent =
    isMaxLevel
      ? Math.max(0, pontosNoLevel || levelPontos % 100)
      : typeof pontosParaProximo === 'number' && pontosParaProximo > 0
      ? pontosNoLevel
      : levelPontos % 100
  const xpNext =
    isMaxLevel
      ? 0
      : typeof pontosParaProximo === 'number' && pontosParaProximo > 0
      ? Number(pontosParaProximo)
      : 100
  const levelIconUrl = `/level-icons/level-${normalizedLevel}.png`

  const allAvgKda = allJogadores.map((j) => toNumber(j.kda_player)).filter((v) => v > 0)
  const allAvgAdr = allJogadores.map((j) => toNumber(j.adr)).filter((v) => v > 0)
  const allWinRate = allJogadores
    .map((j) => {
      const parts = toNumber(j.qtd_partidas)
      const jwins = toNumber(j.vitorias)
      return parts > 0 ? (jwins / parts) * 100 : 0
    })
    .filter((v) => v > 0)
  const allAvgFk = allJogadores
    .map((j) => {
      const parts = toNumber(j.qtd_partidas)
      const val = toNumber(j.first_kill)
      return parts > 0 ? val / parts : 0
    })
    .filter((v) => v > 0)
  const allAvgKast = allJogadores.map((j) => toNumber(j.kast)).filter((v) => v > 0)
  const allAvgAssist = allJogadores
    .map((j) => {
      const parts = toNumber(j.qtd_partidas)
      const val = toNumber(j.assistencias)
      return parts > 0 ? val / parts : 0
    })
    .filter((v) => v > 0)

  const radarCaps = [
    Math.max(1.5, ...allAvgKda),
    Math.max(65, ...allAvgAdr),
    100,
    Math.max(1.2, ...allAvgFk),
    Math.max(45, ...allAvgKast),
    Math.max(3, ...allAvgAssist),
  ]

  const radarRawValues = [kda, adr, winRate, avgFkPerMatch, kast, avgAssistPerMatch]
  const radarVals = radarRawValues.map((value, idx) => {
    const cap = radarCaps[idx] || 1
    return Math.max(0, Math.min(100, Math.round((value / cap) * 100)))
  })
  const radarDisplayValues = [
    kda.toFixed(2),
    adr.toFixed(1),
    `${winRate.toFixed(0)}%`,
    avgFkPerMatch.toFixed(2),
    `${kast.toFixed(0)}%`,
    avgAssistPerMatch.toFixed(2),
  ]

  const historyTotalPages = Math.max(1, Math.ceil(historyRows.length / HISTORY_POINTS_PER_PAGE))
  const safeHistoryPage = Math.min(historyPage, historyTotalPages - 1)
  const historySlice = historyRows.slice(
    safeHistoryPage * HISTORY_POINTS_PER_PAGE,
    safeHistoryPage * HISTORY_POINTS_PER_PAGE + HISTORY_POINTS_PER_PAGE
  )
  const historyVisible = [...historySlice].reverse()
  const canGoHistoryNewer = safeHistoryPage > 0
  const canGoHistoryOlder = safeHistoryPage < historyTotalPages - 1

  const historyTrendValues = historyVisible.reduce<number[]>((acc, match, idx) => {
    if (idx === 0) return [50]
    const prev = acc[idx - 1] ?? 50
    const adrFactor = Math.max(1, Math.min(4, Math.round((match.adr - 50) / 18)))
    const step = 7 + adrFactor
    const next =
      match.won === true ? prev + step : match.won === false ? prev - step : prev
    acc.push(Math.max(8, Math.min(96, next)))
    return acc
  }, [])

  const historyValues = historyTrendValues.filter((v) => Number.isFinite(v))
  const historyMinRaw = historyValues.length ? Math.min(...historyValues) : 0
  const historyMaxRaw = historyValues.length ? Math.max(...historyValues) : 100
  const historyPad = historyMaxRaw > historyMinRaw ? Math.max(3, (historyMaxRaw - historyMinRaw) * 0.12) : 6
  const historyMin = Math.max(0, historyMinRaw - historyPad)
  const historyMax = historyMaxRaw + historyPad
  const historyRange = Math.max(1, historyMax - historyMin)

  const W = 620
  const H = 220
  const PL = 36
  const PR = 28
  const PT = 20
  const PB = 34
  const toX = (i: number) =>
    PL + (i / Math.max(1, historyVisible.length - 1)) * (W - PL - PR)
  const toY = (v: number) =>
    PT + (1 - (v - historyMin) / historyRange) * (H - PT - PB)
  const historyPoints = historyVisible.map((m, i) => ({
    match: m,
    x: toX(i),
    y: toY(historyTrendValues[i] ?? 50),
  }))
  const historySegments = historyPoints.slice(1).map((point, idx) => {
    const prev = historyPoints[idx]
    const won = point.match.won
    return {
      x1: prev.x,
      y1: prev.y,
      x2: point.x,
      y2: point.y,
      won,
    }
  })

  const hoveredHistoryPoint =
    hoveredHistoryPointKey === null
      ? null
      : historyPoints.find((_, i) => hoveredHistoryPointKey === `${safeHistoryPage}-${i}`) || null

  const latestIndividualMatches = historyRows.filter((m) => m.id > 0).slice(0, 4)
  const competitiveRows = historyRows.filter(
    (m) => m.id > 0 && normalizeMapKey(m.mapa) && normalizeMapKey(m.mapa) !== 'de_'
  )
  const mapAggregate = (() => {
    const aggregate = new Map<string, { matches: number; wins: number }>()
    for (const match of competitiveRows) {
      const mapKey = normalizeMapKey(match.mapa)
      if (!mapKey || mapKey === 'de_') continue
      const prev = aggregate.get(mapKey) ?? { matches: 0, wins: 0 }
      aggregate.set(mapKey, {
        matches: prev.matches + 1,
        wins: prev.wins + (match.won === true ? 1 : 0),
      })
    }
    return Array.from(aggregate.entries())
      .map(([mapKey, value]) => {
        const winRate = value.matches > 0 ? value.wins / value.matches : 0
        return { mapKey, ...value, winRate }
      })
  })()
  const bestMapEntry =
    [...mapAggregate]
      .sort((a, b) => {
        if (b.winRate !== a.winRate) return b.winRate - a.winRate
        if (b.wins !== a.wins) return b.wins - a.wins
        return b.matches - a.matches
      })[0] || null
  const favoriteMapEntry =
    [...mapAggregate]
      .sort((a, b) => {
        if (b.matches !== a.matches) return b.matches - a.matches
        if (b.wins !== a.wins) return b.wins - a.wins
        return b.winRate - a.winRate
      })[0] || null
  const bestMapLabel = bestMapEntry ? mapDisplayLabel(bestMapEntry.mapKey).toUpperCase() : '-'
  const favoriteMapLabel = favoriteMapEntry
    ? mapDisplayLabel(favoriteMapEntry.mapKey).toUpperCase()
    : '-'
  const longestWinStreak = (() => {
    if (competitiveRows.length === 0) return 0
    const chronological = [...competitiveRows].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return ta - tb
    })
    let current = 0
    let max = 0
    for (const match of chronological) {
      if (match.won === true) {
        current += 1
        if (current > max) max = current
      } else {
        current = 0
      }
    }
    return max
  })()
  const bestRating = competitiveRows.length
    ? Math.max(...competitiveRows.map((m) => m.adr))
    : 0
  const lastPlayerMatch =
    [...historyRows]
      .filter((m) => m.id > 0)
      .sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return tb - ta
      })[0] || null
  const lastMatchDate = (() => {
    if (!lastPlayerMatch?.createdAt) return '-'
    const ts = new Date(lastPlayerMatch.createdAt).getTime()
    if (!Number.isFinite(ts)) return '-'
    return new Date(ts).toLocaleDateString('pt-BR')
  })()
  const lastMatchStatus =
    lastPlayerMatch?.won === true ? 'Vitória' : lastPlayerMatch?.won === false ? 'Derrota' : 'N/A'
  const lastMatchPoints = Math.abs(toNumber(lastPlayerMatch?.ratingPoints))
  const colorByResult = (won: boolean | null) =>
    won === false ? '#f87171' : won === true ? '#4ade80' : '#57b6ff'
  const openHistoryMatch = (codigo: string | number | null | undefined) => {
    const code = String(codigo ?? '').trim()
    if (!code || code === '-') return
    try {
      localStorage.setItem(DASHBOARD_OPEN_PARTIDA_CODE_KEY, code)
    } catch {}
    if (setPage) setPage('partidas')
  }
  const renderScaledText = (value: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', whiteSpace: 'pre' }}>
      {value.split('').map((char, index) => (
        <span
          key={`${value}-${index}-${char}`}
          style={{
            display: 'inline-block',
            animationName: 'dashboard-text-scale-up',
            animationDuration: '420ms',
            animationTimingFunction: 'cubic-bezier(.2,.85,.2,1)',
            animationFillMode: 'both',
            animationDelay: `${index * 38}ms`,
            transformOrigin: '50% 100%',
          }}
        >
          {char}
        </span>
      ))}
    </span>
  )
  const dashboardGlowCardStyle = {
    boxShadow:
      '0 0 0 1px rgba(192,132,252,.16) inset, 0 0 22px rgba(192,132,252,.14), 0 0 40px rgba(129,140,248,.08)',
    borderColor: 'rgba(192,132,252,.28)',
  } as const
  const historyStatItems = [
    { label: 'ADR', value: adr.toFixed(1), color: '#f5c842' },
    { label: 'Kills', value: kills, color: '#22d3ee' },
    { label: 'Assistências', value: asst, color: '#c084fc' },
    { label: 'Mortes', value: deaths, color: '#f87171' },
    { label: 'K/D/A', value: kda.toFixed(2), color: '#a78bfa' },
    { label: 'KAST%', value: `${kast.toFixed(0)}%`, color: '#4ade80' },
    { label: 'First Kill', value: fk, color: '#fb923c' },
    { label: 'Multi Kills', value: multiKills, color: '#22d3ee' },
    { label: 'Partidas', value: nParts, color: '#94a3b8' },
    { label: 'Vitórias', value: wins, color: '#4ade80' },
  ]
  const missionCards: MissionCardItem[] = (() => {
    const normalized = safeArray<api.PlayerMission>(missions)
      .map((mission, index) => {
        const target = Math.max(1, toNumber(mission.target || 0))
        const progress = Math.max(0, Math.min(target, toNumber(mission.progress || 0)))
        const percentage = Math.max(
          0,
          Math.min(
            100,
            Number.isFinite(toNumber(mission.percentage))
              ? Math.round(toNumber(mission.percentage))
              : Math.round((progress / target) * 100)
          )
        )
        return {
          id: mission.id ?? `mission-${index}`,
          order: toNumber((mission as any).order || index + 1),
          type: mission.type,
          name: String(mission.name || '').trim() || 'Missão',
          description:
            String(mission.description || '').trim() || `Progresso ${progress}/${target}`,
          target,
          progress,
          percentage,
          completed: !!mission.completed || progress >= target,
        } as MissionCardItem
      })
      .sort((a, b) => toNumber(a.order) - toNumber(b.order))

    if (normalized.length >= 5) return normalized.slice(0, 5)
    return MISSION_PLACEHOLDERS.slice(0, 5)
  })()

  const realMissions = safeArray<api.PlayerMission>(missions)
  const allMissionsCompleted =
    realMissions.length >= 5 &&
    realMissions.every((m) => !!m.completed || toNumber(m.progress) >= toNumber(m.target))

  const handleClaimMissions = async () => {
    const playerId = toNumber(jogador?.id)
    if (playerId <= 0 || claimingMissions || !allMissionsCompleted) return
    setClaimingMissions(true)
    try {
      const result = await api.resgatarMissoes(playerId)
      setMissions(safeArray<api.PlayerMission>(result.missoes))
      await refreshGold()
      setClaimToast(`✓ +${result.gold_creditado || 40} gold resgatado! Novas missões liberadas.`)
      window.setTimeout(() => setClaimToast(''), 2800)
    } catch (err: any) {
      setClaimToast(err?.message || 'Erro ao resgatar recompensa.')
      window.setTimeout(() => setClaimToast(''), 2800)
    } finally {
      setClaimingMissions(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <style>{`
        @keyframes dashboard-text-scale-up {
          0% {
            opacity: .25;
            transform: scale(0.84);
          }
          60% {
            opacity: 1;
            transform: scale(1.08);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
      <div className="grid grid-cols-1 xl:grid-cols-[360px_420px_minmax(0,1fr)] 2xl:grid-cols-[380px_440px_minmax(0,1fr)] gap-3.5 items-stretch">
        <PlayerProfilePreview
          playerName={jogador.nome}
          avatarUrl={jogador.imagem}
          level={normalizedLevel}
          levelIconUrl={levelIconUrl}
          points={pts}
          wins={wins}
          losses={losses}
          currentXp={xpCurrent}
          nextLevelXp={xpNext}
          molduraEquipada={jogador.moldura_equipada}
        />

        <Card
          title="Gráfico do Jogador"
          centerTitle
          titleStyle={{ marginTop: 5, width: '100%', letterSpacing: 0.3 }}
          action={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: 5 }}>
              <DashboardDropdown
                value={seasonId}
                onChange={(nextValue) => {
                  const next = Number(nextValue)
                  setSeasonId(next === 1 ? 1 : 2)
                  setMonthKey('all')
                }}
                options={SEASON_OPTIONS.map((opt) => ({
                  value: opt.id,
                  label: opt.label,
                }))}
                width={130}
                rightSpacing={0}
                buttonHeight={30}
                optionHeight={36}
                selectedFontSize={11}
                optionFontSize={11}
                title='Filtro de temporada do gráfico'
              />
            </div>
          }
          style={{ height: '100%', ...dashboardGlowCardStyle }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'center' }}>
            <svg width={300} height={300} viewBox="0 0 300 300" style={{ flexShrink: 0 }}>
              {[0.25, 0.5, 0.75, 1].map((pct) => (
                <polygon
                  key={pct}
                  points={radarVals
                    .map((_, i) => {
                      const angle = (i / 6) * 2 * Math.PI - Math.PI / 2
                      return `${150 + 108 * pct * Math.cos(angle)},${150 + 108 * pct * Math.sin(angle)}`
                    })
                    .join(' ')}
                  fill="none"
                  stroke="rgba(255,255,255,.06)"
                  strokeWidth={1}
                />
              ))}
              {radarVals.map((_, i) => {
                const angle = (i / 6) * 2 * Math.PI - Math.PI / 2
                return <line key={i} x1={150} y1={150} x2={150 + 108 * Math.cos(angle)} y2={150 + 108 * Math.sin(angle)} stroke="rgba(255,255,255,.06)" strokeWidth={1} />
              })}
              <polygon
                points={radarVals
                  .map((v, i) => {
                    const angle = (i / 6) * 2 * Math.PI - Math.PI / 2
                    const pr = animated ? (v / 100) * 108 : 0
                    return `${150 + pr * Math.cos(angle)},${150 + pr * Math.sin(angle)}`
                  })
                  .join(' ')}
                fill="rgba(192,132,252,.15)"
                stroke="rgba(192,132,252,.7)"
                strokeWidth={1.5}
                style={{ transition: 'all 1.3s cubic-bezier(.2,.8,.2,1)' }}
              />
              {radarVals.map((v, i) => {
                const angle = (i / 6) * 2 * Math.PI - Math.PI / 2
                const pr = animated ? (v / 100) * 108 : 0
                return <circle key={i} cx={150 + pr * Math.cos(angle)} cy={150 + pr * Math.sin(angle)} r={5} fill={RADAR_COLORS[i]} stroke="#09091a" strokeWidth={2} style={{ transition: 'all 1.3s cubic-bezier(.2,.8,.2,1)' }} />
              })}
              {RADAR_LABELS.map((label, i) => {
                const angle = (i / 6) * 2 * Math.PI - Math.PI / 2
                return <text key={i} x={150 + 132 * Math.cos(angle)} y={150 + 132 * Math.sin(angle) + 4} textAnchor="middle" fill={RADAR_COLORS[i]} fontSize={11} fontWeight={800} fontFamily="'Rajdhani',sans-serif">{label}</text>
              })}
            </svg>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10, marginTop: 8 }}>
            {RADAR_LABELS.map((label, i) => (
              <div
                key={label}
                style={{
                  textAlign: 'center',
                  padding: '6px 4px',
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: RADAR_COLORS[i],
                    fontFamily: "'Rajdhani',sans-serif",
                    fontWeight: 700,
                    letterSpacing: 0.8,
                    marginBottom: 4,
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    fontFamily: "'Orbitron',monospace",
                    fontSize: 23,
                    fontWeight: 700,
                    lineHeight: 1,
                    color: RADAR_COLORS[i],
                  }}
                >
                  {renderScaledText(radarDisplayValues[i])}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 8,
              borderRadius: 10,
              border: '1px solid rgba(139,92,246,.24)',
              background: 'linear-gradient(180deg, rgba(16,19,40,.78), rgba(11,16,31,.9))',
              padding: '10px 10px 9px',
            }}
          >
            <div
              style={{
                fontFamily: "'Orbitron',monospace",
                fontSize: 12,
                color: '#c4b5fd',
                letterSpacing: 0.8,
                fontWeight: 700,
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              Missões do Level
            </div>

            <div style={{ display: 'grid', gap: 7 }}>
              {missionCards.map((mission) => {
                const progressText = `${Math.round(mission.progress)} / ${Math.round(mission.target)}`
                return (
                  <div key={String(mission.id)}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          minWidth: 0,
                        }}
                      >
                        <span style={{ fontSize: 13, lineHeight: 1 }}>
                          {missionIconByType(mission.type)}
                        </span>
                        <span
                          style={{
                            fontFamily: "'Rajdhani',sans-serif",
                            fontSize: 13,
                            color: '#e5e7eb',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {`${mission.name}: ${mission.description}`}
                        </span>
                      </div>
                      {!mission.completed ? (
                        <span
                          style={{
                            fontFamily: "'Orbitron',monospace",
                            fontSize: 10,
                            fontWeight: 700,
                            color: 'rgba(255,255,255,.78)',
                            flexShrink: 0,
                          }}
                        >
                          {progressText}
                        </span>
                      ) : null}
                    </div>

                    {!mission.completed ? (
                      <div
                        style={{
                          height: 7,
                          borderRadius: 999,
                          background: 'rgba(255,255,255,.12)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${mission.percentage}%`,
                            height: '100%',
                            borderRadius: 999,
                            background:
                              'linear-gradient(90deg, rgba(168,85,247,.95) 0%, rgba(129,140,248,.95) 100%)',
                            boxShadow: '0 0 12px rgba(168,85,247,.35)',
                            transition: 'width 420ms ease',
                          }}
                        />
                      </div>
                    ) : (
                      <div
                        style={{
                          height: 22,
                          borderRadius: 7,
                          border: '1px solid rgba(250,204,21,.38)',
                          background: 'rgba(250,204,21,.08)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontFamily: "'Orbitron',monospace",
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: '#facc15',
                          letterSpacing: 0.65,
                          textTransform: 'uppercase',
                          animation: 'dashboard-text-scale-up 340ms ease',
                        }}
                      >
                        Missão Concluída
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {allMissionsCompleted && isLogged && toNumber(jogador?.id) === toNumber(jogadorId) && (
              <button
                type="button"
                onClick={handleClaimMissions}
                disabled={claimingMissions}
                style={{
                  marginTop: 10,
                  width: '100%',
                  height: 38,
                  borderRadius: 9,
                  border: '1px solid rgba(250,204,21,.55)',
                  background: 'linear-gradient(90deg, rgba(250,204,21,.18), rgba(245,158,11,.18))',
                  color: '#fde68a',
                  fontFamily: "'Orbitron',monospace",
                  fontSize: 12.5,
                  fontWeight: 800,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  cursor: claimingMissions ? 'not-allowed' : 'pointer',
                  opacity: claimingMissions ? 0.65 : 1,
                  boxShadow: '0 0 16px rgba(250,204,21,.28)',
                }}
              >
                {claimingMissions ? 'Resgatando...' : '🪙 Resgatar 40 gold'}
              </button>
            )}

            {claimToast && (
              <div
                style={{
                  marginTop: 8,
                  textAlign: 'center',
                  fontFamily: "'Rajdhani',sans-serif",
                  fontWeight: 700,
                  fontSize: 12,
                  color: '#facc15',
                }}
              >
                {claimToast}
              </div>
            )}
          </div>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
          <Card
            title="Histórico do Jogador"
            centerTitle
            titleStyle={{ marginTop: 5, width: '100%', letterSpacing: 0.3 }}
            style={{ ...dashboardGlowCardStyle, flex: 1, minHeight: 0 }}
            action={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 7, marginTop: 5 }}>
                {canGoHistoryNewer && (
                  <button
                    onClick={() => setHistoryPage((prev) => Math.max(0, prev - 1))}
                    style={{
                      border: '1px solid rgba(255,255,255,.18)',
                      borderRadius: 7,
                      width: 28,
                      height: 28,
                      background: 'rgba(255,255,255,.06)',
                      color: '#fff',
                      fontSize: 16,
                      fontWeight: 700,
                      cursor: 'pointer',
                      lineHeight: 1,
                    }}
                  >
                    ‹
                  </button>
                )}
                {historyTotalPages > 1 && (
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', fontFamily: "'Orbitron',monospace" }}>
                    {safeHistoryPage + 1}/{historyTotalPages}
                  </span>
                )}
                {canGoHistoryOlder && (
                  <button
                    onClick={() => setHistoryPage((prev) => Math.min(historyTotalPages - 1, prev + 1))}
                    style={{
                      border: '1px solid rgba(255,255,255,.18)',
                      borderRadius: 7,
                      width: 28,
                      height: 28,
                      background: 'rgba(255,255,255,.06)',
                      color: '#fff',
                      fontSize: 16,
                      fontWeight: 700,
                      cursor: 'pointer',
                      lineHeight: 1,
                    }}
                  >
                    ›
                  </button>
                )}
                
                <DashboardDropdown
                  value={monthKey}
                  onChange={(nextValue) => setMonthKey(nextValue)}
                  options={monthOptions}
                  width={170}
                  rightSpacing={0}
                  title={`Filtro de mês em ${seasonLabel(seasonId)}`}
                />
              </div>
            }
          >
            {historyVisible.length === 0 ? (
              <div
                style={{
                  height: 200,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 10,
                  border: '1px dashed rgba(255,255,255,.18)',
                  color: 'rgba(255,255,255,.8)',
                  fontFamily: "'Rajdhani',sans-serif",
                  fontWeight: 700,
                  letterSpacing: 0.4,
                }}
              >
                Sem histórico de partidas para este jogador.
              </div>
            ) : (
              <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ marginBottom: 4 }}>
                {[0, 0.25, 0.5, 0.75, 1].map((p) => (
                  <line key={p} x1={PL} y1={PT + p * (H - PT - PB)} x2={W - PR} y2={PT + p * (H - PT - PB)} stroke="rgba(255,255,255,.11)" strokeWidth={1} strokeDasharray="6,6" />
                ))}
                {historySegments.map((seg, i) => (
                  <line
                    key={`seg-${i}`}
                    x1={seg.x1}
                    y1={seg.y1}
                    x2={seg.x2}
                    y2={seg.y2}
                    stroke={colorByResult(seg.won)}
                    strokeWidth={2.4}
                    strokeLinecap="round"
                  />
                ))}
                {historyPoints.map((point, i) => {
                  const clickable = !!point.match.codigo && String(point.match.codigo).trim() !== '-'
                  return (
                    <g
                      key={`dot-hist-${point.match.id}-${i}`}
                      onMouseEnter={() => setHoveredHistoryPointKey(`${safeHistoryPage}-${i}`)}
                      onMouseLeave={() => setHoveredHistoryPointKey((prev) => (prev === `${safeHistoryPage}-${i}` ? null : prev))}
                      onClick={() => {
                        if (clickable) openHistoryMatch(point.match.codigo)
                      }}
                      style={{ cursor: clickable ? 'pointer' : 'default' }}
                    >
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={8}
                        fill="transparent"
                        stroke={clickable ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.06)'}
                        strokeWidth={1}
                      />
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={4.5}
                        fill={colorByResult(point.match.won)}
                        stroke="#0a101c"
                        strokeWidth={2}
                      />
                    </g>
                  )
                })}
                {historyPoints.map((point, i) => (
                  <text
                    key={`x-hist-${point.match.id}-${i}`}
                    x={point.x}
                    y={H - 8}
                    textAnchor="middle"
                    fill="rgba(255,255,255,.84)"
                    fontSize={10}
                    fontWeight={700}
                    fontFamily="'Rajdhani',sans-serif"
                  >
                    {asDateLabel(point.match.createdAt)}
                  </text>
                ))}
                {historyPoints.map((point, i) => (
                  <text
                    key={`val-hist-${point.match.id}-${i}`}
                    x={point.x}
                    y={point.y - 9}
                    textAnchor="middle"
                    fill={colorByResult(point.match.won)}
                    fontSize={10}
                    fontWeight="700"
                    fontFamily="'Orbitron',monospace"
                  >
                    {point.match.adr.toFixed(1)}
                  </text>
                ))}
                {hoveredHistoryPoint ? (
                  (() => {
                    const tooltipWidth = 312
                    const tooltipHeight = 108
                    const x = Math.max(
                      8,
                      Math.min(W - tooltipWidth - 8, hoveredHistoryPoint.x + 10)
                    )
                    const y = Math.max(
                      8,
                      Math.min(H - tooltipHeight - 8, hoveredHistoryPoint.y - tooltipHeight - 10)
                    )
                    const scoreA =
                      hoveredHistoryPoint.match.scoreA === null
                        ? '-'
                        : String(hoveredHistoryPoint.match.scoreA)
                    const scoreB =
                      hoveredHistoryPoint.match.scoreB === null
                        ? '-'
                        : String(hoveredHistoryPoint.match.scoreB)
                    const ratingPts = hoveredHistoryPoint.match.ratingPoints
                    const deltaLabel =
                      hoveredHistoryPoint.match.won === true
                        ? `+${Math.abs(ratingPts)}`
                        : hoveredHistoryPoint.match.won === false
                        ? `-${Math.abs(ratingPts)}`
                        : `${ratingPts}`
                    const deltaColor =
                      hoveredHistoryPoint.match.won === false
                        ? '#f87171'
                        : hoveredHistoryPoint.match.won === true
                        ? '#4ade80'
                        : '#cbd5e1'

                    return (
                      <g style={{ pointerEvents: 'none' }}>
                        <rect
                          x={x}
                          y={y}
                          width={tooltipWidth}
                          height={tooltipHeight}
                          rx={8}
                          fill="#0f1b30"
                          stroke="#3b4f70"
                          strokeWidth={1.1}
                        />
                        <text
                          x={x + 10}
                          y={y + 20}
                          fill="#f8fafc"
                          fontSize={12.5}
                          fontWeight={700}
                          fontFamily="'Rajdhani',sans-serif"
                        >
                          <tspan>{hoveredHistoryPoint.match.team1Name}</tspan>
                          <tspan fill="#22d3ee">{` ${scoreA}`}</tspan>
                          <tspan fill="#dbeafe"> x </tspan>
                          <tspan fill="#fb923c">{scoreB}</tspan>
                          <tspan>{` ${hoveredHistoryPoint.match.team2Name}`}</tspan>
                        </text>
                        <text
                          x={x + 10}
                          y={y + 44}
                          fill="#e2e8f0"
                          fontSize={12}
                          fontWeight={700}
                          fontFamily="'Rajdhani',sans-serif"
                        >
                          {`Mapa: ${normalizeMapKey(hoveredHistoryPoint.match.mapa).replace(/^de_/, 'de_')}`}
                        </text>
                        <text
                          x={x + 10}
                          y={y + 66}
                          fill="#e2e8f0"
                          fontSize={12}
                          fontWeight={700}
                          fontFamily="'Rajdhani',sans-serif"
                        >
                          {`K/A/D: ${hoveredHistoryPoint.match.kills}/${hoveredHistoryPoint.match.assists}/${hoveredHistoryPoint.match.deaths} · KDA ${hoveredHistoryPoint.match.kda.toFixed(2)}`}
                        </text>
                        <text
                          x={x + 10}
                          y={y + 88}
                          fill="#e2e8f0"
                          fontSize={12}
                          fontWeight={700}
                          fontFamily="'Rajdhani',sans-serif"
                        >
                          <tspan>{`Rating Points: ${ratingPts.toFixed(0)} (`}</tspan>
                          <tspan fill={deltaColor}>{deltaLabel}</tspan>
                          <tspan>)</tspan>
                        </text>
                      </g>
                    )
                  })()
                ) : null}
              </svg>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 7, marginTop: 8, paddingLeft: 5, paddingRight: 5 }}>
              {historyStatItems.map((s) => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,.035)', border: `1px solid ${s.color}25`, borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 14, fontWeight: 700, color: '#ffffff', lineHeight: 1, marginBottom: 3 }}>{s.value}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,.82)', fontFamily: "'Rajdhani',sans-serif", letterSpacing: 1, fontWeight: 700 }}>{s.label.toUpperCase()}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card
            title="Destaques do Jogador"
            centerTitle
            titleStyle={{ marginTop: 2, width: '100%', fontSize: 16, letterSpacing: 0.6 }}
            style={{ ...dashboardGlowCardStyle, flex: '0 0 auto', minHeight: 208 }}
          >
            <div
              className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-6"
              style={{ gap: 3, paddingLeft: 3, paddingRight: 3, paddingBottom: 3 }}
            >
              <div
                style={{
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,.1)',
                  background: 'rgba(9,14,29,.75)',
                  padding: '8px 6px',
                  textAlign: 'center',
                }}
              >
                <div style={{ display: 'grid', placeItems: 'center', marginBottom: 5 }}>
                  <HighlightMapIcon mapKey={bestMapEntry?.mapKey} size={40} />
                </div>
                <div style={{ fontSize: 7.2, color: 'rgba(255,255,255,.6)', fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', lineHeight: 1.1 }}>Melhor mapa</div>
                <div style={{ fontSize: 15, lineHeight: 1, color: '#fff', fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, textTransform: 'uppercase', marginTop: 2 }}>{bestMapLabel}</div>
              </div>

              <div
                style={{
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,.1)',
                  background: 'rgba(9,14,29,.75)',
                  padding: '8px 6px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 28, lineHeight: 1, marginBottom: 5 }}>🏅</div>
                <div style={{ fontSize: 7.2, color: 'rgba(255,255,255,.6)', fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', lineHeight: 1.1 }}>Sequência de vitórias</div>
                <div style={{ fontSize: 24, lineHeight: 1, color: '#fff', fontFamily: "'Orbitron',monospace", fontWeight: 700, marginTop: 2 }}>{longestWinStreak}</div>
              </div>

              <div
                style={{
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,.1)',
                  background: 'rgba(9,14,29,.75)',
                  padding: '8px 6px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 27, lineHeight: 1, marginBottom: 5 }}>📈</div>
                <div style={{ fontSize: 7.2, color: 'rgba(255,255,255,.6)', fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', lineHeight: 1.1 }}>Melhor rating</div>
                <div style={{ fontSize: 23, lineHeight: 1, color: '#fff', fontFamily: "'Orbitron',monospace", fontWeight: 700, marginTop: 2 }}>{bestRating.toFixed(1)}</div>
              </div>

              <div
                style={{
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,.1)',
                  background: 'rgba(9,14,29,.75)',
                  padding: '8px 6px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 27, lineHeight: 1, marginBottom: 5 }}>🪙</div>
                <div style={{ fontSize: 7.2, color: 'rgba(255,255,255,.6)', fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', lineHeight: 1.1 }}>Maior ponto última</div>
                <div style={{ fontSize: 23, lineHeight: 1, color: '#fff', fontFamily: "'Orbitron',monospace", fontWeight: 700, marginTop: 2 }}>{lastMatchPoints.toFixed(0)}</div>
              </div>

              <div
                style={{
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,.1)',
                  background: 'rgba(9,14,29,.75)',
                  padding: '8px 6px',
                  textAlign: 'center',
                }}
              >
                <div style={{ display: 'grid', placeItems: 'center', marginBottom: 5 }}>
                  <HighlightMapIcon mapKey={favoriteMapEntry?.mapKey} size={40} />
                </div>
                <div style={{ fontSize: 7.2, color: 'rgba(255,255,255,.6)', fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', lineHeight: 1.1 }}>Mapa preferido</div>
                <div style={{ fontSize: 15, lineHeight: 1, color: '#fff', fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, textTransform: 'uppercase', marginTop: 2 }}>{favoriteMapLabel}</div>
              </div>

              <div
                style={{
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,.1)',
                  background: 'rgba(9,14,29,.75)',
                  padding: '8px 6px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 26, lineHeight: 1, marginBottom: 5 }}>📅</div>
                <div style={{ fontSize: 7.2, color: 'rgba(255,255,255,.6)', fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', lineHeight: 1.1 }}>Última partida</div>
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 1.1,
                    color: '#fff',
                    fontFamily: "'Orbitron',monospace",
                    fontWeight: 700,
                    marginTop: 2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {lastMatchDate}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, marginTop: 3, color: colorByResult(lastPlayerMatch?.won ?? null) }}>{lastMatchStatus}</div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Card
        title="Mapas Jogados"
        titleStyle={{ marginLeft: 10, marginTop: 5 }}
        style={dashboardGlowCardStyle}
      >
        <div
          className="grid grid-cols-1 2xl:grid-cols-[max-content_minmax(0,1fr)]"
          style={{ columnGap: 10, rowGap: 10, alignItems: 'start' }}
        >
          <div style={{ overflowX: 'auto', paddingBottom: 4, paddingLeft: 10, paddingTop: 5, width: 'max-content' }}>
            <div style={{ display: 'flex', gap: 12, minWidth: 1044 }}>
              {mapStats.map((stat) => (
                <MapPlayedTile key={stat.key} stat={stat} />
              ))}
            </div>
          </div>

          <div
            style={{
              marginTop: 5,
              alignSelf: 'start',
              marginRight: 5,
              width: 'calc(100% - 5px)',
              boxSizing: 'border-box',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,.08)',
              background: 'rgba(255,255,255,.02)',
              padding: '9px 9px 8px',
            }}
          >
            <div
              style={{
                fontFamily: "'Rajdhani',sans-serif",
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: 0.6,
                color: '#fff',
                marginBottom: 8,
                paddingBottom: 6,
                borderBottom: '1px solid rgba(255,255,255,.08)',
                textTransform: 'uppercase',
              }}
            >
              Últimas partidas:
            </div>

            {latestIndividualMatches.length === 0 ? (
              <div
                style={{
                  color: 'rgba(255,255,255,.45)',
                  fontFamily: "'Rajdhani',sans-serif",
                  fontSize: 13,
                  fontWeight: 700,
                  padding: '12px 4px',
                }}
              >
                Sem partidas recentes com estatísticas individuais.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 6 }}>
                {latestIndividualMatches.map((m, idx) => (
                  <div
                    key={`last-match-${m.id}-${idx}`}
                    style={{
                      borderRadius: 8,
                      border: '1px solid rgba(255,255,255,.08)',
                      background: 'rgba(255,255,255,.03)',
                      padding: '6px 7px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 4,
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "'Orbitron',monospace",
                          fontSize: 11,
                          color: '#fff',
                          fontWeight: 700,
                          letterSpacing: 0.4,
                          textTransform: 'uppercase',
                        }}
                      >
                        {mapDisplayLabel(normalizeMapKey(m.mapa)).toUpperCase()}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          fontFamily: "'Rajdhani',sans-serif",
                          color: colorByResult(m.won),
                          letterSpacing: 0.5,
                        }}
                      >
                        {m.won === true ? 'VITÓRIA' : m.won === false ? 'DERROTA' : 'N/A'}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: 11,
                        fontFamily: "'Rajdhani',sans-serif",
                        fontWeight: 700,
                        lineHeight: 1.35,
                        color: 'rgba(255,255,255,.86)',
                        letterSpacing: 0.15,
                      }}
                    >
                      <span style={{ color: 'rgba(255,255,255,.6)' }}>K</span> {m.kills} ·{' '}
                      <span style={{ color: 'rgba(255,255,255,.6)' }}>A</span> {m.assists} ·{' '}
                      <span style={{ color: 'rgba(255,255,255,.6)' }}>D</span> {m.deaths} ·{' '}
                      <span style={{ color: 'rgba(255,255,255,.6)' }}>KDA</span> {m.kda.toFixed(2)} ·{' '}
                      <span style={{ color: 'rgba(255,255,255,.6)' }}>KAST</span> {m.kast.toFixed(0)}% ·{' '}
                      <span style={{ color: 'rgba(255,255,255,.6)' }}>FK</span> {m.firstKill} ·{' '}
                      <span style={{ color: 'rgba(255,255,255,.6)' }}>MK</span> {m.multiKill}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      {!!loadError && (
        <div
          style={{
            background: 'rgba(248,113,113,.08)',
            border: '1px solid rgba(248,113,113,.3)',
            borderRadius: 10,
            padding: '10px 14px',
            color: '#fda4af',
            fontFamily: "'Rajdhani',sans-serif",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          Falha ao carregar dados do dashboard: {loadError}
        </div>
      )}
    </div>
  )
}
