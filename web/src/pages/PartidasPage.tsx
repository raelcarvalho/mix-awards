import { useEffect, useMemo, useState } from 'react'
import { Card, Btn } from '@/components/ui/Card'
import { useRef } from 'react'
import { LEVEL_COLOR_BY_ID } from '@/components/profile/PlayerProfilePreview'
import { useAuth } from '@/hooks/useAuth'
import * as api from '@/services/api'

interface PartidaRaw {
  id: number
  codigo?: number | string
  mapa?: string
  nome_time1?: string
  nome_time2?: string
  time_a?: string
  time_b?: string
  resultado_time1?: number | string
  resultado_time2?: number | string
  score_time_1?: number | string
  score_time_2?: number | string
  data?: string
  created_at?: string
}

interface Partida {
  id: number
  codigo: string
  mapa: string
  timeA: string
  timeB: string
  scoreA: number | null
  scoreB: number | null
  data: string
  ts: number
}

type SeasonDropdownOption = {
  value: string | number
  label: string
}

interface PartidaDetalhe {
  partida: {
    codigo?: number
    mapa?: string
    nome_time1?: string
    nome_time2?: string
    resultado_time1?: number
    resultado_time2?: number
    data?: string
    created_at?: string
  }
  jogadores: Array<{
    nome?: string
    jogadores_id?: string
    time?: string
    jogador_imagem?: string
    jogador_level?: number | string
    level?: number | string
    nivel?: number | string
    level_antes?: number | string
    level_depois?: number | string
    kills?: number | string
    assistencias?: number | string
    mortes?: number | string
    adr?: number | string
    kast?: number | string
    flash_assist?: number | string
    first_kill?: number | string
    multi_kill?: number | string
    kda_player?: number | string
    pontos?: number | string
    partida_ganha?: number | boolean
  }>
}

const DASHBOARD_OPEN_PARTIDA_CODE_KEY = 'dashboard_open_partida_codigo'

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(String(value).replace(',', '.').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

function readPlayerLevel(player: PartidaDetalhe['jogadores'][number]) {
  const row = player as any
  const raw =
    row?.level_depois ??
    row?.levelDepois ??
    row?.jogador_level ??
    row?.level ??
    row?.nivel ??
    row?.level_antes ??
    row?.levelAntes
  const n = toNumber(raw)
  return n === null ? 0 : Math.max(0, Math.trunc(n))
}

function levelAccentColor(level: number) {
  const lv = Math.max(0, Math.min(15, Math.round(level)))
  return LEVEL_COLOR_BY_ID[lv] || '#a78bfa'
}

function calculateTeamStrength(teamPlayers: PartidaDetalhe['jogadores']) {
  if (!Array.isArray(teamPlayers) || teamPlayers.length === 0) return 0

  return teamPlayers.reduce((acc, player) => {
    const level = Math.max(0, readPlayerLevel(player))
    // Base igual por jogador + ganho suavizado por level (log), para evitar distorção por outlier.
    const levelBoost = 0.28 * Math.log1p(level) + 0.015 * Math.sqrt(level)
    return acc + 1 + levelBoost
  }, 0)
}

function calculateWinProbabilityByLevels(
  teamAPlayers: PartidaDetalhe['jogadores'],
  teamBPlayers: PartidaDetalhe['jogadores']
) {
  const strengthA = calculateTeamStrength(teamAPlayers)
  const strengthB = calculateTeamStrength(teamBPlayers)
  const total = strengthA + strengthB

  if (total <= 0) return { probA: 50, probB: 50 }

  const rawA = (strengthA / total) * 100
  const probA = Number(Math.max(5, Math.min(95, rawA)).toFixed(2))
  const probB = Number((100 - probA).toFixed(2))
  return { probA, probB }
}

function normalizeMap(value?: string) {
  const raw = String(value || '').trim()
  if (!raw) return 'SEM MAPA'
  return raw.replace(/^de_/i, '').toUpperCase()
}

function normalizeDate(value?: string) {
  if (!value) return '-'
  const ts = new Date(value).getTime()
  if (!Number.isFinite(ts)) return '-'
  return new Date(ts).toLocaleDateString('pt-BR')
}

function normalizeDateTime(value?: string) {
  if (!value) return '-'
  const ts = new Date(value).getTime()
  if (!Number.isFinite(ts)) return '-'
  return new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function estimateDurationMinutes(scoreA: number | null, scoreB: number | null) {
  if (scoreA === null || scoreB === null) return null
  const rounds = Math.max(0, scoreA + scoreB)
  if (!rounds) return null
  return Math.max(20, Math.round(rounds * 1.9))
}

function normalizeTeamKey(value?: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\btime\b/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function selectTeamAvatar(teamName: string, players: PartidaDetalhe['jogadores']) {
  const key = normalizeTeamKey(teamName)
  const withImage = players.filter((p) => String(p.jogador_imagem || '').trim())
  if (!withImage.length) return undefined

  if (key) {
    const matched = withImage.find((p) => {
      const playerKey = normalizeTeamKey(String(p.nome || p.jogadores_id || ''))
      return !!playerKey && (playerKey === key || playerKey.includes(key) || key.includes(playerKey))
    })
    if (matched?.jogador_imagem) return matched.jogador_imagem
  }

  return withImage[0].jogador_imagem
}

function normalizePartida(raw: PartidaRaw): Partida {
  const scoreA = toNumber(raw.resultado_time1 ?? raw.score_time_1)
  const scoreB = toNumber(raw.resultado_time2 ?? raw.score_time_2)

  return {
    id: raw.id,
    codigo: String(raw.codigo ?? '-'),
    mapa: normalizeMap(raw.mapa),
    timeA: String(raw.nome_time1 || raw.time_a || 'Time A'),
    timeB: String(raw.nome_time2 || raw.time_b || 'Time B'),
    scoreA,
    scoreB,
    data: normalizeDate(raw.data || raw.created_at),
    ts: (() => {
      const t = new Date(raw.data || raw.created_at || '').getTime()
      return Number.isFinite(t) ? t : 0
    })(),
  }
}

function scoreColor(scoreA: number | null, scoreB: number | null) {
  if (scoreA === null || scoreB === null) return 'rgba(255,255,255,.55)'
  if (scoreA > scoreB) return '#4ade80'
  if (scoreA < scoreB) return '#f87171'
  return '#f5c842'
}

function pointsFromPartida(
  jogador: PartidaDetalhe['jogadores'][number],
  partida: PartidaDetalhe['partida']
) {
  const kills = toNumber(jogador.kills) ?? 0
  const fk = toNumber(jogador.first_kill) ?? 0
  const adr = toNumber(jogador.adr) ?? 0
  const scoreA = toNumber(partida.resultado_time1) ?? 0
  const scoreB = toNumber(partida.resultado_time2) ?? 0
  const vencedor = scoreA === scoreB ? null : scoreA > scoreB ? 'A' : 'B'

  let adrPts = 5
  if (adr > 100) adrPts = 20
  else if (adr >= 50) adrPts = 10

  const winPts = vencedor && String(jogador.time || '').toUpperCase() === vencedor ? 20 : 10
  return kills + fk + adrPts + winPts
}

function Toast({
  msg,
  ok,
}: {
  msg: string
  ok: boolean
}) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 32,
        left: '50%',
        transform: 'translateX(-50%)',
        background: ok ? 'rgba(74,222,128,.15)' : 'rgba(248,113,113,.15)',
        border: `1px solid ${ok ? '#4ade80' : '#f87171'}`,
        borderRadius: 10,
        padding: '12px 24px',
        color: ok ? '#4ade80' : '#f87171',
        fontFamily: "'Rajdhani',sans-serif",
        fontWeight: 700,
        fontSize: 14,
        zIndex: 200,
        backdropFilter: 'blur(12px)',
      }}
    >
      {msg}
    </div>
  )
}

function SeasonDropdown({
  value,
  options,
  onChange,
  width = 116,
  buttonHeight = 38,
  optionHeight = 36,
  selectedFontSize = 12,
  optionFontSize = 12,
  title,
}: {
  value: string | number
  options: SeasonDropdownOption[]
  onChange: (nextValue: string) => void
  width?: number
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
    <div ref={wrapperRef} style={{ position: 'relative', width }} title={title}>
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
            overflow: 'hidden',
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

function DetailModal({
  detalhe,
  loading,
  onClose,
}: {
  detalhe: PartidaDetalhe | null
  loading: boolean
  onClose: () => void
}) {
  const scoreA = toNumber(detalhe?.partida?.resultado_time1)
  const scoreB = toNumber(detalhe?.partida?.resultado_time2)
  const jogadores = Array.isArray(detalhe?.jogadores) ? detalhe.jogadores : []
  const timeAByField = jogadores.filter((j) => String(j.time || '').toUpperCase() === 'A')
  const timeBByField = jogadores.filter((j) => String(j.time || '').toUpperCase() === 'B')
  const timeA =
    timeAByField.length + timeBByField.length > 0
      ? timeAByField
      : jogadores.filter((j) => Number(j.partida_ganha || 0) > 0)
  const timeB =
    timeAByField.length + timeBByField.length > 0
      ? timeBByField
      : jogadores.filter((j) => Number(j.partida_ganha || 0) <= 0)
  const teamAName = String(detalhe?.partida?.nome_time1 || 'Time A')
  const teamBName = String(detalhe?.partida?.nome_time2 || 'Time B')
  const teamAAvatar = selectTeamAvatar(teamAName, timeA)
  const teamBAvatar = selectTeamAvatar(teamBName, timeB)
  const { probA, probB } = calculateWinProbabilityByLevels(timeA, timeB)
  const durationMin = estimateDurationMinutes(scoreA, scoreB)
  const matchStatus =
    scoreA !== null && scoreB !== null ? 'Finalizado' : scoreA !== null || scoreB !== null ? 'Em andamento' : '-'

  const playerPoints = (j: PartidaDetalhe['jogadores'][number]) => {
    const ptsRaw = toNumber(j.pontos)
    return ptsRaw === null ? pointsFromPartida(j, detalhe?.partida || {}) : ptsRaw
  }

  const renderTeamTable = (
    teamPlayers: PartidaDetalhe['jogadores'],
    accent: string
  ) => {
    const sortedPlayers = [...teamPlayers].sort(
      (a, b) => (playerPoints(b) ?? 0) - (playerPoints(a) ?? 0)
    )
    const cols = '26% 7% 7% 7% 7% 7% 11% 10% 10% 8%'
    const headerStyle = {
      fontSize: 10,
      color: 'rgba(235,245,255,.9)',
      letterSpacing: 0.6,
      fontFamily: "'Rajdhani',sans-serif",
      fontWeight: 800,
      textTransform: 'uppercase' as const,
      lineHeight: 1.2,
      textAlign: 'center' as const,
      padding: '0 2px',
      minWidth: 0,
    }

    return (
      <div style={{ width: '100%' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: cols,
            alignItems: 'center',
            padding: '6px 2px 8px',
            borderBottom: '1px solid rgba(255,255,255,.08)',
            marginBottom: 4,
          }}
        >
          {[
            'JOGADOR',
            'KILLS',
            'ASSIST',
            'DEATHS',
            'ADR',
            'KAST',
            'FLASH ASSIST',
            'FIRST KILL',
            'MULTI KILL',
            'PONTOS',
          ].map((h, idx) => (
            <span
              key={h}
              style={{
                ...headerStyle,
                textAlign: idx === 0 ? 'left' : 'center',
              }}
            >
              {h}
            </span>
          ))}
        </div>

        {teamPlayers.length === 0 ? (
          <div
            style={{
              padding: '12px 10px',
              borderRadius: 9,
              border: '1px dashed rgba(255,255,255,.16)',
              color: 'rgba(255,255,255,.45)',
              fontFamily: "'Rajdhani',sans-serif",
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            Sem jogadores neste time.
          </div>
        ) : (
          sortedPlayers.map((j, idx) => {
            const name = String(j.nome || j.jogadores_id || 'Jogador')
            const level = readPlayerLevel(j)
            const levelColor = levelAccentColor(level)
            const points = playerPoints(j)
            return (
              <div
                key={`${name}-${idx}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: cols,
                  alignItems: 'center',
                  padding: '8px 2px',
                  borderBottom: '1px solid rgba(255,255,255,.08)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    minWidth: 0,
                    paddingRight: 4,
                  }}
                >
                  {j.jogador_imagem ? (
                    <img
                      src={j.jogador_imagem}
                      alt={name}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: `1px solid ${accent}66`,
                        flexShrink: 0,
                      }}
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,.06)',
                        border: '1px solid rgba(255,255,255,.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
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
                        letterSpacing: 0.6,
                        padding: '1px 6px',
                        flexShrink: 0,
                        lineHeight: 1.25,
                      }}
                    >
                      LV {level}
                    </span>
                    <span
                      style={{
                        color: '#fff',
                        fontSize: 15,
                        fontWeight: 700,
                        fontFamily: "'Rajdhani',sans-serif",
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        minWidth: 0,
                      }}
                      title={name}
                    >
                      {name}
                    </span>
                  </div>
                </div>

                {[
                  toNumber(j.kills),
                  toNumber(j.assistencias),
                  toNumber(j.mortes),
                  toNumber(j.adr),
                  toNumber(j.kast),
                  toNumber(j.flash_assist),
                  toNumber(j.first_kill),
                  toNumber(j.multi_kill),
                  points,
                ].map((v, i) => (
                  <span
                    key={i}
                    style={{
                      color: i === 3 ? '#22d3ee' : 'rgba(255,255,255,.72)',
                      fontSize: 12,
                      fontFamily: "'Orbitron',monospace",
                      fontWeight: i === 3 ? 700 : 500,
                      textAlign: 'center',
                      minWidth: 0,
                    }}
                  >
                    {i === 4 ? `${v ?? 0}%` : v ?? '-'}
                  </span>
                ))}
              </div>
            )
          })
        )}
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,.78)',
          backdropFilter: 'blur(6px)',
        }}
      />
      <div
        style={{
          position: 'relative',
          width: 'min(98vw,1080px)',
          maxHeight: '88vh',
          background: '#11182a',
          border: '1px solid rgba(34,211,238,.24)',
          borderRadius: 10,
          boxShadow: '0 30px 80px rgba(0,0,0,.45)',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            maxHeight: '88vh',
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '24px 16px 20px 24px',
            boxSizing: 'border-box',
            scrollbarGutter: 'stable',
            borderRadius: 10,
          }}
        >
          {loading ? (
            <div
              style={{
                padding: 40,
                textAlign: 'center',
                color: 'rgba(255,255,255,.35)',
                fontFamily: "'Rajdhani',sans-serif",
              }}
            >
              Carregando detalhes da partida...
            </div>
          ) : !detalhe ? (
            <div
              style={{
                padding: 40,
                textAlign: 'center',
                color: 'rgba(255,255,255,.35)',
                fontFamily: "'Rajdhani',sans-serif",
              }}
            >
              Não foi possível carregar os detalhes.
            </div>
          ) : (
            <>
            <div
              style={{
                marginBottom: 18,
                border: '1px solid rgba(255,255,255,.08)',
                borderRadius: 14,
                overflow: 'hidden',
                background: 'rgba(255,255,255,.02)',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  padding: '16px 16px 14px',
                  borderBottom: '1px solid rgba(255,255,255,.08)',
                  background:
                    'linear-gradient(135deg, rgba(34,211,238,.12) 0%, rgba(111,66,193,.08) 45%, rgba(34,197,94,.08) 100%)',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage:
                      'linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px)',
                    backgroundSize: '30px 30px',
                    pointerEvents: 'none',
                  }}
                />
                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    flexWrap: 'wrap',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      flex: '1 1 260px',
                      minWidth: 220,
                    }}
                  >
                    <div
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: '1px solid rgba(34,211,238,.42)',
                        background: 'rgba(0,0,0,.24)',
                        flexShrink: 0,
                      }}
                    >
                      {teamAAvatar ? (
                        <img
                          src={teamAAvatar}
                          alt={teamAName}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontSize: 18,
                            fontFamily: "'Orbitron',monospace",
                            fontWeight: 700,
                          }}
                        >
                          {teamAName.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 10,
                          letterSpacing: 1.4,
                          color: 'rgba(255,255,255,.72)',
                          fontFamily: "'Rajdhani',sans-serif",
                          fontWeight: 700,
                        }}
                      >
                        TIME A
                      </div>
                      <div
                        style={{
                          fontFamily: "'Rajdhani',sans-serif",
                          fontSize: 34,
                          color: '#fff',
                          fontWeight: 800,
                          lineHeight: 1,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        <span style={{ color: '#22d3ee', marginRight: 8 }}>{scoreA ?? '-'}</span>
                        {teamAName}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      fontFamily: "'Orbitron',monospace",
                      fontSize: 20,
                      color: 'rgba(255,255,255,.92)',
                      letterSpacing: 1.2,
                      fontWeight: 700,
                      padding: '0 4px',
                    }}
                  >
                    VS
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: 10,
                      flex: '1 1 260px',
                      minWidth: 220,
                    }}
                  >
                    <div style={{ minWidth: 0, textAlign: 'right' }}>
                      <div
                        style={{
                          fontSize: 10,
                          letterSpacing: 1.4,
                          color: 'rgba(255,255,255,.72)',
                          fontFamily: "'Rajdhani',sans-serif",
                          fontWeight: 700,
                        }}
                      >
                        TIME B
                      </div>
                      <div
                        style={{
                          fontFamily: "'Rajdhani',sans-serif",
                          fontSize: 34,
                          color: '#fff',
                          fontWeight: 800,
                          lineHeight: 1,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        <span style={{ color: '#4ade80', marginRight: 8 }}>{scoreB ?? '-'}</span>
                        {teamBName}
                      </div>
                    </div>
                    <div
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: '1px solid rgba(74,222,128,.42)',
                        background: 'rgba(0,0,0,.24)',
                        flexShrink: 0,
                      }}
                    >
                      {teamBAvatar ? (
                        <img
                          src={teamBAvatar}
                          alt={teamBName}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontSize: 18,
                            fontFamily: "'Orbitron',monospace",
                            fontWeight: 700,
                          }}
                        >
                          {teamBName.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={onClose}
                    aria-label="Fechar detalhes da partida"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      border: '1px solid rgba(167,139,250,.42)',
                      background:
                        'linear-gradient(135deg, rgba(26,36,60,.95) 0%, rgba(15,24,43,.95) 100%)',
                      color: 'rgba(241,245,249,.92)',
                      fontSize: 24,
                      fontWeight: 700,
                      lineHeight: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow:
                        '0 10px 24px rgba(0,0,0,.35), inset 0 0 0 1px rgba(34,211,238,.16)',
                      flexShrink: 0,
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>

              <div
                style={{
                  padding: '12px 14px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))',
                  gap: 10,
                }}
              >
                {[
                  { label: 'DATA', value: normalizeDateTime(detalhe.partida.data || detalhe.partida.created_at) },
                  { label: 'DURAÇÃO', value: durationMin ? `${durationMin} minutos` : '-' },
                  { label: 'ID DA PARTIDA', value: detalhe.partida.codigo ? String(detalhe.partida.codigo) : '-' },
                  { label: 'MAPA', value: String(detalhe.partida.mapa || '-') },
                  { label: 'TIPO', value: 'Competitivo' },
                  { label: 'STATUS', value: matchStatus },
                  {
                    label: 'PARTIDA NA GC',
                    value: 'Abrir na GamersClub ↗',
                    href: detalhe.partida.codigo
                      ? `https://gamersclub.com.br/lobby/match/${detalhe.partida.codigo}`
                      : undefined,
                  },
                  { label: 'DOWNLOAD', value: 'Demo indisponível' },
                ].map((item: { label: string; value: string; href?: string }) => (
                  <div
                    key={item.label}
                    style={{
                      border: '1px solid rgba(255,255,255,.08)',
                      borderRadius: 10,
                      background: 'rgba(255,255,255,.01)',
                      padding: '8px 10px',
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: 'rgba(255,255,255,.58)',
                        letterSpacing: 1.1,
                        textTransform: 'uppercase',
                        fontFamily: "'Rajdhani',sans-serif",
                        fontWeight: 700,
                        marginBottom: 4,
                      }}
                    >
                      {item.label}
                    </div>
                    {item.href ? (
                      <a
                        href={item.href}
                        target='_blank'
                        rel='noopener noreferrer'
                        style={{
                          display: 'block',
                          color: '#22d3ee',
                          fontSize: 15,
                          fontFamily: "'Rajdhani',sans-serif",
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          textDecoration: 'none',
                        }}
                        title={item.href}
                      >
                        {item.value}
                      </a>
                    ) : (
                      <div
                        style={{
                          color: '#fff',
                          fontSize: 15,
                          fontFamily: "'Rajdhani',sans-serif",
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={item.value}
                      >
                        {item.value}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                border: '1px solid rgba(255,255,255,.08)',
                background: 'rgba(255,255,255,.02)',
                borderRadius: 12,
                padding: 12,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                  gap: 12,
                  flexWrap: 'wrap',
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    fontFamily: "'Rajdhani',sans-serif",
                    fontSize: 34,
                    fontWeight: 800,
                    color: '#fff',
                    lineHeight: 1,
                    letterSpacing: 0.4,
                  }}
                >
                  <span style={{ color: '#22d3ee', marginRight: 8 }}>{scoreA ?? '-'}</span>
                  {teamAName}
                </div>
                <div style={{ flex: '1 1 260px', minWidth: 220, maxWidth: 360 }}>
                  <div
                    style={{
                      textAlign: 'right',
                      fontSize: 10,
                      color: 'rgba(255,255,255,.7)',
                      letterSpacing: 0.8,
                      textTransform: 'uppercase',
                      fontFamily: "'Rajdhani',sans-serif",
                      fontWeight: 700,
                      marginBottom: 4,
                    }}
                  >
                    Probabilidade de vitória: {probA}%
                  </div>
                  <div
                    style={{
                      height: 4,
                      borderRadius: 999,
                      background: 'rgba(255,255,255,.12)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${probA}%`,
                        height: '100%',
                        background: '#22d3ee',
                      }}
                    />
                  </div>
                </div>
              </div>
              {renderTeamTable(timeA, '#22d3ee')}
            </div>

            <div style={{ height: 12 }} />

            <div
              style={{
                border: '1px solid rgba(255,255,255,.08)',
                background: 'rgba(255,255,255,.02)',
                borderRadius: 12,
                padding: 12,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                  gap: 12,
                  flexWrap: 'wrap',
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    fontFamily: "'Rajdhani',sans-serif",
                    fontSize: 34,
                    fontWeight: 800,
                    color: '#fff',
                    lineHeight: 1,
                    letterSpacing: 0.4,
                  }}
                >
                  <span style={{ color: '#4ade80', marginRight: 8 }}>{scoreB ?? '-'}</span>
                  {teamBName}
                </div>
                <div style={{ flex: '1 1 260px', minWidth: 220, maxWidth: 360 }}>
                  <div
                    style={{
                      textAlign: 'right',
                      fontSize: 10,
                      color: 'rgba(255,255,255,.7)',
                      letterSpacing: 0.8,
                      textTransform: 'uppercase',
                      fontFamily: "'Rajdhani',sans-serif",
                      fontWeight: 700,
                      marginBottom: 4,
                    }}
                  >
                    Probabilidade de vitória: {probB}%
                  </div>
                  <div
                    style={{
                      height: 4,
                      borderRadius: 999,
                      background: 'rgba(255,255,255,.12)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${probB}%`,
                        height: '100%',
                        background: '#4ade80',
                      }}
                    />
                  </div>
                </div>
              </div>
              {renderTeamTable(timeB, '#fb923c')}
            </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Partidas Page ────────────────────────────────────────────────────────────
export function PartidasPage({ setPage }: { setPage: (p: any) => void }) {
  const { isAdmin } = useAuth()
  const [seasonId, setSeasonId] = useState<number>(2)
  const [partidas, setPartidas] = useState<Partida[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState<number | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detalhe, setDetalhe] = useState<PartidaDetalhe | null>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2500)
  }

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.listarPartidas(undefined, { seasonId })
      const list = Array.isArray(data) ? data : []
      setPartidas(list.map((p) => normalizePartida(p as PartidaRaw)))
    } catch {
      setPartidas([])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [seasonId])

  const del = async (id: number) => {
    if (!confirm('Excluir esta partida e recalcular o ranking?')) return
    setDeleting(id)
    try {
      await api.deletarPartida(id)
      showToast('Partida excluída e ranking recalculado.')
      await load()
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir', false)
    } finally {
      setDeleting(null)
    }
  }

  const openDetails = async (codigo: string) => {
    if (!String(codigo).trim() || String(codigo) === '-') {
      showToast('Partida sem código para consulta de detalhes.', false)
      return
    }
    setDetailOpen(true)
    setDetailLoading(true)
    setDetalhe(null)
    try {
      const res = await api.detalhesPartida(codigo)
      const partida = res?.partida ?? res?.resultados?.partida ?? {}
      const jogadores = Array.isArray(res?.jogadores)
        ? res.jogadores
        : Array.isArray(res?.resultados?.jogadores)
        ? res.resultados.jogadores
        : []
      setDetalhe({ partida, jogadores })
    } catch {
      setDetalhe(null)
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    const codigo = localStorage.getItem(DASHBOARD_OPEN_PARTIDA_CODE_KEY)
    if (!codigo) return
    localStorage.removeItem(DASHBOARD_OPEN_PARTIDA_CODE_KEY)
    openDetails(codigo).catch(() => {})
  }, [])

  const filtered = useMemo(
    () =>
      partidas
        .filter(
          (p) =>
            p.codigo.includes(search) ||
            p.mapa.toLowerCase().includes(search.toLowerCase()) ||
            p.timeA.toLowerCase().includes(search.toLowerCase()) ||
            p.timeB.toLowerCase().includes(search.toLowerCase())
        )
        .sort((a, b) => b.ts - a.ts || b.id - a.id),
    [partidas, search]
  )

  const PAGE_SIZE = 20
  const [listPage, setListPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(listPage, totalPages)
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  )

  useEffect(() => {
    setListPage(1)
  }, [search, seasonId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div
        style={{
          position: 'relative',
          overflow: 'visible',
          background: 'linear-gradient(135deg,rgba(251,146,60,.08),rgba(192,132,252,.06))',
          border: '1px solid rgba(251,146,60,.2)',
          borderRadius: 18,
          padding: '24px 28px',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 18,
            backgroundImage:
              'linear-gradient(rgba(251,146,60,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(251,146,60,.03) 1px,transparent 1px)',
            backgroundSize: '44px 44px',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            position: 'relative',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                color: 'rgba(251,146,60,.7)',
                letterSpacing: 3,
                textTransform: 'uppercase',
                marginBottom: 6,
                fontFamily: "'Rajdhani',sans-serif",
                fontWeight: 700,
              }}
            >
              ⚔ Histórico
            </div>
            <h1
              style={{
                fontFamily: "'Orbitron',monospace",
                fontSize: 'clamp(20px,3vw,26px)',
                fontWeight: 900,
                color: '#fff',
                margin: 0,
                letterSpacing: 2,
              }}
            >
              PARTIDAS <span style={{ color: '#fb923c' }}>IMPORTADAS</span>
            </h1>
            <div
              style={{
                fontSize: 13,
                color: 'rgba(255,255,255,.42)',
                marginTop: 5,
                fontFamily: "'Rajdhani',sans-serif",
              }}
            >
              {partidas.length} partidas registradas
            </div>
          </div>

          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            <SeasonDropdown
              value={seasonId}
              onChange={(nextValue) => setSeasonId(Number(nextValue) === 1 ? 1 : 2)}
              options={[
                { value: 2, label: 'Temporada 2' },
                { value: 1, label: 'Temporada 1' },
              ]}
              width={135}
              buttonHeight={38}
              optionHeight={36}
              selectedFontSize={12}
              optionFontSize={12}
              title='Filtro de temporada de partidas'
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Buscar código, mapa ou time...'
              style={{
                background: 'rgba(255,255,255,.05)',
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: 'rgba(255,255,255,.12)',
                borderRadius: 9,
                padding: '8px 14px',
                color: '#fff',
                fontSize: 13,
                fontFamily: "'Rajdhani',sans-serif",
                outline: 'none',
                width: 240,
              }}
              onFocus={(e) => (e.target.style.borderColor = 'rgba(251,146,60,.5)')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,.12)')}
            />
            {isAdmin && (
              <Btn onClick={() => setPage('importar')} color='#fb923c'>
                + IMPORTAR
              </Btn>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div
          style={{
            textAlign: 'center',
            padding: 60,
            color: 'rgba(255,255,255,.3)',
            fontFamily: "'Rajdhani',sans-serif",
          }}
        >
          Carregando partidas...
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 60,
            color: 'rgba(255,255,255,.2)',
            fontFamily: "'Rajdhani',sans-serif",
          }}
        >
          Nenhuma partida encontrada.
        </div>
      ) : (
        <Card title='Consulta de Partidas' titleStyle={{ paddingLeft: 5, marginTop: 2 }}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 980 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'minmax(90px,110px) minmax(70px,90px) minmax(180px,1fr) minmax(180px,1fr) minmax(90px,110px) minmax(100px,110px) minmax(90px,110px)',
                  gap: 8,
                  padding: '6px 12px',
                  marginBottom: 4,
                }}
              >
                {['CÓDIGO', 'MAPA', 'TIME A', 'TIME B', 'PLACAR', 'DATA', 'AÇÃO'].map((h) => (
                  <span
                    key={h}
                    style={{
                      fontSize: 14,
                      color: 'rgba(255,255,255,.25)',
                      letterSpacing: 1.5,
                      fontFamily: "'Rajdhani',sans-serif",
                      fontWeight: 700,
                    }}
                  >
                    {h}
                  </span>
                ))}
              </div>

              {paginated.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'minmax(90px,110px) minmax(70px,90px) minmax(180px,1fr) minmax(180px,1fr) minmax(90px,110px) minmax(100px,110px) minmax(90px,110px)',
                    gap: 8,
                    padding: '10px 12px',
                    borderRadius: 9,
                    marginBottom: 4,
                    background: 'rgba(255,255,255,.025)',
                    border: '1px solid rgba(255,255,255,.05)',
                    alignItems: 'center',
                    transition: 'background .2s',
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLElement).style.background =
                      'rgba(255,255,255,.05)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLElement).style.background =
                      'rgba(255,255,255,.025)'
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Orbitron',monospace",
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#fb923c',
                    }}
                  >
                    {p.codigo}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#fff',
                      fontFamily: "'Rajdhani',sans-serif",
                    }}
                  >
                    {p.mapa}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: 'rgba(255,255,255,.7)',
                      fontFamily: "'Rajdhani',sans-serif",
                    }}
                  >
                    {p.timeA}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: 'rgb(255, 255, 255)',
                      fontFamily: "'Rajdhani',sans-serif",
                    }}
                  >
                    {p.timeB}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Orbitron',monospace",
                      fontSize: 12,
                      color: scoreColor(p.scoreA, p.scoreB),
                      fontWeight: 700,
                    }}
                  >
                    {p.scoreA !== null && p.scoreB !== null
                      ? `${p.scoreA} × ${p.scoreB}`
                      : '-'}
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      color: 'rgba(255, 255, 255, 0.61)',
                      fontFamily: "'Rajdhani',sans-serif",
                    }}
                  >
                    {p.data}
                  </span>

                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button
                      onClick={() => openDetails(p.codigo)}
                      style={{
                        background: 'rgba(34,211,238,.12)',
                        border: '1px solid rgba(34,211,238,.3)',
                        color: '#22d3ee',
                        borderRadius: 7,
                        padding: '5px 10px',
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: "'Rajdhani',sans-serif",
                        letterSpacing: 1,
                      }}
                    >
                      DETALHES
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => del(p.id)}
                        disabled={deleting === p.id}
                        style={{
                          background: 'rgba(248,113,113,.1)',
                          border: '1px solid rgba(248,113,113,.3)',
                          color: '#f87171',
                          borderRadius: 7,
                          width: 28,
                          height: 26,
                          cursor: deleting === p.id ? 'not-allowed' : 'pointer',
                          opacity: deleting === p.id ? 0.6 : 1,
                        }}
                      >
                        {deleting === p.id ? '…' : '✕'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 10,
                padding: '14px 0 6px',
              }}
            >
              <button
                onClick={() => setListPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                style={{
                  background: 'rgba(251,146,60,.1)',
                  border: '1px solid rgba(251,146,60,.3)',
                  color: '#fb923c',
                  borderRadius: 7,
                  padding: '6px 14px',
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: "'Rajdhani',sans-serif",
                  letterSpacing: 1,
                  cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPage <= 1 ? 0.4 : 1,
                }}
              >
                ← ANTERIOR
              </button>
              <span
                style={{
                  fontSize: 12,
                  color: 'rgba(255,255,255,.6)',
                  fontFamily: "'Orbitron',monospace",
                  fontWeight: 700,
                }}
              >
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setListPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                style={{
                  background: 'rgba(251,146,60,.1)',
                  border: '1px solid rgba(251,146,60,.3)',
                  color: '#fb923c',
                  borderRadius: 7,
                  padding: '6px 14px',
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: "'Rajdhani',sans-serif",
                  letterSpacing: 1,
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                  opacity: currentPage >= totalPages ? 0.4 : 1,
                }}
              >
                PRÓXIMA →
              </button>
            </div>
          )}
        </Card>
      )}

      {detailOpen && (
        <DetailModal
          detalhe={detalhe}
          loading={detailLoading}
          onClose={() => {
            setDetailOpen(false)
            setDetalhe(null)
          }}
        />
      )}

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </div>
  )
}

// ─── Importar Page ────────────────────────────────────────────────────────────
export function ImportarPage() {
  const { isAdmin, refreshGold } = useAuth()
  const [json, setJson] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const submit = async () => {
    if (!json.trim()) {
      setResult({ ok: false, msg: 'Cole o JSON da partida antes de importar.' })
      return
    }

    let payload
    try {
      payload = JSON.parse(json)
    } catch {
      setResult({ ok: false, msg: 'JSON inválido. Verifique o conteúdo copiado.' })
      return
    }

    setLoading(true)
    setResult(null)
    try {
      const data = await api.importarJson(payload)
      setResult({ ok: true, msg: data?.mensagem || 'Partida importada com sucesso!' })
      setJson('')
      await refreshGold().catch(() => {})
    } catch (err: any) {
      setResult({ ok: false, msg: err.message || 'Erro ao importar partida.' })
    } finally {
      setLoading(false)
    }
  }

  if (!isAdmin)
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '50vh',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          style={{
            fontFamily: "'Orbitron',monospace",
            fontSize: 18,
            color: 'rgba(255,255,255,.15)',
            letterSpacing: 4,
          }}
        >
          ACESSO NEGADO
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'rgba(255,255,255,.3)',
            fontFamily: "'Rajdhani',sans-serif",
          }}
        >
          Apenas administradores podem importar partidas.
        </div>
      </div>
    )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 920 }}>
      <div
        style={{
          background: 'linear-gradient(135deg,rgba(34,211,238,.08),rgba(192,132,252,.06))',
          border: '1px solid rgba(34,211,238,.2)',
          borderRadius: 18,
          padding: '24px 28px',
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: 'rgba(34,211,238,.7)',
            letterSpacing: 3,
            textTransform: 'uppercase',
            marginBottom: 6,
            fontFamily: "'Rajdhani',sans-serif",
            fontWeight: 700,
          }}
        >
          ⬆ Admin
        </div>
        <h1
          style={{
            fontFamily: "'Orbitron',monospace",
            fontSize: 22,
            fontWeight: 900,
            color: '#fff',
            margin: 0,
            letterSpacing: 2,
          }}
        >
          IMPORTAR <span style={{ color: '#22d3ee' }}>PARTIDA</span>
        </h1>
        <p
          style={{
            fontSize: 13,
            color: 'rgba(255,255,255,.4)',
            marginTop: 8,
            fontFamily: "'Rajdhani',sans-serif",
            lineHeight: 1.6,
          }}
        >
          Cole o JSON capturado pela aba <strong style={{ color: '#fff' }}>Network</strong>
          {' '}do DevTools na página de partida da GamersClub.
        </p>
      </div>

      <Card title='Como Capturar o JSON' titleStyle={{ paddingLeft: 5, marginTop: 2 }}>
        <ol style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 10 }}>
          {[
            'Acesse a página da partida na GamersClub',
            'adicione o "/1" na frente da url da partida',
            'Exemplo: https://gamersclub.com.br/lobby/match/12345678/1',
            'Copie todos os dados e cole no campo abaixo, depois clique em Importar',
          ].map((step, i) => (
            <li
              key={i}
              style={{
                fontSize: 13,
                color: 'rgba(255,255,255,.5)',
                fontFamily: "'Rajdhani',sans-serif",
                lineHeight: 1.5,
              }}
            >
              <span style={{ color: '#22d3ee', fontWeight: 700 }}>Passo {i + 1}:</span>{' '}
              {step}
            </li>
          ))}
        </ol>
      </Card>

      <Card title='JSON da Partida' titleStyle={{ paddingLeft: 5, marginTop: 2 }}>
        <textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          placeholder='{"id": 12345678, "jogos": { "players": [...] }, ...}'
          rows={12}
          style={{
            width: '100%',
            background: 'rgba(0,0,0,.3)',
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'rgba(255,255,255,.1)',
            borderRadius: 10,
            padding: '14px 16px',
            color: '#fff',
            fontSize: 12,
            fontFamily: 'monospace',
            resize: 'vertical',
            outline: 'none',
            lineHeight: 1.6,
            marginBottom: 14,
          }}
          onFocus={(e) => (e.target.style.borderColor = 'rgba(34,211,238,.4)')}
          onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,.1)')}
        />

        {result && (
          <div
            style={{
              marginBottom: 14,
              padding: '12px 16px',
              borderRadius: 9,
              background: result.ok ? 'rgba(74,222,128,.08)' : 'rgba(248,113,113,.08)',
              border: `1px solid ${result.ok ? '#4ade80' : '#f87171'}44`,
              color: result.ok ? '#4ade80' : '#f87171',
              fontSize: 13,
              fontFamily: "'Rajdhani',sans-serif",
              fontWeight: 600,
            }}
          >
            {result.ok ? '✓ ' : '✕ '}
            {result.msg}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Btn onClick={submit} disabled={loading || !json.trim()} color='#22d3ee' size='lg'>
            {loading ? 'IMPORTANDO...' : 'IMPORTAR PARTIDA'}
          </Btn>
          <Btn
            onClick={() => {
              setJson('')
              setResult(null)
            }}
            variant='outline'
            color='#f87171'
            size='lg'
          >
            LIMPAR
          </Btn>
        </div>
      </Card>
    </div>
  )
}
