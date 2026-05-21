import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Btn, Card } from '@/components/ui/Card'
import { LEVEL_COLOR_BY_ID } from '@/components/profile/PlayerProfilePreview'
import { useAuth } from '@/hooks/useAuth'
import * as api from '@/services/api'
import type { MixMapCard, MixMapPlayerStats, MixPlayer, TirarMixSnapshot } from '@/services/api'

type Team = 'A' | 'B'
type MixPhase = TirarMixSnapshot['fase']
const CAPTAIN_SLOT_BTN_CLASS =
  '!text-sm sm:!text-[15px] min-h-[42px] sm:min-h-[46px] !px-4 sm:!px-5'

const TEAM_META: Record<Team, { color: string; soft: string; border: string }> = {
  A: {
    color: '#ff6b82',
    soft: 'rgba(255,107,130,0.13)',
    border: 'rgba(255,107,130,0.35)',
  },
  B: {
    color: '#5eb7ff',
    soft: 'rgba(94,183,255,0.13)',
    border: 'rgba(94,183,255,0.35)',
  },
}

const PHASE_LABELS: Record<MixPhase, string> = {
  aguardando_capitaes: 'Aguardando capitães',
  aguardando_inicio: 'Aguardando capitães iniciarem',
  countdown: 'Contagem regressiva',
  dice: 'Lançamento de dados',
  draft: 'Picks em andamento',
  finalizado: 'Times definidos',
}

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

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const normalized = String(value ?? '')
    .trim()
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : 0
}

function normalizeLevel(value: unknown): number {
  const n = toNumber(value)
  return Math.max(0, Math.min(15, Math.round(n)))
}

function levelAccentColor(level: number): string {
  return LEVEL_COLOR_BY_ID[level] || '#a78bfa'
}

function playerNameWithLevel(player?: { nome?: string | null; level?: unknown } | null, fallback = 'Sem capitão') {
  const nome = String(player?.nome || '').trim()
  if (!nome) return fallback
  const lv = normalizeLevel((player as any)?.level)
  return `${nome} (LV ${lv})`
}

function onlineLastSeenLabel(value?: string | null) {
  if (!value) return 'Online agora'
  const ts = new Date(value).getTime()
  if (!Number.isFinite(ts)) return 'Online agora'
  const now = Date.now()
  const days = Math.floor((now - ts) / (24 * 60 * 60 * 1000))
  if (days <= 0) return 'Ativo: hoje'
  if (days === 1) return 'Ativo: ontem'
  if (days < 7) return `Ativo: ${days}d`
  return `Ativo: ${new Date(ts).toLocaleDateString('pt-BR')}`
}

function formatKda(value: unknown): string {
  if (value == null) return '0.00'
  const raw = String(value).trim()
  if (!raw) return '0.00'
  const normalized = raw.replace(',', '.')
  const n = Number(normalized)
  if (!Number.isFinite(n)) return '0.00'
  return n.toFixed(2)
}

function avatarSrc(player?: MixPlayer | null) {
  const raw = String(player?.imagem || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  if (raw.startsWith('/')) return raw
  return `/${raw}`
}

function initials(name: string) {
  const chunks = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const a = chunks[0]?.[0] || '?'
  const b = chunks[1]?.[0] || ''
  return `${a}${b}`.toUpperCase()
}

function phaseText(phase?: MixPhase | null) {
  if (!phase) return '—'
  return PHASE_LABELS[phase] ?? phase
}

function mapLabel(mapa?: string | null) {
  const raw = String(mapa || '')
  if (!raw) return '—'
  return raw.replace(/^de_/i, '').replace(/_/g, ' ').toUpperCase()
}

function normalizeDie(value?: number | null): 1 | 2 | 3 | 4 | 5 | 6 {
  if (value && value >= 1 && value <= 6) return value as 1 | 2 | 3 | 4 | 5 | 6
  return 1
}

function Die3D({
  value,
  rolling,
  color,
}: {
  value?: number | null
  rolling?: boolean
  color: string
}) {
  const safe = normalizeDie(value)
  return (
    <div className='tmx-die-stage'>
      <div
        className={`tmx-die-cube show-${safe} ${rolling ? 'is-rolling' : ''} ${value == null ? 'is-empty' : ''}`}
        style={{ ['--tmx-die-accent' as any]: color }}
      >
        <div className='tmx-die-face one'>
          <div className='tmx-die-dot one-1' />
        </div>
        <div className='tmx-die-face two'>
          <div className='tmx-die-dot two-1' />
          <div className='tmx-die-dot two-2' />
        </div>
        <div className='tmx-die-face three'>
          <div className='tmx-die-dot three-1' />
          <div className='tmx-die-dot three-2' />
          <div className='tmx-die-dot three-3' />
        </div>
        <div className='tmx-die-face four'>
          <div className='tmx-die-dot four-1' />
          <div className='tmx-die-dot four-2' />
          <div className='tmx-die-dot four-3' />
          <div className='tmx-die-dot four-4' />
        </div>
        <div className='tmx-die-face five'>
          <div className='tmx-die-dot five-1' />
          <div className='tmx-die-dot five-2' />
          <div className='tmx-die-dot five-3' />
          <div className='tmx-die-dot five-4' />
          <div className='tmx-die-dot five-5' />
        </div>
        <div className='tmx-die-face six'>
          <div className='tmx-die-dot six-1' />
          <div className='tmx-die-dot six-2' />
          <div className='tmx-die-dot six-3' />
          <div className='tmx-die-dot six-4' />
          <div className='tmx-die-dot six-5' />
          <div className='tmx-die-dot six-6' />
        </div>
      </div>
    </div>
  )
}

function PlayerChip({
  player,
  team,
  captain = false,
  compact = false,
  action,
}: {
  player: MixPlayer
  team: Team
  captain?: boolean
  compact?: boolean
  action?: ReactNode
}) {
  const meta = TEAM_META[team]
  const avatar = avatarSrc(player)
  const level = normalizeLevel((player as any)?.level)
  const levelColor = levelAccentColor(level)
  return (
    <div
      className='tmx-chip'
      style={{
        border: `1px solid ${meta.border}`,
        background: captain
          ? `linear-gradient(135deg, ${meta.soft}, rgba(255,255,255,0.03))`
          : 'rgba(255,255,255,0.025)',
        minHeight: compact ? 44 : 62,
      }}
    >
      {avatar ? (
        <img
          src={avatar}
          alt={player.nome}
          className='tmx-avatar'
          style={{ width: compact ? 30 : 40, height: compact ? 30 : 40 }}
          onError={(e) => {
            ;(e.target as HTMLImageElement).style.display = 'none'
          }}
        />
      ) : (
        <div
          className='tmx-avatar'
          style={{
            width: compact ? 30 : 40,
            height: compact ? 30 : 40,
            background: `linear-gradient(135deg, ${meta.color}, ${meta.color}99)`,
          }}
        >
          {initials(player.nome)}
        </div>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, marginBottom: 5 }}>
          <div
            style={{
              color: '#fff',
              fontSize: compact ? 13 : 16,
              fontWeight: 700,
              fontFamily: "'Rajdhani',sans-serif",
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0,
            }}
          >
            {player.nome}
            {captain ? ' (capitão)' : ''}
          </div>
          <span
            style={{
              color: levelColor,
              border: `1px solid ${levelColor}88`,
              background: `${levelColor}1a`,
              boxShadow: `0 0 10px ${levelColor}22 inset`,
              borderRadius: 6,
              fontSize: compact ? 9 : 10,
              fontWeight: 800,
              fontFamily: "'Orbitron',monospace",
              letterSpacing: 0.5,
              padding: compact ? '1px 5px' : '1px 6px',
              flexShrink: 0,
              lineHeight: 1.25,
            }}
          >
            LV {level}
          </span>
        </div>
        <div
          style={{
            color: 'rgba(255,255,255,0.76)',
            fontSize: compact ? 11 : 12,
            fontFamily: "'Rajdhani',sans-serif",
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <span className='tmx-stat-chip'>
            K/D/A <b>{formatKda(player.kda_player)}</b>
          </span>
          <span className='tmx-stat-chip'>
            ADR <b>{toNumber(player.adr).toFixed(1)}</b>
          </span>
        </div>
      </div>
      {action ? (
        <div
          style={{
            marginLeft: 'auto',
            marginRight: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            flexShrink: 0,
          }}
        >
          {action}
        </div>
      ) : null}
    </div>
  )
}

function EmptySlot({ team, label, action }: { team: Team; label: string; action?: ReactNode }) {
  return (
    <div
      className='tmx-chip'
      style={{
        border: `1px dashed ${TEAM_META[team].border}`,
        background: 'rgba(255,255,255,0.015)',
        minHeight: 58,
      }}
    >
      <div className='tmx-avatar tmx-avatar-empty' />
      <div
        style={{
          color: 'rgba(255,255,255,0.34)',
          fontSize: 12,
          fontFamily: "'Rajdhani',sans-serif",
          letterSpacing: 0.8,
        }}
      >
        {label}
      </div>
      {action ? (
        <div
          style={{
            marginLeft: 'auto',
            marginRight: 4,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'flex-end',
          }}
        >
          {action}
        </div>
      ) : null}
    </div>
  )
}

function TeamHeader({ team, captainName }: { team: Team; captainName?: string | null }) {
  const isA = team === 'A'
  const safeCaptain = String(captainName || '').trim()
  const title = safeCaptain ? `Time ${safeCaptain}` : `Time ${team}`
  return (
    <div className={`tmx-team-title ${isA ? 'is-red' : 'is-blue'}`}>
      <div className='tmx-team-title-main'>{title}</div>
    </div>
  )
}

type TeamAggregateStats = {
  playersCount: number
  avgAdr: number
  avgKda: number
  avgWinRate: number
}

type TeamTopMapStat = {
  mapa: string
  playersWithData: number
  totalPlayers: number
  totalPartidas: number
  totalVitorias: number
  combinedWinRate: number
  avgIndividualWinRate: number
}

function toPercent(value: number, max: number) {
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(max) || max <= 0) return 0
  return Math.max(0, Math.min(100, (value / max) * 100))
}

function TeamAggregateCard({
  team,
  stats,
  maxAdr,
  maxKda,
}: {
  team: Team
  stats: TeamAggregateStats
  maxAdr: number
  maxKda: number
}) {
  const accent = team === 'A' ? '#ff6b82' : '#5eb7ff'
  const adrPct = toPercent(stats.avgAdr, maxAdr)
  const kdaPct = toPercent(stats.avgKda, maxKda)
  const wrPct = toPercent(stats.avgWinRate, 100)
  return (
    <div className='tmx-agg-card'>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          borderRadius: 999,
          padding: '3px 10px',
          border: `1px solid ${accent}55`,
          color: '#fff',
          background: `${accent}22`,
          fontSize: 12,
          fontFamily: "'Rajdhani',sans-serif",
          fontWeight: 800,
        }}
      >
        Estatísticas agregadas do time
      </div>
      <div className='tmx-agg-sub'>
        ADR médio, K/D/A médio e win rate do grupo. Atualiza conforme jogadores entram.
      </div>
      <div className='tmx-agg-divider' />

      <div className='tmx-agg-row'>
        <div className='tmx-agg-row-head'>
          <span>ADR médio do time</span>
          <b>{stats.avgAdr.toFixed(1)}</b>
        </div>
        <div className='tmx-agg-bar'>
          <div className='tmx-agg-fill is-adr' style={{ width: `${adrPct}%` }} />
        </div>
      </div>

      <div className='tmx-agg-row'>
        <div className='tmx-agg-row-head'>
          <span>K/D/A médio</span>
          <b>{stats.avgKda.toFixed(2)}</b>
        </div>
        <div className='tmx-agg-bar'>
          <div className='tmx-agg-fill is-kda' style={{ width: `${kdaPct}%` }} />
        </div>
      </div>

      <div className='tmx-agg-row'>
        <div className='tmx-agg-row-head'>
          <span>Win rate médio</span>
          <b>{stats.avgWinRate.toFixed(0)}%</b>
        </div>
        <div className='tmx-agg-bar'>
          <div className='tmx-agg-fill is-wr' style={{ width: `${wrPct}%` }} />
        </div>
      </div>

      <div className='tmx-agg-foot'>{stats.playersCount}/5 jogadores considerados</div>
    </div>
  )
}

function TeamTopMapsCard({
  team,
  maps,
}: {
  team: Team
  maps: TeamTopMapStat[]
}) {
  const accent = team === 'A' ? '#ff6b82' : '#5eb7ff'
  return (
    <div className='tmx-topmaps-card'>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          borderRadius: 999,
          padding: '3px 10px',
          border: `1px solid ${accent}55`,
          color: '#ffffff',
          background: `${accent}22`,
          fontSize: 12,
          fontFamily: "'Rajdhani',sans-serif",
          fontWeight: 800,
        }}
      >
        Média do TOP 3 melhores mapas do time
      </div>
      <div className='tmx-topmaps-sub'>
        Média dos mapas com maiores winrates do jogadores.
      </div>
      <div className='tmx-agg-divider' />

      {maps.length === 0 ? (
        <div className='tmx-topmaps-empty'>
          Ainda não há histórico de mapas suficiente para o time.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {maps.map((item, index) => (
            <div key={`${team}-top-map-${item.mapa}-${index}`} className='tmx-topmap-row'>
              <div className='tmx-topmap-head'>
                <div>
                  <span className='tmx-topmap-rank'>#{index + 1}</span> {mapLabel(item.mapa)}
                </div>
                <b>{item.combinedWinRate.toFixed(1)}%</b>
              </div>
              <div className='tmx-agg-bar'>
                <div
                  className='tmx-agg-fill is-topmap'
                  style={{ width: `${toPercent(item.combinedWinRate, 100)}%` }}
                />
              </div>
              <div className='tmx-topmap-meta'>
                {item.playersWithData}/{item.totalPlayers} jogadores · {item.totalPartidas} partidas ·{' '}
                {item.totalVitorias} vitórias · WR médio individual {item.avgIndividualWinRate.toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MapStatsProjection({
  mapCard,
  teamNames,
  onClose,
}: {
  mapCard: MixMapCard
  teamNames: Record<Team, string>
  onClose: () => void
}) {
  const buildRows = (team: Team) => {
    const stats = [...(mapCard.stats?.[team] || [])]
    const ordered = stats.sort((a, b) => {
      if (b.partidas !== a.partidas) return b.partidas - a.partidas
      if (b.vitorias !== a.vitorias) return b.vitorias - a.vitorias
      return b.winRate - a.winRate
    })
    return Array.from({ length: 5 }, (_, idx) => ordered[idx] || null)
  }

  const teamRowsA = buildRows('A')
  const teamRowsB = buildRows('B')

  const renderRow = (row: MixMapPlayerStats | null, idx: number, side: Team) => {
    const tone = side === 'A' ? '#ff9fb1' : '#8dd3ff'
    if (!row) {
      return (
        <div key={`${side}-empty-${idx}`} className='tmx-proj-player is-empty'>
          <div className='tmx-proj-player-name'>Jogador {idx + 1}</div>
          <div className='tmx-proj-player-stats'>Sem dados para este mapa</div>
        </div>
      )
    }
    return (
      <div key={`${side}-${row.jogador_id}-${idx}`} className='tmx-proj-player'>
        <div className='tmx-proj-player-name' style={{ color: tone }}>
          {idx + 1}. {row.nome}
        </div>
        <div className='tmx-proj-player-stats'>
          <span>
            Partidas <b>{row.partidas}</b>
          </span>
          <span>
            Vitórias <b>{row.vitorias}</b>
          </span>
          <span>
            Win rate <b>{row.winRate.toFixed(1)}%</b>
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className='tmx-proj-overlay' onClick={onClose}>
      <div className='tmx-proj-modal' onClick={(e) => e.stopPropagation()}>
        <div className='tmx-proj-door left' />
        <div className='tmx-proj-door right' />

        <div className='tmx-proj-head'>
          <div>
            <div className='tmx-proj-kicker'>DESEMPENHO DOS JOGADORES</div>
            <div className='tmx-proj-title'>{mapLabel(mapCard.mapa)}</div>
          </div>
          <button type='button' className='tmx-proj-close' onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className='tmx-proj-grid'>
          <div className='tmx-proj-team is-red'>
            <div className='tmx-proj-team-title'>{teamNames.A}</div>
            {teamRowsA.map((row, idx) => renderRow(row, idx, 'A'))}
          </div>
          <div className='tmx-proj-team is-blue'>
            <div className='tmx-proj-team-title'>{teamNames.B}</div>
            {teamRowsB.map((row, idx) => renderRow(row, idx, 'B'))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TirarTimePage() {
  const { isLogged, isAdmin } = useAuth()

  const [snapshot, setSnapshot] = useState<TirarMixSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' | '' }>({
    msg: '',
    type: '',
  })
  const [rollingTeam, setRollingTeam] = useState<Team | null>(null)
  const [pickAnimId, setPickAnimId] = useState<number | null>(null)
  const [diceDisplay, setDiceDisplay] = useState<Record<Team, { d1: number | null; d2: number | null }>>({
    A: { d1: null, d2: null },
    B: { d1: null, d2: null },
  })
  const [mapStatsOpen, setMapStatsOpen] = useState<Record<string, boolean>>({})
  const [mapProjectionKey, setMapProjectionKey] = useState<string | null>(null)
  const [mapImageTry, setMapImageTry] = useState<Record<string, number>>({})

  const mountedRef = useRef(true)
  const pollLockRef = useRef(false)
  const previousPoolRef = useRef<number[]>([])
  const toastTimerRef = useRef<number | null>(null)
  const diceSpinTimerRef = useRef<number | null>(null)

  const showToast = useCallback((msg: string, type: 'ok' | 'err') => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    setToast({ msg, type })
    toastTimerRef.current = window.setTimeout(() => {
      setToast({ msg: '', type: '' })
    }, 2600)
  }, [])

  const clearDiceSpin = useCallback(() => {
    if (diceSpinTimerRef.current) {
      window.clearInterval(diceSpinTimerRef.current)
      diceSpinTimerRef.current = null
    }
  }, [])

  const applySnapshot = useCallback((next: TirarMixSnapshot) => {
    const nextPool = next.pool.map((p) => Number(p.jogador_id))
    const removed = previousPoolRef.current.find((id) => !nextPool.includes(id))
    if (removed) {
      setPickAnimId(removed)
      window.setTimeout(() => {
        setPickAnimId((current) => (current === removed ? null : current))
      }, 720)
    }
    previousPoolRef.current = nextPool
    if (next.fase !== 'dice' && next.mapDraft?.stage !== 'dice') setRollingTeam(null)
    setSnapshot(next)
    setError('')
  }, [])

  const randomDice = useCallback(() => Math.floor(Math.random() * 6) + 1, [])

  const mapImageCandidates = useCallback((m: MixMapCard) => {
    const mapKey = String(m?.mapa || '').trim().toLowerCase()
    const rawImage = String(m?.image || '').trim()
    const cleanRaw = rawImage.replace(/^\/+/, '')
    const normalizedImage = !cleanRaw
      ? ''
      : /^https?:\/\//i.test(rawImage)
      ? rawImage
      : cleanRaw.startsWith('uploads/')
      ? `/${cleanRaw}`
      : cleanRaw.startsWith('de_')
      ? `/uploads/mapas/${cleanRaw}`
      : `/uploads/mapas/${cleanRaw}`

    const list = [
      `/uploads/mapas/${mapKey}.png`,
      `/uploads/mapas/${mapKey}.jpg`,
      `/uploads/mapas/${mapKey}.jpeg`,
      `/uploads/mapas/${mapKey}.webp`,
      normalizedImage,
      cleanRaw ? `/${cleanRaw}` : '',
    ].filter(Boolean)

    return Array.from(new Set(list))
  }, [])

  const bootstrap = useCallback(async () => {
    if (!isLogged) {
      setLoading(false)
      setSnapshot(null)
      return
    }
    setLoading(true)
    try {
      const snap = await api.mixSessaoAtual()
      if (!mountedRef.current) return
      applySnapshot(snap)
    } catch (err: any) {
      if (!mountedRef.current) return
      setError(err?.message || 'Erro ao carregar sessão de tirar time.')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [applySnapshot, isLogged])

  const refreshSnapshot = useCallback(
    async (sessionId?: number) => {
      if (!isLogged || pollLockRef.current) return
      pollLockRef.current = true
      try {
        const snap = await api.mixSnapshot(sessionId)
        if (!mountedRef.current) return
        applySnapshot(snap)
      } catch {
        // polling silencioso
      } finally {
        pollLockRef.current = false
      }
    },
    [applySnapshot, isLogged]
  )

  useEffect(() => {
    mountedRef.current = true
    bootstrap()
    return () => {
      mountedRef.current = false
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
      clearDiceSpin()
    }
  }, [bootstrap, clearDiceSpin])

  useEffect(() => {
    if (!snapshot || rollingTeam) return
    const diceSource = snapshot.mapDraft?.stage && snapshot.mapDraft.stage !== 'idle'
      ? snapshot.mapDraft.dice
      : snapshot.dice
    setDiceDisplay({
      A: { d1: diceSource.a.d1, d2: diceSource.a.d2 },
      B: { d1: diceSource.b.d1, d2: diceSource.b.d2 },
    })
  }, [
    rollingTeam,
    snapshot?.dice.a.d1,
    snapshot?.dice.a.d2,
    snapshot?.dice.b.d1,
    snapshot?.dice.b.d2,
    snapshot?.mapDraft?.stage,
    snapshot?.mapDraft?.dice.a.d1,
    snapshot?.mapDraft?.dice.a.d2,
    snapshot?.mapDraft?.dice.b.d1,
    snapshot?.mapDraft?.dice.b.d2,
  ])

  useEffect(() => {
    clearDiceSpin()
    if (!rollingTeam) return
    diceSpinTimerRef.current = window.setInterval(() => {
      setDiceDisplay((prev) => ({
        ...prev,
        [rollingTeam]: { d1: randomDice(), d2: randomDice() },
      }))
    }, 95)
    return clearDiceSpin
  }, [clearDiceSpin, randomDice, rollingTeam])

  useEffect(() => {
    if (!isLogged || !snapshot?.id) return
    const pollId = window.setInterval(() => refreshSnapshot(snapshot.id), 1200)
    const hbId = window.setInterval(() => {
      api.mixHeartbeat().catch(() => {})
    }, 25000)
    return () => {
      window.clearInterval(pollId)
      window.clearInterval(hbId)
    }
  }, [isLogged, refreshSnapshot, snapshot?.id])

  useEffect(() => {
    if (!snapshot || snapshot.mapDraft?.stage === 'idle') {
      setMapStatsOpen({})
      setMapProjectionKey(null)
      setMapImageTry({})
    }
  }, [snapshot?.id, snapshot?.mapDraft?.stage])

  useEffect(() => {
    if (!mapProjectionKey || !snapshot?.mapDraft?.maps?.length) return
    const exists = snapshot.mapDraft.maps.some((m) => m.mapa === mapProjectionKey)
    if (!exists) setMapProjectionKey(null)
  }, [mapProjectionKey, snapshot?.mapDraft?.maps])

  useEffect(() => {
    if (!mapProjectionKey) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMapProjectionKey(null)
        setMapStatsOpen({})
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mapProjectionKey])

  const runAction = useCallback(
    async (id: string, fn: () => Promise<TirarMixSnapshot>, okMsg?: string) => {
      setBusy(id)
      try {
        const next = await fn()
        if (!mountedRef.current) return
        applySnapshot(next)
        if (okMsg) showToast(okMsg, 'ok')
      } catch (err: any) {
        if (!mountedRef.current) return
        showToast(err?.message || 'Erro ao executar ação.', 'err')
      } finally {
        if (id === 'roll') setRollingTeam(null)
        if (mountedRef.current) setBusy('')
      }
    },
    [applySnapshot, showToast]
  )

  const rollWithAnimation = useCallback(
    async (team: Team) => {
      if (!snapshot?.id || busy) return
      const startedAt = Date.now()
      setRollingTeam(team)
      setBusy('roll')
      try {
        const next = await api.mixRolarDados(snapshot.id)
        const elapsed = Date.now() - startedAt
        const minAnimationMs = 950
        const waitMs = Math.max(0, minAnimationMs - elapsed)
        if (waitMs > 0) {
          await new Promise<void>((resolve) => window.setTimeout(resolve, waitMs))
        }
        if (!mountedRef.current) return
        applySnapshot(next)
        showToast('Dado lançado.', 'ok')
      } catch (err: any) {
        if (!mountedRef.current) return
        showToast(err?.message || 'Erro ao lançar dados.', 'err')
      } finally {
        clearDiceSpin()
        if (mountedRef.current) {
          setRollingTeam(null)
          setBusy('')
        }
      }
    },
    [applySnapshot, busy, clearDiceSpin, showToast, snapshot?.id]
  )

  const myTeam = snapshot?.me.team || null
  const isCaptain = snapshot?.me.role === 'capitao'
  const mapStage = snapshot?.mapDraft?.stage || 'idle'
  const isMapFlow = !!snapshot && mapStage !== 'idle'

  const canManageCaptainSlots =
    !!snapshot && snapshot.fase !== 'draft' && snapshot.fase !== 'finalizado'
  const canShowCaptainEnter = (team: Team) =>
    canManageCaptainSlots && snapshot?.me.role !== 'capitao' && !snapshot?.teams[team].captain
  const canShowCaptainLeave = (team: Team) =>
    canManageCaptainSlots && isCaptain && myTeam === team && !!snapshot?.teams[team].captain

  const canEnterPlayer =
    !!snapshot && snapshot.fase !== 'draft' && snapshot.fase !== 'finalizado'

  const canLeave = !!snapshot && snapshot.me.role !== 'fora'
  const canCreateSession = isAdmin && !!snapshot

  const canStart =
    !!snapshot &&
    isCaptain &&
    (snapshot.fase === 'aguardando_inicio' || snapshot.fase === 'countdown')

  const canRoll =
    !!snapshot &&
    isCaptain &&
    myTeam !== null &&
    ((snapshot.fase === 'dice' && snapshot.dice.turn === myTeam) ||
      (snapshot.mapDraft?.stage === 'dice' && snapshot.mapDraft.dice.turn === myTeam)) &&
    busy !== 'roll'

  const canPick = useMemo(() => {
    return !!snapshot && snapshot.fase === 'draft' && isCaptain && snapshot.draft.pickTurn === myTeam
  }, [isCaptain, myTeam, snapshot])
  const canBanMap =
    !!snapshot &&
    isCaptain &&
    myTeam !== null &&
    snapshot.mapDraft?.stage === 'veto' &&
    snapshot.mapDraft.veto.turn === myTeam &&
    !busy

  const poolSlots = useMemo(() => {
    const slotMap = new Map<number, MixPlayer>()
    const overflow: MixPlayer[] = []

    for (const player of snapshot?.pool || []) {
      const slot = Number((player as any)?.pool_slot)
      if (Number.isInteger(slot) && slot >= 1 && slot <= 8 && !slotMap.has(slot)) {
        slotMap.set(slot, player)
      } else {
        overflow.push(player)
      }
    }

    for (let slot = 1; slot <= 8; slot += 1) {
      if (!slotMap.has(slot) && overflow.length) {
        slotMap.set(slot, overflow.shift() as MixPlayer)
      }
    }

    return Array.from({ length: 8 }, (_, idx) => ({
      slot: idx + 1,
      player: slotMap.get(idx + 1) || null,
    }))
  }, [snapshot?.pool])

  const poolCount = snapshot?.pool.length ?? 0
  const readyLabel = snapshot ? `${snapshot.start.readyCount}/2` : '0/2'
  const phaseLabel = !snapshot
    ? '—'
    : isMapFlow
    ? mapStage === 'countdown'
      ? 'Transição para veto'
      : mapStage === 'dice'
      ? 'Dados do veto'
      : mapStage === 'veto'
      ? 'Vetos de mapas'
      : 'Mapa definido'
    : phaseText(snapshot?.fase)
  const phaseBadge = !snapshot
    ? '—'
    : isMapFlow
    ? mapStage === 'countdown'
      ? 'pré-veto'
      : mapStage === 'dice'
      ? 'dados do veto'
      : mapStage === 'veto'
      ? 'vetos ativos'
      : 'mapa final'
    : phaseText(snapshot.fase)
  const phaseDescription = !snapshot
    ? 'Crie uma sessão e defina os capitães para iniciar.'
    : isMapFlow
    ? mapStage === 'countdown'
      ? `Vetos iniciam em ${snapshot?.mapDraft?.countdownSeconds ?? 0}s.`
      : mapStage === 'dice'
      ? 'Capitães lançam os dados para definir quem veta primeiro.'
      : mapStage === 'veto'
      ? 'Capitães alternam vetos até restar apenas um mapa.'
      : `Mapa definido: ${mapLabel(snapshot?.mapDraft?.selectedMap)}.`
    : snapshot.fase === 'aguardando_capitaes'
    ? 'Aguardando dois capitães entrarem na sessão.'
    : snapshot.fase === 'aguardando_inicio'
    ? 'Capitães definidos. Ambos devem iniciar para liberar os dados.'
    : snapshot.fase === 'countdown'
    ? `Contagem regressiva ativa: ${snapshot.start.countdownSeconds}s para iniciar.`
    : snapshot.fase === 'dice'
    ? 'Capitães lançam os dados para definir a ordem dos picks.'
    : snapshot.fase === 'draft'
    ? 'Capitães escolhem alternadamente até fechar os dois times.'
    : 'Times completos e prontos para jogar.'
  const pickPhaseTitle = snapshot?.fase === 'dice' ? 'FASE DE DADOS' : 'FASE DE PICKS ESTRATÉGICOS'
  const pickPhaseDescription =
    snapshot?.fase === 'draft'
      ? 'Capitães se alternam nas escolhas até completar os dois times.'
      : snapshot?.fase === 'dice'
      ? 'Lance os dados para definir quem faz a primeira escolha.'
      : snapshot?.fase === 'countdown'
      ? `Partida iniciando em ${snapshot.start.countdownSeconds}s.`
      : snapshot?.fase === 'aguardando_inicio'
      ? 'Aguardando os capitães confirmarem o início da rodada.'
      : snapshot?.fase === 'aguardando_capitaes'
      ? 'É necessário 8 jogadores e 2 capitães para iniciar o processo de definição dos times.'
      : snapshot?.fase === 'finalizado'
      ? 'Escolhas concluídas.'
      : 'Acompanhe a definição dos times.'

  const orderedMapCards = useMemo(() => {
    const maps = snapshot?.mapDraft?.maps || []
    const orderIndex = new Map(MAP_CANONICAL_ORDER.map((name, index) => [name, index]))

    return [...maps].sort((a, b) => {
      const ai = orderIndex.get(String(a.mapa || '').toLowerCase())
      const bi = orderIndex.get(String(b.mapa || '').toLowerCase())
      if (ai != null && bi != null) return ai - bi
      if (ai != null) return -1
      if (bi != null) return 1
      return String(a.mapa || '').localeCompare(String(b.mapa || ''))
    })
  }, [snapshot?.mapDraft?.maps])

  const teamCaptainName = (team: Team) =>
    String(snapshot?.teams?.[team]?.captain?.nome || '')
      .trim()

  const teamDisplayName = (team: Team) => {
    const cap = teamCaptainName(team)
    return cap ? `Time ${cap}` : `Time ${team}`
  }

  const teamKeyFromValue = (value?: string | null): Team | null =>
    value === 'A' || value === 'B' ? value : null

  const teamDisplayFromKey = (value?: string | null) => {
    const key = teamKeyFromValue(value)
    return key ? teamDisplayName(key) : `Time ${value || '?'}`
  }
  const captainNameFromKey = (value?: string | null) => {
    const key = teamKeyFromValue(value)
    if (!key) return null
    const captain = snapshot?.teams?.[key]?.captain || null
    return playerNameWithLevel(captain, `Time ${key}`)
  }

  const aggregateForTeam = useCallback(
    (team: Team): TeamAggregateStats => {
      const captain = snapshot?.teams?.[team]?.captain || null
      const picks = snapshot?.teams?.[team]?.picks || []
      const players = [captain, ...picks].filter(Boolean) as MixPlayer[]
      const playersCount = players.length
      if (!playersCount) {
        return {
          playersCount: 0,
          avgAdr: 0,
          avgKda: 0,
          avgWinRate: 0,
        }
      }

      const sumAdr = players.reduce((acc, p) => acc + toNumber(p.adr), 0)
      const sumKda = players.reduce((acc, p) => acc + toNumber(p.kda_player), 0)
      const sumWr = players.reduce((acc, p) => {
        const matches = toNumber(p.qtd_partidas)
        const wins = toNumber(p.vitorias)
        if (matches <= 0) return acc
        return acc + (wins / matches) * 100
      }, 0)

      return {
        playersCount,
        avgAdr: sumAdr / playersCount,
        avgKda: sumKda / playersCount,
        avgWinRate: sumWr / playersCount,
      }
    },
    [snapshot?.teams]
  )

  const teamAggregate = useMemo(
    () => ({
      A: aggregateForTeam('A'),
      B: aggregateForTeam('B'),
    }),
    [aggregateForTeam]
  )

  const aggregateScale = useMemo(() => {
    const maxAdr = Math.max(70, teamAggregate.A.avgAdr, teamAggregate.B.avgAdr)
    const maxKda = Math.max(1.2, teamAggregate.A.avgKda, teamAggregate.B.avgKda)
    return { maxAdr, maxKda }
  }, [teamAggregate])

  const topMapsByTeam = useMemo(() => {
    const buildTopMaps = (team: Team): TeamTopMapStat[] => {
      const mapCards = snapshot?.mapDraft?.maps || []
      const teamPlayerCount =
        (snapshot?.teams?.[team]?.captain ? 1 : 0) + (snapshot?.teams?.[team]?.picks?.length || 0)
      const totalPlayers = Math.max(1, teamPlayerCount)

      return mapCards
        .map((mapCard) => {
          const rows = mapCard.stats?.[team] || []
          const validRows = rows.filter((r) => toNumber(r.partidas) > 0)
          const playersWithData = validRows.length
          const totalPartidas = validRows.reduce((acc, r) => acc + toNumber(r.partidas), 0)
          const totalVitorias = validRows.reduce((acc, r) => acc + toNumber(r.vitorias), 0)
          const combinedWinRate = totalPartidas > 0 ? (totalVitorias / totalPartidas) * 100 : 0
          const avgIndividualWinRate =
            playersWithData > 0
              ? validRows.reduce((acc, r) => acc + toNumber(r.winRate), 0) / playersWithData
              : 0

          return {
            mapa: mapCard.mapa,
            playersWithData,
            totalPlayers,
            totalPartidas,
            totalVitorias,
            combinedWinRate,
            avgIndividualWinRate,
          }
        })
        .filter((m) => m.playersWithData > 0)
        .sort((a, b) => {
          if (b.playersWithData !== a.playersWithData) return b.playersWithData - a.playersWithData
          if (b.totalPartidas !== a.totalPartidas) return b.totalPartidas - a.totalPartidas
          if (b.totalVitorias !== a.totalVitorias) return b.totalVitorias - a.totalVitorias
          if (b.avgIndividualWinRate !== a.avgIndividualWinRate) return b.avgIndividualWinRate - a.avgIndividualWinRate
          return b.combinedWinRate - a.combinedWinRate
        })
        .slice(0, 3)
        .sort((a, b) => {
          if (b.combinedWinRate !== a.combinedWinRate) return b.combinedWinRate - a.combinedWinRate
          if (b.avgIndividualWinRate !== a.avgIndividualWinRate) return b.avgIndividualWinRate - a.avgIndividualWinRate
          return b.totalPartidas - a.totalPartidas
        })
    }

    return {
      A: buildTopMaps('A'),
      B: buildTopMaps('B'),
    }
  }, [
    snapshot?.mapDraft?.maps,
    snapshot?.teams?.A?.captain,
    snapshot?.teams?.A?.picks,
    snapshot?.teams?.B?.captain,
    snapshot?.teams?.B?.picks,
  ])

  const mapProjectionCard = useMemo(() => {
    if (!mapProjectionKey) return null
    return snapshot?.mapDraft?.maps?.find((m) => m.mapa === mapProjectionKey) || null
  }, [mapProjectionKey, snapshot?.mapDraft?.maps])

  const closeMapProjection = useCallback(() => {
    setMapProjectionKey(null)
    setMapStatsOpen({})
  }, [])

  if (!isLogged) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
          color: 'rgba(255,255,255,0.36)',
          fontFamily: "'Rajdhani',sans-serif",
        }}
      >
        Faça login para usar o sistema de tirar time.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <style>{`
        .tmx-grid {
          display: grid;
          grid-template-columns: minmax(280px, 0.95fr) minmax(620px, 1.7fr) minmax(280px, 0.95fr);
          gap: 14px;
          align-items: stretch;
        }
        .tmx-side-panel {
          min-height: 620px;
          backdrop-filter: blur(6px);
          box-shadow: inset 0 0 28px rgba(7,12,30,0.44);
        }
        .tmx-side-panel.is-red {
          background: linear-gradient(180deg, rgba(255,107,130,0.2), rgba(9,14,35,0.86) 28%, rgba(9,14,35,0.985)) !important;
          border-color: rgba(255,107,130,0.4) !important;
        }
        .tmx-side-panel.is-blue {
          background: linear-gradient(180deg, rgba(94,183,255,0.2), rgba(9,14,35,0.86) 28%, rgba(9,14,35,0.985)) !important;
          border-color: rgba(94,183,255,0.4) !important;
        }
        .tmx-center-panel {
          background: radial-gradient(circle at 50% 0%, rgba(255,255,255,0.08), transparent 32%), linear-gradient(180deg, rgba(255,255,255,0.06), rgba(9,14,35,0.94) 20%, rgba(9,14,35,0.995)) !important;
          border-color: rgba(139,92,246,0.26) !important;
          box-shadow: inset 0 0 34px rgba(7,12,30,0.48);
        }
        .tmx-chip {
          border-radius: 14px;
          padding: 10px 12px;
          display: flex;
          gap: 12px;
          align-items: center;
          overflow: hidden;
        }
        .tmx-stat-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 7px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.22);
          background: rgba(0,0,0,0.24);
          line-height: 1;
        }
        .tmx-stat-chip b {
          color: #fff;
          font-size: 1.02em;
          letter-spacing: .5px;
        }
        .tmx-action-btn {
          min-height: 38px;
          padding: 0 14px !important;
          font-size: 13px !important;
          letter-spacing: .5px;
          border-radius: 10px !important;
        }
        .tmx-action-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: brightness(1.08);
        }
        .tmx-team-title {
          border-radius: 14px;
          padding: 12px 14px;
          border: 1px solid rgba(255,255,255,0.14);
          background: linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02));
        }
        .tmx-team-title.is-red {
          border-color: rgba(255,107,130,0.52);
          box-shadow: inset 0 0 22px rgba(255,107,130,0.1), 0 0 12px rgba(255,107,130,0.16);
        }
        .tmx-team-title.is-blue {
          border-color: rgba(94,183,255,0.52);
          box-shadow: inset 0 0 22px rgba(94,183,255,0.1), 0 0 12px rgba(94,183,255,0.16);
        }
        .tmx-team-title-kicker {
          font-family: 'Rajdhani', sans-serif;
          font-size: 10px;
          letter-spacing: 1.8px;
          color: rgba(255,255,255,0.52);
          margin-bottom: 3px;
          font-weight: 700;
        }
        .tmx-team-title-main {
          font-family: 'Orbitron', monospace;
          font-size: 23px;
          letter-spacing: .9px;
          line-height: 1.1;
          font-weight: 800;
          color: #fff;
          margin-bottom: 4px;
          text-transform: none;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .tmx-team-title-sub {
          font-family: 'Rajdhani', sans-serif;
          font-size: 11px;
          letter-spacing: .7px;
          color: rgba(255,255,255,0.58);
          font-weight: 700;
        }
        .tmx-team-title.is-red .tmx-team-title-main {
          text-shadow: 0 0 18px rgba(255,107,130,0.35);
        }
        .tmx-team-title.is-blue .tmx-team-title-main {
          text-shadow: 0 0 18px rgba(94,183,255,0.35);
        }
        .tmx-team-column {
          min-height: 100%;
          display: flex;
          flex-direction: column;
        }
        .tmx-agg-card {
          margin-top: 12px;
          border-radius: 13px;
          border: 1px solid rgba(255,255,255,0.14);
          background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
          padding: 11px 12px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-height: 180px;
        }
        .tmx-topmaps-card {
          margin-top: 10px;
          border-radius: 13px;
          border: 1px solid rgba(255,255,255,0.18);
          background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02));
          padding: 11px 12px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
          min-height: 132px;
        }
        .tmx-topmaps-sub {
          color: rgba(255,255,255,0.88);
          font-family: 'Rajdhani', sans-serif;
          font-size: 13px;
          line-height: 1.28;
          font-weight: 700;
        }
        .tmx-topmaps-empty {
          color: rgba(255,255,255,0.82);
          font-family: 'Rajdhani', sans-serif;
          font-size: 13px;
          line-height: 1.3;
          font-weight: 700;
        }
        .tmx-topmap-row {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .tmx-topmap-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          color: #fff;
          font-family: 'Rajdhani', sans-serif;
          font-size: 13.5px;
          font-weight: 800;
          letter-spacing: .35px;
        }
        .tmx-topmap-head b {
          font-family: 'Orbitron', monospace;
          font-size: 13px;
          letter-spacing: .4px;
          color: #fff;
        }
        .tmx-topmap-rank {
          color: rgba(255,255,255,0.84);
          font-size: 12px;
          font-weight: 900;
          margin-right: 3px;
        }
        .tmx-agg-fill.is-topmap {
          background: #22d3ee;
        }
        .tmx-topmap-meta {
          color: rgba(255,255,255,0.82);
          font-family: 'Rajdhani', sans-serif;
          font-size: 12px;
          line-height: 1.28;
          font-weight: 700;
        }
        .tmx-agg-sub {
          color: rgba(255,255,255,0.7);
          font-family: 'Rajdhani', sans-serif;
          font-size: 13px;
          line-height: 1.28;
          font-weight: 600;
        }
        .tmx-agg-divider {
          border-top: 1px solid rgba(255,255,255,0.12);
          margin: 2px 0 1px;
        }
        .tmx-agg-row {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .tmx-agg-row-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          color: #fff;
          font-family: 'Rajdhani', sans-serif;
          font-size: 13px;
          font-weight: 700;
        }
        .tmx-agg-row-head b {
          font-family: 'Orbitron', monospace;
          font-size: 13px;
          letter-spacing: .5px;
        }
        .tmx-agg-bar {
          height: 5px;
          border-radius: 999px;
          background: rgba(255,255,255,0.16);
          overflow: hidden;
        }
        .tmx-agg-fill {
          height: 100%;
          border-radius: inherit;
          transition: width .25s ease;
        }
        .tmx-agg-fill.is-adr {
          background: #8b7dff;
        }
        .tmx-agg-fill.is-kda {
          background: #34d399;
        }
        .tmx-agg-fill.is-wr {
          background: #f59e0b;
        }
        .tmx-agg-foot {
          margin-top: auto;
          color: rgba(255,255,255,0.55);
          font-family: 'Rajdhani', sans-serif;
          font-size: 12px;
          letter-spacing: .4px;
          font-weight: 700;
        }
        .tmx-avatar {
          flex-shrink: 0;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid rgba(255,255,255,0.2);
          background: rgba(255,255,255,0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Orbitron', monospace;
          color: #fff;
          font-size: 12px;
          font-weight: 700;
        }
        .tmx-avatar-empty {
          width: 34px;
          height: 34px;
          border: 2px dashed rgba(255,255,255,0.18);
          background: transparent;
        }
        .tmx-pool {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }
        .tmx-slot-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }
        .tmx-slot-card {
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.12);
          background: linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01));
          padding: 10px;
          min-height: 152px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .tmx-slot-empty {
          border: 1px dashed rgba(255,255,255,0.2);
          background: rgba(255,255,255,0.015);
        }
        .tmx-slot-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
        }
        .tmx-slot-index {
          color: rgba(255,255,255,0.8);
          font-family: 'Orbitron', monospace;
          font-size: 11px;
          letter-spacing: .8px;
          font-weight: 700;
        }
        .tmx-slot-status {
          color: rgba(255,255,255,0.55);
          font-family: 'Rajdhani', sans-serif;
          font-size: 11px;
          letter-spacing: .6px;
          font-weight: 700;
        }
        .tmx-slot-meta {
          margin-top: auto;
          color: rgba(255,255,255,0.7);
          font-family: 'Rajdhani', sans-serif;
          font-size: 12px;
          font-weight: 700;
          line-height: 1.25;
        }
        .tmx-slot-join-btn {
          margin-top: auto;
          border: 1px solid rgba(34,211,238,0.45);
          background: rgba(34,211,238,0.12);
          color: #8be9ff;
          border-radius: 8px;
          height: 34px;
          font-family: 'Rajdhani', sans-serif;
          font-size: 13px;
          letter-spacing: .4px;
          font-weight: 800;
          cursor: pointer;
          transition: all .2s ease;
        }
        .tmx-slot-join-btn:hover:not(:disabled) {
          border-color: rgba(34,211,238,0.8);
          background: rgba(34,211,238,0.2);
          color: #d8fbff;
        }
        .tmx-slot-join-btn:disabled {
          opacity: .45;
          cursor: not-allowed;
        }
        .tmx-pool-card {
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.1);
          background: linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01));
          padding: 14px 12px;
          color: #fff;
          transition: transform .2s ease, border-color .2s ease, filter .2s ease, opacity .2s ease;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          text-align: center;
          min-height: 172px;
        }
        .tmx-pool-card:hover {
          transform: translateY(-2px);
          border-color: rgba(192,132,252,0.48);
        }
        .tmx-pool-card.is-locked {
          cursor: not-allowed;
          opacity: .55;
          filter: grayscale(.4);
          transform: none;
        }
        .tmx-pool-card.is-picked {
          animation: pickSoul .72s cubic-bezier(.2,.8,.2,1) forwards;
        }
        @keyframes pickSoul {
          0% { opacity: 1; transform: translateY(0) scale(1); filter: saturate(1) grayscale(0); }
          40% { opacity: 1; transform: translateY(-8px) scale(1.03); filter: saturate(1.15) grayscale(0); }
          100% { opacity: 0; transform: translateY(-22px) scale(.88); filter: saturate(0) grayscale(1); }
        }
        .tmx-dice-row {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .tmx-die-value {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          color: rgba(255,255,255,0.78);
          font-size: 12px;
          font-family: 'Orbitron', monospace;
          font-weight: 700;
          letter-spacing: .2px;
        }
        .tmx-die-stage {
          width: 58px;
          height: 58px;
          perspective: 760px;
          position: relative;
        }
        .tmx-die-cube {
          width: 58px;
          height: 58px;
          position: relative;
          transform-style: preserve-3d;
          transition: transform 1s;
        }
        .tmx-die-cube.is-empty {
          opacity: .36;
          filter: saturate(.4);
        }
        .tmx-die-cube.is-rolling {
          filter: drop-shadow(0 0 8px rgba(255,255,255,0.28));
        }
        .tmx-die-cube.is-rolling .tmx-die-face {
          animation: tmxDiceFaceFlicker .12s linear infinite;
        }
        @keyframes tmxDiceFaceFlicker {
          0% { filter: brightness(.95); }
          50% { filter: brightness(1.06); }
          100% { filter: brightness(.92); }
        }
        .tmx-die-face {
          position: absolute;
          background: linear-gradient(145deg, rgba(255,255,255,.98), rgba(233,242,255,.94));
          border-radius: 8px;
          width: 58px;
          height: 58px;
          border: 1px solid rgba(255,255,255,.7);
          box-shadow: inset -6px 5px 12px rgba(10,17,40,.24), inset 3px -3px 6px rgba(255,255,255,.65);
          backface-visibility: hidden;
        }
        .tmx-die-face.one { transform: translateZ(29px); }
        .tmx-die-face.two { transform: rotateX(90deg) translateZ(29px); }
        .tmx-die-face.three { transform: rotateY(90deg) translateZ(29px); }
        .tmx-die-face.four { transform: rotateY(-90deg) translateZ(29px); }
        .tmx-die-face.five { transform: rotateX(-90deg) translateZ(29px); }
        .tmx-die-face.six { transform: rotateY(180deg) translateZ(29px); }

        .tmx-die-cube.show-1 { transform: rotateX(0deg) rotateY(0deg); }
        .tmx-die-cube.show-2 { transform: rotateX(-90deg) rotateY(0deg); }
        .tmx-die-cube.show-3 { transform: rotateX(0deg) rotateY(-90deg); }
        .tmx-die-cube.show-4 { transform: rotateX(0deg) rotateY(90deg); }
        .tmx-die-cube.show-5 { transform: rotateX(90deg) rotateY(0deg); }
        .tmx-die-cube.show-6 { transform: rotateX(180deg) rotateY(0deg); }

        .tmx-die-dot {
          position: absolute;
          width: 11px;
          height: 11px;
          margin: -5px 3px 3px -5px;
          border-radius: 50%;
          background: var(--tmx-die-accent, #f25f5c);
          box-shadow: inset 2px 2px 3px rgba(0,0,0,.35);
        }
        .two-1, .three-1, .four-1, .five-1, .six-1 { top: 20%; left: 20%; }
        .four-3, .five-3, .six-4 { top: 20%; left: 80%; }
        .one-1, .three-2, .five-5 { top: 50%; left: 50%; }
        .four-2, .five-2, .six-3 { top: 80%; left: 20%; }
        .two-2, .three-3, .four-4, .five-4, .six-6 { top: 80%; left: 80%; }
        .six-2 { top: 50%; left: 20%; }
        .six-5 { top: 50%; left: 80%; }

        .tmx-box-spaced {
          padding: 12px 14px !important;
        }
        .tmx-dice-area-shell {
          box-shadow: none !important;
        }
        .tmx-dice-captains-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px !important;
        }
        .tmx-dice-captain-card {
          min-height: 142px;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          gap: 8px;
        }
        .tmx-dice-captain-card .tmx-die-stage {
          width: 64px;
          height: 64px;
        }
        .tmx-dice-captain-card .tmx-die-cube {
          width: 64px;
          height: 64px;
        }
        .tmx-dice-captain-card .tmx-die-face {
          width: 64px;
          height: 64px;
        }
        .tmx-dice-captain-card .tmx-die-face.one { transform: translateZ(32px); }
        .tmx-dice-captain-card .tmx-die-face.two { transform: rotateX(90deg) translateZ(32px); }
        .tmx-dice-captain-card .tmx-die-face.three { transform: rotateY(90deg) translateZ(32px); }
        .tmx-dice-captain-card .tmx-die-face.four { transform: rotateY(-90deg) translateZ(32px); }
        .tmx-dice-captain-card .tmx-die-face.five { transform: rotateX(-90deg) translateZ(32px); }
        .tmx-dice-captain-card .tmx-die-face.six { transform: rotateY(180deg) translateZ(32px); }
        .tmx-dice-captain-card .tmx-die-dot {
          width: 12px;
          height: 12px;
          margin: -6px 3px 3px -6px;
        }
        .tmx-dice-captain-card .tmx-die-value {
          color: rgba(255,255,255,0.9);
          font-size: 14px;
          min-width: 24px;
        }
        .tmx-dice-captain-card .tmx-dice-row {
          gap: 12px;
        }
        .tmx-caption {
          color: rgba(255,255,255,0.64);
          font-size: 12px;
          font-family: 'Rajdhani', sans-serif;
          letter-spacing: .7px;
          line-height: 1.35;
        }
        .tmx-map-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          align-items: stretch;
        }
        .tmx-map-card {
          border-radius: 13px;
          border: 1px solid rgba(255,255,255,.16);
          background: linear-gradient(170deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
          padding: 10px 10px 13px;
          display: flex;
          flex-direction: column;
          gap: 9px;
          transition: transform .2s ease, border-color .2s ease, filter .2s ease;
          cursor: pointer;
          min-height: 206px;
        }
        .tmx-map-card:hover {
          transform: none;
          border-color: rgba(192,132,252,.45);
        }
        .tmx-map-card.is-disabled {
          cursor: default;
        }
        .tmx-map-card.is-banned {
          filter: grayscale(1) saturate(.35);
          opacity: .68;
        }
        .tmx-map-card.is-selected {
          border-color: rgba(192,132,252,.86);
          box-shadow: 0 0 0 1px rgba(192,132,252,.48), 0 0 22px rgba(192,132,252,.32);
          background: linear-gradient(170deg, rgba(192,132,252,.16), rgba(129,140,248,.08));
        }
        .tmx-map-topline {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          min-height: 26px;
        }
        .tmx-map-stats-btn {
          border: 1px solid rgba(255,255,255,.22);
          background: rgba(255,255,255,.05);
          color: #fff;
          border-radius: 7px;
          padding: 4px 10px;
          font-size: 11px;
          font-family: 'Rajdhani', sans-serif;
          letter-spacing: 0.8px;
          font-weight: 800;
          cursor: pointer;
          line-height: 1;
        }
        .tmx-map-stats-btn:hover {
          filter: brightness(1.08);
        }
        .tmx-map-media {
          position: relative;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,.14);
          overflow: hidden;
          height: 150px;
          background: linear-gradient(180deg, rgba(7,11,24,.7), rgba(7,11,24,.96));
        }
        .tmx-map-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: opacity .45s ease, filter .45s ease, transform .45s ease;
          display: block;
        }
        .tmx-map-media.is-stats .tmx-map-img {
          opacity: .17;
          filter: grayscale(.5) blur(1.6px);
          transform: scale(1.03);
        }
        .tmx-map-door {
          position: absolute;
          top: 0;
          width: 50%;
          height: 100%;
          transition: transform .52s cubic-bezier(.2,.7,.2,1), opacity .52s ease;
          opacity: 0;
          pointer-events: none;
        }
        .tmx-map-door.left {
          left: 0;
          background: linear-gradient(90deg, rgba(255,107,130,.8), rgba(255,107,130,.32));
          transform: translateX(-102%);
        }
        .tmx-map-door.right {
          right: 0;
          background: linear-gradient(270deg, rgba(94,183,255,.8), rgba(94,183,255,.32));
          transform: translateX(102%);
        }
        .tmx-map-media.is-stats .tmx-map-door {
          opacity: .88;
          transform: translateX(0);
        }
        .tmx-map-stats-panel {
          position: absolute;
          inset: 0;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          padding: 10px;
          opacity: 0;
          transition: opacity .32s ease .2s;
          pointer-events: none;
        }
        .tmx-map-media.is-stats .tmx-map-stats-panel {
          opacity: 1;
        }
        .tmx-map-stat-col {
          overflow-y: auto;
          overflow-x: hidden;
          display: flex;
          flex-direction: column;
          gap: 6px;
          justify-content: center;
        }
        .tmx-map-stat-row {
          font-family: 'Rajdhani', sans-serif;
          font-size: 11.5px;
          line-height: 1.2;
          color: rgba(255,255,255,.95);
          white-space: normal;
          overflow-wrap: anywhere;
        }
        .tmx-map-stat-row.left b {
          color: #ff9fb1;
        }
        .tmx-map-stat-row.right {
          text-align: right;
        }
        .tmx-map-stat-row.right b {
          color: #8dd3ff;
        }
        .tmx-proj-overlay {
          position: fixed;
          inset: 0;
          z-index: 85;
          background: rgba(2,6,18,0.72);
          backdrop-filter: blur(7px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .tmx-proj-modal {
          position: relative;
          width: min(980px, 100%);
          max-height: min(88vh, 760px);
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.2);
          background: linear-gradient(180deg, rgba(9,15,36,0.96), rgba(8,12,28,0.98));
          box-shadow: 0 24px 80px rgba(0,0,0,.45), inset 0 0 24px rgba(255,255,255,.04);
          overflow: hidden;
          isolation: isolate;
        }
        .tmx-proj-door {
          position: absolute;
          top: 0;
          width: 50%;
          height: 100%;
          pointer-events: none;
          z-index: 3;
          opacity: .88;
          animation-duration: .62s;
          animation-timing-function: cubic-bezier(.2,.7,.2,1);
          animation-fill-mode: forwards;
        }
        .tmx-proj-door.left {
          left: 0;
          background: linear-gradient(90deg, rgba(255,107,130,.82), rgba(255,107,130,.34));
          animation-name: tmxProjDoorLeft;
        }
        .tmx-proj-door.right {
          right: 0;
          background: linear-gradient(270deg, rgba(94,183,255,.82), rgba(94,183,255,.34));
          animation-name: tmxProjDoorRight;
        }
        @keyframes tmxProjDoorLeft {
          from { transform: translateX(0); opacity: .9; }
          to { transform: translateX(-104%); opacity: 0; }
        }
        @keyframes tmxProjDoorRight {
          from { transform: translateX(0); opacity: .9; }
          to { transform: translateX(104%); opacity: 0; }
        }
        .tmx-proj-head {
          position: relative;
          z-index: 2;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 14px 16px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.03);
        }
        .tmx-proj-kicker {
          color: rgba(255,255,255,0.62);
          font-family: 'Rajdhani', sans-serif;
          font-size: 11px;
          letter-spacing: 1.6px;
          font-weight: 800;
          margin-bottom: 2px;
        }
        .tmx-proj-title {
          color: #fff;
          font-family: 'Orbitron', monospace;
          font-size: 24px;
          font-weight: 900;
          letter-spacing: .8px;
          line-height: 1.1;
          text-transform: lowercase;
        }
        .tmx-proj-close {
          border: 1px solid rgba(255,255,255,.24);
          background: rgba(255,255,255,.08);
          color: #fff;
          border-radius: 10px;
          padding: 7px 12px;
          font-family: 'Rajdhani', sans-serif;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: .6px;
          cursor: pointer;
        }
        .tmx-proj-close:hover {
          filter: brightness(1.08);
        }
        .tmx-proj-grid {
          position: relative;
          z-index: 1;
          padding: 14px 16px 16px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          opacity: 0;
          transform: translateY(8px) scale(.985);
          animation: tmxProjContent .36s ease .18s forwards;
          overflow: auto;
          max-height: calc(min(88vh, 760px) - 86px);
        }
        @keyframes tmxProjContent {
          from { opacity: 0; transform: translateY(8px) scale(.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .tmx-proj-team {
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,.16);
          background: rgba(255,255,255,.03);
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .tmx-proj-team.is-red {
          border-color: rgba(255,107,130,.44);
          background: linear-gradient(180deg, rgba(255,107,130,.12), rgba(9,14,35,.55));
        }
        .tmx-proj-team.is-blue {
          border-color: rgba(94,183,255,.44);
          background: linear-gradient(180deg, rgba(94,183,255,.12), rgba(9,14,35,.55));
        }
        .tmx-proj-team-title {
          color: #fff;
          font-family: 'Orbitron', monospace;
          font-size: 16px;
          font-weight: 800;
          letter-spacing: .6px;
          margin-bottom: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .tmx-proj-player {
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,.16);
          background: rgba(255,255,255,.05);
          padding: 8px 10px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .tmx-proj-player.is-empty {
          opacity: .7;
          border-style: dashed;
        }
        .tmx-proj-player-name {
          color: #fff;
          font-family: 'Rajdhani', sans-serif;
          font-size: 13px;
          font-weight: 800;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .tmx-proj-player-stats {
          color: rgba(255,255,255,.9);
          font-family: 'Rajdhani', sans-serif;
          font-size: 12px;
          font-weight: 700;
          line-height: 1.25;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .tmx-proj-player-stats b {
          color: #fff;
          font-family: 'Orbitron', monospace;
          font-size: 12px;
        }
        .tmx-map-ban-x {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          color: rgba(255,92,92,.95);
          font-size: 62px;
          font-family: 'Orbitron', monospace;
          font-weight: 900;
          text-shadow: 0 0 16px rgba(255,72,72,.45);
          pointer-events: none;
        }
        .tmx-map-meta {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 0;
          text-align: center;
        }
        .tmx-map-name {
          color: #fff;
          font-family: 'Orbitron', monospace;
          font-weight: 800;
          font-size: 16px;
          letter-spacing: .7px;
          line-height: 1.15;
          text-transform: lowercase;
        }
        .tmx-map-tag {
          color: rgba(255,255,255,.78);
          font-family: 'Rajdhani', sans-serif;
          font-size: 12px;
          font-weight: 700;
        }
        .tmx-map-dice-card .tmx-die-stage {
          width: 74px;
          height: 74px;
        }
        .tmx-map-dice-card .tmx-die-cube {
          width: 74px;
          height: 74px;
        }
        .tmx-map-dice-card .tmx-die-face {
          width: 74px;
          height: 74px;
          border-radius: 10px;
        }
        .tmx-map-dice-card .tmx-die-face.one { transform: translateZ(37px); }
        .tmx-map-dice-card .tmx-die-face.two { transform: rotateX(90deg) translateZ(37px); }
        .tmx-map-dice-card .tmx-die-face.three { transform: rotateY(90deg) translateZ(37px); }
        .tmx-map-dice-card .tmx-die-face.four { transform: rotateY(-90deg) translateZ(37px); }
        .tmx-map-dice-card .tmx-die-face.five { transform: rotateX(-90deg) translateZ(37px); }
        .tmx-map-dice-card .tmx-die-face.six { transform: rotateY(180deg) translateZ(37px); }
        .tmx-map-dice-card .tmx-die-dot {
          width: 13px;
          height: 13px;
          margin: -6px 3px 3px -6px;
        }
        .tmx-map-dice-card .tmx-die-value {
          font-size: 15px;
          min-width: 22px;
        }
        .tmx-map-dice-card .tmx-dice-row {
          gap: 14px;
        }
        @media (max-width: 1520px) {
          .tmx-map-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (max-width: 1280px) {
          .tmx-map-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 1200px) {
          .tmx-grid {
            grid-template-columns: 1fr;
          }
          .tmx-side-panel {
            min-height: 0;
          }
          .tmx-map-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .tmx-pool {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
          .tmx-slot-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (max-width: 980px) {
          .tmx-dice-captains-grid {
            grid-template-columns: 1fr;
          }
          .tmx-pool {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .tmx-slot-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .tmx-proj-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 760px) {
          .tmx-map-grid {
            grid-template-columns: 1fr;
          }
          .tmx-map-name {
            font-size: 20px;
          }
          .tmx-pool-card {
            min-height: 154px;
          }
          .tmx-proj-overlay {
            padding: 10px;
          }
          .tmx-proj-head {
            padding: 12px 12px 10px;
          }
          .tmx-proj-title {
            font-size: 19px;
          }
          .tmx-proj-grid {
            padding: 10px 12px 12px;
          }
        }
        @media (max-width: 520px) {
          .tmx-pool {
            grid-template-columns: 1fr;
          }
          .tmx-slot-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div
        style={{
          borderRadius: 18,
          border: '1px solid rgba(94,183,255,0.22)',
          background:
            'linear-gradient(135deg,rgba(94,183,255,0.08) 0%, rgba(255,107,130,0.08) 55%, rgba(192,132,252,0.08) 100%)',
          padding: '18px 20px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px)',
            backgroundSize: '34px 34px',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
            position: 'relative',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                letterSpacing: 2.5,
                color: 'rgba(255,255,255,0.55)',
                fontFamily: "'Rajdhani',sans-serif",
                fontWeight: 700,
                marginBottom: 6,
              }}
            >
              SISTEMA DE PICKS PARA TIME · 5x5
            </div>
            <h1
              style={{
                margin: 0,
                color: '#fff',
                fontFamily: "'Orbitron',monospace",
                fontWeight: 900,
                letterSpacing: 1.5,
                fontSize: 'clamp(20px,2.8vw,28px)',
              }}
            >
              PICK <span style={{ color: '#c084fc' }}>MIX</span>
            </h1>
            <div
              style={{
                color: 'rgba(255,255,255,0.72)',
                fontSize: 14,
                marginTop: 5,
                fontFamily: "'Rajdhani',sans-serif",
                fontWeight: 700,
                letterSpacing: 0.4,
              }}
            >
              Somente online podem participar
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {isAdmin && (
              <Btn
                color='#c084fc'
                variant='outline'
                size='lg'
                className='tmx-action-btn'
                disabled={!canCreateSession || loading || !!busy}
                onClick={() =>
                  runAction(
                    'new-session',
                    () => api.mixSessaoNova(),
                    'Nova sessão criada. Estado da sessão resetado.'
                  )
                }
              >
                {busy === 'new-session' ? 'RESETANDO...' : 'Nova sessão'}
              </Btn>
            )}
            <Btn
              color='#f5c842'
              variant='outline'
              size='lg'
              className='tmx-action-btn'
              disabled={!canLeave || !!busy}
              onClick={() => runAction('leave', () => api.mixSair(), 'Você saiu da sessão.')}
            >
              {busy === 'leave' ? 'SAINDO...' : 'Sair da sessão'}
            </Btn>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
          gap: 10,
        }}
      >
        <Card title='Fase' style={{ padding: '16px 18px' }}>
          <div
            style={{
              fontSize: 24,
              color: '#fff',
              fontFamily: "'Rajdhani',sans-serif",
              fontWeight: 800,
              lineHeight: 1.25,
              padding: '4px 2px 0',
            }}
          >
            {phaseLabel}
          </div>
          <div
            style={{
              color: 'rgba(255,255,255,0.82)',
              fontFamily: "'Rajdhani',sans-serif",
              fontSize: 14,
              lineHeight: 1.35,
              marginTop: 6,
              padding: '0 2px 2px',
            }}
          >
            {phaseDescription}
          </div>
        </Card>
        <Card title='Iniciar' style={{ padding: '16px 18px' }}>
          {isMapFlow ? (
            <div
              style={{
                color: '#22d3ee',
                fontFamily: "'Orbitron',monospace",
                fontSize: 24,
                padding: '6px 2px',
              }}
            >
              {mapStage === 'countdown'
                ? `${snapshot?.mapDraft?.countdownSeconds ?? 0}s`
                : mapStage === 'veto'
                ? `${snapshot?.mapDraft?.maps.filter((m) => m.banido).length ?? 0}/${snapshot?.mapDraft?.maps.length ?? 0}`
                : mapStage === 'dice'
                ? 'DADOS'
                : 'OK'}
            </div>
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '6px 4px 6px 2px',
                }}
              >
                <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 24, color: '#22d3ee' }}>
                  {readyLabel}
                </div>
                <Btn
                  color='#c084fc'
                  size='lg'
                  className='tmx-action-btn'
                  disabled={!canStart || !!busy}
                  onClick={() =>
                    runAction('start', () => api.mixIniciar(snapshot?.id), 'Start confirmado.')
                  }
                >
                  {busy === 'start' ? 'PENDENTE...' : 'Iniciar'}
                </Btn>
              </div>
              {snapshot?.fase === 'countdown' && (
                <div
                  style={{
                    marginTop: 8,
                    color: '#f5c842',
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: "'Rajdhani',sans-serif",
                  }}
                >
                  Começa em {snapshot.start.countdownSeconds}s
                </div>
              )}
            </>
          )}
        </Card>
        <Card title='Vez Atual' style={{ padding: '16px 18px' }}>
          <div style={{ color: '#fff', fontFamily: "'Orbitron',monospace", fontSize: 20, padding: '4px 2px 2px' }}>
            {isMapFlow
              ? mapStage === 'dice'
                ? snapshot?.mapDraft?.dice.turn
                  ? `Dado: ${captainNameFromKey(snapshot.mapDraft.dice.turn)}`
                  : 'Aguardando'
                : mapStage === 'veto'
                ? snapshot?.mapDraft?.veto.turn
                  ? `Veto: ${teamDisplayFromKey(snapshot.mapDraft.veto.turn)}`
                  : 'Aguardando'
                : mapStage === 'done'
                ? mapLabel(snapshot?.mapDraft?.selectedMap)
                : 'Pré-veto'
              : snapshot?.fase === 'dice'
              ? snapshot.dice.turn
                ? `Dado: ${captainNameFromKey(snapshot.dice.turn)}`
                : 'Aguardando'
              : snapshot?.fase === 'draft'
              ? snapshot.draft.pickTurn
                ? `Pick: ${teamDisplayFromKey(snapshot.draft.pickTurn)}`
                : 'Aguardando'
              : '—'}
          </div>
        </Card>
        <Card title='Timer de Pick' style={{ padding: '16px 18px' }}>
          <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 24, color: '#f87171', padding: '4px 2px 2px' }}>
            {isMapFlow
              ? mapStage === 'veto'
                ? `${snapshot?.mapDraft?.vetoSecondsLeft ?? 0}s`
                : mapStage === 'countdown'
                ? `${snapshot?.mapDraft?.countdownSeconds ?? 0}s`
                : '—'
              : snapshot?.fase === 'draft'
              ? `${snapshot.draft.pickSecondsLeft}s`
              : '—'}
          </div>
        </Card>
      </div>

      {loading ? (
        <div
          style={{
            textAlign: 'center',
            color: 'rgba(255,255,255,0.36)',
            fontFamily: "'Rajdhani',sans-serif",
            padding: 36,
          }}
        >
          Carregando sessão de tirar time...
        </div>
      ) : (
        <div className='tmx-grid'>
          <Card
            className='tmx-side-panel is-red'
            style={{
              border: `1px solid ${TEAM_META.A.border}`,
              padding: '14px 14px 16px',
            }}
          >
            <div className='tmx-team-column'>
              <TeamHeader team='A' captainName={snapshot?.teams.A.captain?.nome} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                {snapshot?.teams.A.captain ? (
                  <PlayerChip
                    player={snapshot.teams.A.captain}
                    team='A'
                    captain
                    action={
                      canShowCaptainLeave('A') ? (
                        <Btn
                          color='#f59e0b'
                          variant='outline'
                          size='lg'
                          className={CAPTAIN_SLOT_BTN_CLASS}
                          disabled={!!busy}
                          onClick={() =>
                            runAction('leave-cap-A', () => api.mixSair(), 'Você saiu da sessão.')
                          }
                        >
                          {busy === 'leave-cap-A' ? 'SAINDO...' : 'Sair'}
                        </Btn>
                      ) : null
                    }
                  />
                ) : (
                  <EmptySlot
                    team='A'
                    label='Aguardando capitão'
                    action={
                      canShowCaptainEnter('A') ? (
                        <Btn
                          color={TEAM_META.A.color}
                          variant='outline'
                          size='lg'
                          className={CAPTAIN_SLOT_BTN_CLASS}
                          disabled={loading || !!busy}
                          onClick={() =>
                            runAction(
                              'join-cap-A',
                              () => api.mixEntrar('capitao', null, 'A'),
                              'Você entrou como capitão do Time A.'
                            )
                          }
                        >
                          {busy === 'join-cap-A' ? 'ENTRANDO...' : 'Entrar'}
                        </Btn>
                      ) : null
                    }
                  />
                )}
                {Array.from({ length: 4 }, (_, idx) => snapshot?.teams.A.picks[idx] || null).map(
                  (p, idx) =>
                    p ? (
                      <PlayerChip key={`A-${p.jogador_id}`} player={p} team='A' compact />
                    ) : (
                      <EmptySlot key={`A-empty-${idx}`} team='A' label={`Jogador ${idx + 2}`} />
                    )
                )}
              </div>
              <TeamAggregateCard
                team='A'
                stats={teamAggregate.A}
                maxAdr={aggregateScale.maxAdr}
                maxKda={aggregateScale.maxKda}
              />
              <TeamTopMapsCard team='A' maps={topMapsByTeam.A} />
            </div>
          </Card>

          <Card
            className='tmx-center-panel'
            title={isMapFlow ? 'Vetos dos mapas' : 'Seleção de jogadores'}
            badge={phaseBadge}
            badgeColor='#c084fc'
            style={{ minHeight: isMapFlow ? 0 : 470, padding: '14px 16px 18px' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {isMapFlow ? (
                <>
                  <div style={{ textAlign: 'center', padding: '2px 8px 4px' }}>
                    <div
                      style={{
                        color: 'rgba(255,255,255,0.68)',
                        fontFamily: "'Rajdhani',sans-serif",
                        letterSpacing: 1.4,
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      READY · VETO DE MAPAS · JOGAR
                    </div>
                    <div
                      style={{
                        color: 'rgba(255,255,255,0.44)',
                        fontFamily: "'Rajdhani',sans-serif",
                        fontSize: 12,
                        marginTop: 2,
                      }}
                    >
                      Aguarde enquanto os capitães vetam os mapas
                    </div>
                  </div>

                  <div
                    className='tmx-box-spaced tmx-dice-area-shell'
                    style={{
                      borderRadius: 12,
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                    }}
                  >
                    <div
                      className='tmx-dice-captains-grid'
                      style={{
                        display: 'grid',
                        gap: 10,
                        alignItems: 'center',
                      }}
                    >
                      {(['A', 'B'] as Team[]).map((team) => {
                        const data = team === 'A' ? snapshot?.mapDraft?.dice.a : snapshot?.mapDraft?.dice.b
                        const visual = team === 'A' ? diceDisplay.A : diceDisplay.B
                        const captain = snapshot?.teams[team].captain
                        const isTurn = snapshot?.mapDraft?.stage === 'dice' && snapshot.mapDraft.dice.turn === team
                        return (
                          <div
                            key={`map-dice-${team}`}
                            className='tmx-map-dice-card tmx-dice-captain-card'
                            style={{
                              borderRadius: 10,
                              border: `1px solid ${TEAM_META[team].border}`,
                              background: TEAM_META[team].soft,
                              padding: 12,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 2,
                              }}
                            >
                              <div
                                style={{
                                  color: TEAM_META[team].color,
                                  fontSize: 13,
                                  fontFamily: "'Rajdhani',sans-serif",
                                  fontWeight: 700,
                                  letterSpacing: 0.7,
                                  maxWidth: '74%',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {teamDisplayName(team)}
                              </div>
                              <div
                                style={{
                                  color: 'rgba(255,255,255,0.45)',
                                  fontSize: 11,
                                  fontFamily: "'Rajdhani',sans-serif",
                                  maxWidth: '45%',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {playerNameWithLevel(captain, 'Sem capitão')}
                              </div>
                            </div>
                            <div className='tmx-dice-row'>
                              <Die3D
                                value={visual.d1}
                                rolling={rollingTeam === team}
                                color={TEAM_META[team].color}
                              />
                              <span className='tmx-die-value'>{visual.d1 ?? '-'}</span>
                              <Die3D
                                value={visual.d2}
                                rolling={rollingTeam === team}
                                color={TEAM_META[team].color}
                              />
                              <span className='tmx-die-value'>{visual.d2 ?? '-'}</span>
                              <div
                                style={{
                                  marginLeft: 'auto',
                                  fontFamily: "'Orbitron',monospace",
                                  fontSize: 34,
                                  color: TEAM_META[team].color,
                                  fontWeight: 700,
                                  minWidth: 60,
                                  textAlign: 'right',
                                }}
                              >
                                {rollingTeam === team ? '…' : data?.total ?? '—'}
                              </div>
                            </div>
                            {canRoll && myTeam === team && (
                              <div style={{ marginTop: 8 }}>
                                <Btn
                                  color={TEAM_META[team].color}
                                  size='lg'
                                  className='tmx-action-btn'
                                  disabled={!!busy}
                                  onClick={() => rollWithAnimation(team)}
                                >
                                  {busy === 'roll' ? 'Rolando...' : 'Lançar dados'}
                                </Btn>
                              </div>
                            )}
                            {isTurn && !canRoll && (
                              <div
                                style={{
                                  marginTop: 7,
                                  color: '#f5c842',
                                  fontSize: 11,
                                  fontFamily: "'Rajdhani',sans-serif",
                                  fontWeight: 700,
                                }}
                              >
                                Vez de {playerNameWithLevel(captain, `Time ${team}`)}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      flexWrap: 'wrap',
                      color: 'rgba(255,255,255,0.56)',
                      fontSize: 13,
                      fontFamily: "'Rajdhani',sans-serif",
                      padding: '6px 4px 2px 4px',
                    }}
                  >
                    <span>
                      {orderedMapCards.filter((m) => !m.banido).length} mapas restantes
                    </span>
                    {mapStage === 'countdown' && (
                      <span style={{ color: '#f5c842' }}>
                        Vetos iniciam em <b>{snapshot?.mapDraft?.countdownSeconds ?? 0}s</b>
                      </span>
                    )}
                    {mapStage === 'veto' && snapshot?.mapDraft?.veto.turn && (
                      <span style={{ color: '#fff' }}>
                        Vez de{' '}
                        <b style={{ color: TEAM_META[snapshot.mapDraft.veto.turn].color }}>
                          {teamDisplayName(snapshot.mapDraft.veto.turn)}
                        </b>{' '}
                        · {snapshot.mapDraft.vetoSecondsLeft}s
                      </span>
                    )}
                  </div>

                  <div className='tmx-map-grid'>
                    {orderedMapCards.map((m) => {
                      const statsOpen = !!mapStatsOpen[m.mapa]
                      const locked = mapStage !== 'veto' || !canBanMap || m.banido || m.selected
                      const mapKey = String(m.mapa || '').toLowerCase()
                      const candidates = mapImageCandidates(m)
                      const tryIndex = mapImageTry[mapKey] || 0
                      const imgSrc = candidates[Math.min(tryIndex, Math.max(0, candidates.length - 1))]
                      return (
                        <div
                          key={`map-${m.id}`}
                          className={`tmx-map-card ${m.banido ? 'is-banned' : ''} ${
                            m.selected ? 'is-selected' : ''
                          } ${locked ? 'is-disabled' : ''}`}
                          onClick={() => {
                            if (locked) return
                            runAction(
                              `ban-${m.mapa}`,
                              () => api.mixBanMapa(m.mapa, snapshot?.id),
                              `${mapLabel(m.mapa)} vetado.`
                            )
                          }}
                        >
                          <div className='tmx-map-topline'>
                            <span className='tmx-map-tag'>
                              {m.banido
                                ? `Vetado · ${teamDisplayFromKey(m.banidoPorTeam)}`
                                : m.selected
                                ? 'Mapa escolhido'
                                : `Disponível ${mapStage === 'veto' ? '· clique para vetar' : ''}`}
                            </span>
                            <button
                              type='button'
                              className='tmx-map-stats-btn'
                              onClick={(e) => {
                                e.stopPropagation()
                                const willOpen = !statsOpen
                                setMapStatsOpen(willOpen ? { [m.mapa]: true } : {})
                                setMapProjectionKey(willOpen ? m.mapa : null)
                              }}
                            >
                              Stats
                            </button>
                          </div>

                          <div className={`tmx-map-media ${statsOpen ? 'is-stats' : ''}`}>
                            <img
                              src={imgSrc}
                              alt={m.mapa}
                              className='tmx-map-img'
                              onError={() => {
                                if (!candidates.length) return
                                setMapImageTry((prev) => {
                                  const current = prev[mapKey] || 0
                                  if (current >= candidates.length - 1) return prev
                                  return { ...prev, [mapKey]: current + 1 }
                                })
                              }}
                            />
                            <div className='tmx-map-door left' />
                            <div className='tmx-map-door right' />
                            <div className='tmx-map-stats-panel'>
                              <div className='tmx-map-stat-col'>
                                {(m.stats.A || []).map((p) => (
                                  <div key={`sa-${m.mapa}-${p.jogador_id}`} className='tmx-map-stat-row left'>
                                    <b>{p.nome}</b> partidas: {p.partidas}, vitórias: {p.vitorias}, win{' '}
                                    {p.winRate.toFixed(1)}%
                                  </div>
                                ))}
                              </div>
                              <div className='tmx-map-stat-col'>
                                {(m.stats.B || []).map((p) => (
                                  <div key={`sb-${m.mapa}-${p.jogador_id}`} className='tmx-map-stat-row right'>
                                    {p.winRate.toFixed(1)}% win, vitórias: {p.vitorias}, partidas:{' '}
                                    {p.partidas} <b>{p.nome}</b>
                                  </div>
                                ))}
                              </div>
                            </div>
                            {m.banido && <div className='tmx-map-ban-x'>×</div>}
                          </div>

                          <div className='tmx-map-meta'>
                            <div className='tmx-map-name'>{mapLabel(m.mapa)}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {mapStage === 'done' && snapshot?.mapDraft?.selectedMap && (
                    <div
                      style={{
                        borderRadius: 12,
                        border: '1px solid rgba(192,132,252,.5)',
                        background: 'linear-gradient(135deg, rgba(192,132,252,.16), rgba(94,183,255,.12))',
                        color: '#f5e9ff',
                        fontFamily: "'Rajdhani',sans-serif",
                        fontWeight: 700,
                        fontSize: 16,
                        lineHeight: 1.35,
                        padding: '14px 18px',
                      }}
                    >
                      O mapa escolhido do mix foi: <b>{mapLabel(snapshot.mapDraft.selectedMap)}</b>. Bom jogo!
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ textAlign: 'center', padding: '2px 8px 4px' }}>
                    <div
                      style={{
                        color: 'rgba(255,255,255,0.9)',
                        fontFamily: "'Rajdhani',sans-serif",
                        letterSpacing: 1.5,
                        fontSize: 14,
                        fontWeight: 800,
                      }}
                    >
                      {pickPhaseTitle}
                    </div>
                    <div
                      style={{
                        color: 'rgba(255,255,255,0.76)',
                        fontFamily: "'Rajdhani',sans-serif",
                        fontSize: 14,
                        marginTop: 3,
                        fontWeight: 600,
                      }}
                    >
                      {pickPhaseDescription}
                    </div>
                  </div>

                  <div
                    className='tmx-box-spaced tmx-dice-area-shell'
                    style={{
                      borderRadius: 12,
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                    }}
                  >
                    <div
                      className='tmx-dice-captains-grid'
                      style={{
                        display: 'grid',
                        gap: 10,
                        alignItems: 'center',
                      }}
                    >
                      {(['A', 'B'] as Team[]).map((team) => {
                        const data = team === 'A' ? snapshot?.dice.a : snapshot?.dice.b
                        const visual = team === 'A' ? diceDisplay.A : diceDisplay.B
                        const captain = snapshot?.teams[team].captain
                        const isTurn = snapshot?.fase === 'dice' && snapshot.dice.turn === team
                        return (
                          <div
                            key={`dice-${team}`}
                            className='tmx-dice-captain-card'
                            style={{
                              borderRadius: 10,
                              border: `1px solid ${TEAM_META[team].border}`,
                              background: TEAM_META[team].soft,
                              padding: 12,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 2,
                              }}
                            >
                              <div
                                style={{
                                  color: TEAM_META[team].color,
                                  fontSize: 13,
                                  fontFamily: "'Rajdhani',sans-serif",
                                  fontWeight: 700,
                                  letterSpacing: 0.7,
                                  maxWidth: '74%',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {teamDisplayName(team)}
                              </div>
                              <div
                                style={{
                                  color: 'rgba(255,255,255,0.45)',
                                  fontSize: 11,
                                  fontFamily: "'Rajdhani',sans-serif",
                                  maxWidth: '45%',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {playerNameWithLevel(captain, 'Sem capitão')}
                              </div>
                            </div>
                            <div className='tmx-dice-row'>
                              <Die3D
                                value={visual.d1}
                                rolling={rollingTeam === team}
                                color={TEAM_META[team].color}
                              />
                              <span className='tmx-die-value'>{visual.d1 ?? '-'}</span>
                              <Die3D
                                value={visual.d2}
                                rolling={rollingTeam === team}
                                color={TEAM_META[team].color}
                              />
                              <span className='tmx-die-value'>{visual.d2 ?? '-'}</span>
                              <div
                                style={{
                                  marginLeft: 'auto',
                                  fontFamily: "'Orbitron',monospace",
                                  fontSize: 24,
                                  color: TEAM_META[team].color,
                                  fontWeight: 700,
                                  minWidth: 48,
                                  textAlign: 'right',
                                }}
                              >
                                {rollingTeam === team ? '…' : data?.total ?? '—'}
                              </div>
                            </div>
                            {canRoll && myTeam === team && (
                              <div style={{ marginTop: 8 }}>
                                <Btn
                                  color={TEAM_META[team].color}
                                  size='lg'
                                  className='tmx-action-btn'
                                  disabled={!!busy}
                                  onClick={() => rollWithAnimation(team)}
                                >
                                  {busy === 'roll' ? 'Rolando...' : 'Lançar dados'}
                                </Btn>
                              </div>
                            )}
                            {isTurn && !canRoll && (
                              <div
                                style={{
                                  marginTop: 7,
                                  color: '#f5c842',
                                  fontSize: 11,
                                  fontFamily: "'Rajdhani',sans-serif",
                                  fontWeight: 700,
                                }}
                              >
                                Vez de {playerNameWithLevel(captain, `Time ${team}`)}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      flexWrap: 'wrap',
                      color: 'rgba(255,255,255,0.48)',
                      fontSize: 13,
                      fontFamily: "'Rajdhani',sans-serif",
                      padding: '6px 4px 2px 4px',
                    }}
                  >
                    <span>{poolCount} jogadores no centro</span>
                    {snapshot?.fase === 'draft' && snapshot.draft.pickTurn && (
                      <span style={{ color: '#fff' }}>
                        Vez de{' '}
                        <b style={{ color: TEAM_META[snapshot.draft.pickTurn].color }}>
                          {teamDisplayName(snapshot.draft.pickTurn)}
                        </b>{' '}
                        · {snapshot.draft.pickSecondsLeft}s
                      </span>
                    )}
                  </div>

                  <div className='tmx-slot-grid'>
                    {poolSlots.map(({ slot, player }) => {
                      const level = normalizeLevel((player as any)?.level)
                      const levelColor = levelAccentColor(level)
                      const isPicking = !!player && busy === `pick-${player.jogador_id}`
                      const pickLocked = !player || !canPick || isPicking
                      const isAnim = !!player && pickAnimId === player.jogador_id
                      const canJoinThisSlot = canEnterPlayer && !player

                      return (
                        <div
                          key={`pool-slot-${slot}`}
                          className={`tmx-slot-card ${player ? '' : 'tmx-slot-empty'} ${
                            isAnim ? 'is-picked' : ''
                          }`}
                        >
                          <div className='tmx-slot-head'>
                            <span className='tmx-slot-status'>{player ? 'OCUPADO' : 'LIVRE'}</span>
                          </div>

                          {player ? (
                            <button
                              disabled={pickLocked}
                              className={`tmx-pool-card ${pickLocked ? 'is-locked' : ''} ${
                                isAnim ? 'is-picked' : ''
                              }`}
                              style={{ minHeight: 0, height: '100%', padding: '10px 8px' }}
                              onClick={() =>
                                runAction(
                                  `pick-${player.jogador_id}`,
                                  () => api.mixPick(player.jogador_id, snapshot?.id),
                                  `${player.nome} foi selecionado.`
                                )
                              }
                            >
                              {avatarSrc(player) ? (
                                <img
                                  src={avatarSrc(player)}
                                  alt={player.nome}
                                  className='tmx-avatar'
                                  style={{ width: 56, height: 56 }}
                                  onError={(e) => {
                                    ;(e.target as HTMLImageElement).style.display = 'none'
                                  }}
                                />
                              ) : (
                                <div
                                  className='tmx-avatar'
                                  style={{
                                    width: 56,
                                    height: 56,
                                    background: 'linear-gradient(135deg,#818cf8,#c084fc)',
                                  }}
                                >
                                  {initials(player.nome)}
                                </div>
                              )}
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  maxWidth: '100%',
                                  minWidth: 0,
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 14,
                                    fontWeight: 800,
                                    fontFamily: "'Rajdhani',sans-serif",
                                    color: '#fff',
                                    maxWidth: '100%',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    minWidth: 0,
                                  }}
                                >
                                  {player.nome}
                                </span>
                                <span
                                  style={{
                                    color: levelColor,
                                    border: `1px solid ${levelColor}88`,
                                    background: `${levelColor}1a`,
                                    boxShadow: `0 0 10px ${levelColor}22 inset`,
                                    borderRadius: 6,
                                    fontSize: 10,
                                    fontWeight: 800,
                                    fontFamily: "'Orbitron',monospace",
                                    letterSpacing: 0.5,
                                    padding: '1px 6px',
                                    flexShrink: 0,
                                    lineHeight: 1.25,
                                  }}
                                >
                                  LV {level}
                                </span>
                              </div>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: '#fff',
                                  fontFamily: "'Rajdhani',sans-serif",
                                  letterSpacing: 0.4,
                                  fontWeight: 700,
                                }}
                              >
                                K/D/A {formatKda(player.kda_player)} · ADR {toNumber(player.adr).toFixed(1)}
                              </div>
                            </button>
                          ) : (
                            <>
                              <div
                                className='tmx-avatar'
                                style={{
                                  width: 56,
                                  height: 56,
                                  margin: '2px auto 0',
                                  borderStyle: 'dashed',
                                  borderColor: 'rgba(255,255,255,0.28)',
                                  background: 'transparent',
                                  color: 'rgba(255,255,255,0.4)',
                                }}
                              >
                                +
                              </div>
                              <div className='tmx-slot-meta'>Aguardando jogador neste slot.</div>
                              <button
                                type='button'
                                className='tmx-slot-join-btn'
                                disabled={!canJoinThisSlot || !!busy}
                                onClick={() =>
                                  runAction(
                                    `join-player-${slot}`,
                                    () => api.mixEntrar('jogador', slot),
                                  )
                                }
                              >
                                {busy === `join-player-${slot}` ? 'ENTRANDO...' : 'Entrar como jogador'}
                              </button>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {snapshot?.fase === 'finalizado' && (
                    <div
                      style={{
                        borderRadius: 12,
                        border: '1px solid rgba(74,222,128,0.35)',
                        background: 'rgba(74,222,128,0.09)',
                        color: '#4ade80',
                        fontFamily: "'Rajdhani',sans-serif",
                        fontWeight: 700,
                        fontSize: 16,
                        lineHeight: 1.35,
                        padding: '14px 18px',
                      }}
                    >
                      Times definidos, bom jogo a todos!
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>

          <Card
            className='tmx-side-panel is-blue'
            style={{
              border: `1px solid ${TEAM_META.B.border}`,
              padding: '14px 14px 16px',
            }}
          >
            <div className='tmx-team-column'>
              <TeamHeader team='B' captainName={snapshot?.teams.B.captain?.nome} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                {snapshot?.teams.B.captain ? (
                  <PlayerChip
                    player={snapshot.teams.B.captain}
                    team='B'
                    captain
                    action={
                      canShowCaptainLeave('B') ? (
                        <Btn
                          color='#f59e0b'
                          variant='outline'
                          size='lg'
                          className={CAPTAIN_SLOT_BTN_CLASS}
                          disabled={!!busy}
                          onClick={() =>
                            runAction('leave-cap-B', () => api.mixSair(), 'Você saiu da sessão.')
                          }
                        >
                          {busy === 'leave-cap-B' ? 'SAINDO...' : 'Sair'}
                        </Btn>
                      ) : null
                    }
                  />
                ) : (
                  <EmptySlot
                    team='B'
                    label='Aguardando capitão'
                    action={
                      canShowCaptainEnter('B') ? (
                        <Btn
                          color={TEAM_META.B.color}
                          variant='outline'
                          size='lg'
                          className={CAPTAIN_SLOT_BTN_CLASS}
                          disabled={loading || !!busy}
                          onClick={() =>
                            runAction(
                              'join-cap-B',
                              () => api.mixEntrar('capitao', null, 'B'),
                              'Você entrou como capitão do Time B.'
                            )
                          }
                        >
                          {busy === 'join-cap-B' ? 'ENTRANDO...' : 'Entrar'}
                        </Btn>
                      ) : null
                    }
                  />
                )}
                {Array.from({ length: 4 }, (_, idx) => snapshot?.teams.B.picks[idx] || null).map(
                  (p, idx) =>
                    p ? (
                      <PlayerChip key={`B-${p.jogador_id}`} player={p} team='B' compact />
                    ) : (
                      <EmptySlot key={`B-empty-${idx}`} team='B' label={`Jogador ${idx + 2}`} />
                    )
                )}
              </div>
              <TeamAggregateCard
                team='B'
                stats={teamAggregate.B}
                maxAdr={aggregateScale.maxAdr}
                maxKda={aggregateScale.maxKda}
              />
              <TeamTopMapsCard team='B' maps={topMapsByTeam.B} />
            </div>
          </Card>
        </div>
      )}

      <Card title='Jogadores Online' titleStyle={{ paddingLeft: 5, marginTop: 2 }}>
        
        {(snapshot?.online || []).length === 0 ? (
          <div
            style={{
              color: 'rgba(255,255,255,0.34)',
              fontFamily: "'Rajdhani',sans-serif",
              fontSize: 13,
            }}
          >
            Nenhum jogador online no momento.
          </div>
        ) : (
          <div style={{ maxHeight: 325, overflowY: 'auto', padding: '0 5px' }}>
            {(snapshot?.online || []).map((p) => {
              const level = normalizeLevel((p as any)?.level)
              const levelColor = levelAccentColor(level)
              const avatar = avatarSrc(p as any)
              return (
                <div
                  key={`online-${p.id}-${p.usuario_id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 10px',
                    borderRadius: 0,
                    marginBottom: 4,
                    background: 'transparent',
                    borderBottom: '1px solid rgba(255,255,255,.05)',
                  }}
                >
                  {avatar ? (
                    <img
                      src={avatar}
                      alt={p.nome}
                      className='tmx-avatar'
                      style={{ width: 32, height: 32 }}
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  ) : (
                    <div
                      className='tmx-avatar'
                      style={{
                        width: 32,
                        height: 32,
                        background: 'linear-gradient(135deg,#22d3ee,#818cf8)',
                      }}
                    >
                      {initials(p.nome)}
                    </div>
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                      <div
                        style={{
                          color: '#fff',
                          fontFamily: "'Rajdhani',sans-serif",
                          fontWeight: 700,
                          fontSize: 13,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          minWidth: 0,
                        }}
                      >
                        {p.nome}
                      </div>
                      <span
                        style={{
                          color: levelColor,
                          border: `1px solid ${levelColor}88`,
                          background: `${levelColor}1a`,
                          boxShadow: `0 0 10px ${levelColor}22 inset`,
                          borderRadius: 6,
                          fontSize: 10,
                          fontWeight: 800,
                          fontFamily: "'Orbitron',monospace",
                          letterSpacing: 0.5,
                          padding: '1px 6px',
                          flexShrink: 0,
                          lineHeight: 1.25,
                        }}
                      >
                        LV {level}
                      </span>
                    </div>
                    <div
                      style={{
                        color: 'rgba(255,255,255,.32)',
                        fontFamily: "'Rajdhani',sans-serif",
                        fontSize: 10,
                        marginTop: 2,
                      }}
                    >
                      {onlineLastSeenLabel(p.last_seen)}
                    </div>
                  </div>
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: '#4ade80',
                      boxShadow: '0 0 5px #4ade80',
                      flexShrink: 0,
                    }}
                  />
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {mapProjectionCard && (
        <MapStatsProjection
          mapCard={mapProjectionCard}
          teamNames={{ A: teamDisplayName('A'), B: teamDisplayName('B') }}
          onClose={closeMapProjection}
        />
      )}

      {error && (
        <div
          style={{
            borderRadius: 10,
            border: '1px solid rgba(248,113,113,.35)',
            background: 'rgba(248,113,113,.1)',
            color: '#fda4af',
            padding: '10px 12px',
            fontFamily: "'Rajdhani',sans-serif",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {error}
        </div>
      )}

      {toast.msg && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            borderRadius: 10,
            border: `1px solid ${toast.type === 'ok' ? '#4ade80' : '#f87171'}`,
            background: toast.type === 'ok' ? 'rgba(74,222,128,.15)' : 'rgba(248,113,113,.15)',
            color: toast.type === 'ok' ? '#4ade80' : '#f87171',
            padding: '10px 16px',
            fontFamily: "'Rajdhani',sans-serif",
            fontWeight: 700,
            fontSize: 13,
            zIndex: 50,
            backdropFilter: 'blur(10px)',
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}
