import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/Card'
import * as api from '@/services/api'
import { LEVEL_COLOR_BY_ID, LEVEL_NAME_BY_ID } from '@/components/profile/PlayerProfilePreview'

interface Jogador {
  id: number
  nome: string
  kills?: string | number
  adr?: string | number
  mortes?: string | number
  assistencias?: string | number
  vitorias?: string | number
  pontos?: string | number
  qtd_partidas?: string | number
  kda_player?: string | number
  kast?: string | number
  imagem?: string
  level?: string | number
  level_pontos?: string | number
  level_nome?: string
  level_tier?: string
}

type SortKey = 'level_pontos' | 'pontos' | 'pontos_total' | 'kills' | 'adr' | 'kda_player' | 'vitorias'

const SORT_OPTIONS: { key: SortKey; label: string; color: string }[] = [
  { key: 'pontos', label: 'Média', color: '#c084fc' },
  { key: 'pontos_total', label: 'Total', color: '#a855f7' },
  { key: 'level_pontos', label: 'XP Level', color: '#22d3ee' },
  { key: 'adr', label: 'ADR', color: '#f5c842' },
  { key: 'kills', label: 'Kills', color: '#22d3ee' },
  { key: 'kda_player', label: 'K/D', color: '#fb923c' },
  { key: 'vitorias', label: 'Vitórias', color: '#4ade80' },
]

const ACCENT = ['#f5c842', '#22d3ee', '#c084fc', '#4ade80', '#fb923c', '#f472b6']
const MEDALS = ['🥇', '🥈', '🥉']

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0
  const n = Number(String(value).replace(',', '.').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function fmt(value: number, decimals = 0) {
  if (!Number.isFinite(value)) return '0'
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function winRate(j: Jogador) {
  const wins = toNumber(j.vitorias)
  const matches = toNumber(j.qtd_partidas)
  if (!matches) return 0
  return Math.round((wins / matches) * 100)
}

function levelAccentColor(level: number) {
  const lv = Math.max(0, Math.min(15, Math.round(level)))
  return LEVEL_COLOR_BY_ID[lv] || '#a78bfa'
}

export default function RankingPage() {
  const [jogadores, setJogadores] = useState<Jogador[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('pontos')
  const [seasonId, setSeasonId] = useState<number>(2)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const metricValue = (j: Jogador, key: SortKey) => {
    switch (key) {
      case 'pontos': {
        // Média = total de pontos da temporada ÷ nº de partidas
        const parts = toNumber(j.qtd_partidas)
        return parts > 0 ? Math.round(toNumber(j.pontos) / parts) : 0
      }
      case 'pontos_total':
        // Total = soma dos pontos da temporada (valor que vem do backend)
        return Math.round(toNumber(j.pontos))
      case 'level_pontos':
        return toNumber(j.level_pontos)
      case 'kills':
        return toNumber(j.kills)
      case 'adr':
        return toNumber(j.adr)
      case 'kda_player':
        return toNumber(j.kda_player)
      case 'vitorias':
        return toNumber(j.vitorias)
      default:
        return 0
    }
  }

  useEffect(() => {
    setLoading(true)
    api
      .listarJogadores({ seasonId })
      .then((d) => setJogadores(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [seasonId])

  const sorted = useMemo(
    () =>
      [...jogadores]
        .filter((j) =>
          String(j.nome || '')
            .toLowerCase()
            .includes(search.toLowerCase())
        )
        .sort((a, b) => {
          const diff = metricValue(b, sortKey) - metricValue(a, sortKey)
          if (diff !== 0) return diff
          return toNumber(b.pontos) - toNumber(a.pontos)
        }),
    [jogadores, search, sortKey]
  )

  const top3 = sorted.slice(0, 3)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div
        style={{
          background: 'linear-gradient(135deg,rgba(245,200,66,.08) 0%,rgba(192,132,252,.06) 100%)',
          border: '1px solid rgba(245,200,66,.2)',
          borderRadius: 18,
          padding: '24px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              color: 'rgba(245,200,66,.7)',
              letterSpacing: 3,
              textTransform: 'uppercase',
              marginBottom: 6,
              fontFamily: "'Rajdhani',sans-serif",
              fontWeight: 700,
            }}
          >
            ⭐ Temporada {seasonId}
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
            RANKING DE <span style={{ color: '#f5c842' }}>JOGADORES</span>
          </h1>
          <div
            style={{
              fontSize: 13,
              color: 'rgba(255,255,255,.4)',
              marginTop: 6,
              fontFamily: "'Rajdhani',sans-serif",
            }}
          >
            {jogadores.length} jogadores · Ordenado por{' '}
            {SORT_OPTIONS.find((c) => c.key === sortKey)?.label}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select
            value={seasonId}
            onChange={(e) => setSeasonId(Number(e.target.value) === 1 ? 1 : 2)}
            style={{
              background: 'rgba(255,255,255,.05)',
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: 'rgba(255,255,255,.12)',
              borderRadius: 9,
              padding: '9px 12px',
              color: '#fff',
              fontSize: 13,
              fontFamily: "'Rajdhani',sans-serif",
              outline: 'none',
            }}
          >
            <option value={2}>Temporada 2</option>
            <option value={1}>Temporada 1</option>
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Buscar jogador...'
            style={{
              background: 'rgba(255,255,255,.05)',
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: 'rgba(255,255,255,.12)',
              borderRadius: 9,
              padding: '9px 14px',
              color: '#fff',
              fontSize: 13,
              fontFamily: "'Rajdhani',sans-serif",
              outline: 'none',
              width: 220,
            }}
            onFocus={(e) => (e.target.style.borderColor = 'rgba(245,200,66,.5)')}
            onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,.12)')}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {SORT_OPTIONS.map((col) => (
          <button
            key={col.key}
            onClick={() => setSortKey(col.key)}
            style={{
              background:
                sortKey === col.key ? `${col.color}22` : 'rgba(255,255,255,.04)',
              border: `1px solid ${sortKey === col.key ? col.color : 'rgba(255,255,255,.1)'}`,
              borderRadius: 8,
              padding: '7px 16px',
              color: sortKey === col.key ? col.color : 'rgba(255,255,255,.4)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'Rajdhani',sans-serif",
              letterSpacing: 1,
              transition: 'all .2s',
            }}
          >
            {col.label.toUpperCase()}
          </button>
        ))}
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
          Carregando ranking...
        </div>
      ) : (
        <>
          {top3.length >= 3 && (
            <Card title='Top 3 melhores jogadores da Temporada' titleStyle={{ paddingLeft: 5, marginTop: 2 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'flex-end',
                  gap: 12,
                  padding: '10px 0 4px',
                  flexWrap: 'wrap',
                }}
              >
                {[top3[1], top3[0], top3[2]].map((p, pi) => {
                  const isCenter = pi === 1
                  const color = ACCENT[isCenter ? 0 : pi === 0 ? 1 : 2]
                  const heights = [80, 110, 64]
                  const rank = pi === 1 ? 1 : pi === 0 ? 2 : 3
                  const metric = metricValue(p, sortKey)

                  return (
                    <div
                      key={p.id}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
                    >
                      {isCenter && <span style={{ fontSize: 22 }}>👑</span>}
                      <div style={{ fontSize: isCenter ? 22 : 18 }}>{MEDALS[rank - 1]}</div>

                      {p.imagem ? (
                        <img
                          src={p.imagem}
                          alt={p.nome}
                          style={{
                            width: isCenter ? 64 : 50,
                            height: isCenter ? 64 : 50,
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: `3px solid ${color}`,
                            boxShadow: `0 0 ${isCenter ? 24 : 12}px ${color}55`,
                          }}
                          onError={(e) => {
                            ;(e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: isCenter ? 64 : 50,
                            height: isCenter ? 64 : 50,
                            borderRadius: '50%',
                            background: `${color}22`,
                            border: `3px solid ${color}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 900,
                            fontSize: isCenter ? 22 : 16,
                            color,
                            boxShadow: `0 0 ${isCenter ? 24 : 12}px ${color}44`,
                          }}
                        >
                          {p.nome?.[0]?.toUpperCase()}
                        </div>
                      )}

                      <div
                        style={{
                          fontSize: isCenter ? 14 : 12,
                          fontWeight: 700,
                          color: '#fff',
                          textAlign: 'center',
                          maxWidth: 110,
                          fontFamily: "'Rajdhani',sans-serif",
                          lineHeight: 1.1,
                        }}
                      >
                        {p.nome}
                      </div>

                      <div
                        style={{
                          background: `${color}18`,
                          border: `1px solid ${color}33`,
                          borderRadius: 6,
                          padding: '3px 10px',
                          fontFamily: "'Orbitron',monospace",
                          fontSize: isCenter ? 13 : 11,
                          fontWeight: 700,
                          color,
                        }}
                      >
                        {fmt(metric)}
                      </div>

                      <div
                        style={{
                          width: 60,
                          height: heights[pi],
                          background: `${color}14`,
                          border: `1px solid ${color}28`,
                          borderBottom: 'none',
                          borderRadius: '6px 6px 0 0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 18,
                          fontWeight: 900,
                          color: `${color}66`,
                        }}
                      >
                        {rank}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          <Card title='Classificação Completa' titleStyle={{ paddingLeft: 5, marginTop: 2 }}>
            
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 1080 }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      '40px 50px minmax(170px,1fr) 70px 70px 70px 70px 70px 70px 70px 70px 70px 80px',
                    gap: 6,
                    padding: '6px 12px',
                    marginBottom: 4,
                  }}
                >
                  {['', ' ', 'JOGADOR', 'LEVEL', 'ADR', 'KILLS', 'ASSIST', 'DEATHS', 'KDR', 'KAST', 'PARTIDAS', 'WINRATE%', sortKey === 'pontos_total' ? 'TOTAL' : 'MÉDIA'].map((h) => (
                    <span
                      key={h}
                      style={{
                        fontSize: 9,
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

                {sorted.map((j, i) => {
                  const color = ACCENT[i % ACCENT.length]
                  const isTop3 = i < 3
                  // coluna PTS acompanha o modo ativo: Total = soma; Média = soma ÷ partidas
                  const parts = toNumber(j.qtd_partidas)
                  const points =
                    sortKey === 'pontos_total'
                      ? Math.round(toNumber(j.pontos))
                      : parts > 0
                      ? Math.round(toNumber(j.pontos) / parts)
                      : 0
                  const kills = toNumber(j.kills)
                  const assists = toNumber(j.assistencias)
                  const deaths = toNumber(j.mortes)
                  const adr = toNumber(j.adr)
                  const kdr = toNumber(j.kda_player)
                  const kast = toNumber(j.kast)
                  const wr = winRate(j)
                  const levelValue = Math.max(0, Math.min(15, Math.round(toNumber(j.level))))
                  const levelColor = levelAccentColor(levelValue)
                  const levelName =
                    LEVEL_NAME_BY_ID[levelValue as keyof typeof LEVEL_NAME_BY_ID] || 'Newba'
                  const levelNameExact = String(j.level_nome || '').trim() || levelName
                  const levelIconUrl = `/level-icons/level-${levelValue}.png`

                  return (
                    <div
                      key={j.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          '40px 50px minmax(170px,1fr) 70px 70px 70px 70px 70px 70px 70px 70px 70px 80px',
                        gap: 6,
                        padding: '10px 12px',
                        borderRadius: 9,
                        marginBottom: 3,
                        background: isTop3 ? `${color}08` : 'rgba(255,255,255,.025)',
                        border: `1px solid ${isTop3 ? color + '22' : 'rgba(255,255,255,.05)'}`,
                        alignItems: 'center',
                        transition: 'background .2s',
                        cursor: 'default',
                      }}
                      onMouseEnter={(e) => {
                        ;(e.currentTarget as HTMLElement).style.background = isTop3
                          ? `${color}14`
                          : 'rgba(255,255,255,.05)'
                      }}
                      onMouseLeave={(e) => {
                        ;(e.currentTarget as HTMLElement).style.background = isTop3
                          ? `${color}08`
                          : 'rgba(255,255,255,.025)'
                      }}
                    >
                      <span style={{ fontSize: i < 3 ? 18 : 12, textAlign: 'center' }}>
                        {i < 3 ? MEDALS[i] : ''}
                      </span>

                      <span
                        style={{
                          fontFamily: "'Orbitron',monospace",
                          fontSize: 12,
                          fontWeight: 700,
                          color,
                        }}
                      >
                        #{i + 1}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                        {j.imagem ? (
                          <img
                            src={j.imagem}
                            alt={j.nome}
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: '50%',
                              objectFit: 'cover',
                              flexShrink: 0,
                              border: `1px solid ${color}55`,
                            }}
                            onError={(e) => {
                              ;(e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: '50%',
                              background: `${color}22`,
                              border: `1px solid ${color}55`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 12,
                              fontWeight: 700,
                              color,
                              flexShrink: 0,
                            }}
                          >
                            {j.nome?.[0]?.toUpperCase()}
                          </div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: '#fff',
                              fontFamily: "'Rajdhani',sans-serif",
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              minWidth: 0,
                            }}
                          >
                            <span
                              style={{
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                minWidth: 0,
                              }}
                            >
                              {j.nome}
                            </span>
                            <span
                              style={{
                                color: levelColor,
                                border: `1px solid ${levelColor}88`,
                                background: `${levelColor}1a`,
                                borderRadius: 6,
                                fontSize: 10,
                                fontWeight: 800,
                                fontFamily: "'Orbitron',monospace",
                                letterSpacing: 0.5,
                                padding: '1px 6px',
                                flexShrink: 0,
                                lineHeight: 1.2,
                                boxShadow: `0 0 10px ${levelColor}22 inset`,
                              }}
                            >
                              LV {fmt(levelValue)}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: levelColor,
                              fontFamily: "'Rajdhani',sans-serif",
                              letterSpacing: 0.4,
                              textTransform: 'uppercase',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {levelNameExact}
                          </div>
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: 12,
                          color: levelColor,
                          fontFamily: "'Orbitron',monospace",
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <img
                          src={levelIconUrl}
                          alt={`Level ${levelValue}`}
                          style={{
                            width: 22,
                            height: 22,
                            objectFit: 'contain',
                            filter: `drop-shadow(0 0 6px ${levelColor}88)`,
                          }}
                        />
                        {fmt(levelValue)}
                      </span>
                      <span style={{ fontSize: 12, color: '#f5c842', fontFamily: "'Orbitron',monospace" }}>
                        {fmt(adr, 1)}
                      </span>
                      <span style={{ fontSize: 12, color: '#22d3ee', fontFamily: "'Orbitron',monospace" }}>
                        {fmt(kills)}
                      </span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,.62)', fontFamily: "'Orbitron',monospace" }}>
                        {fmt(assists)}
                      </span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,.62)', fontFamily: "'Orbitron',monospace" }}>
                        {fmt(deaths)}
                      </span>
                      <span style={{ fontSize: 12, color: '#fb923c', fontFamily: "'Orbitron',monospace" }}>
                        {fmt(kdr, 2)}
                      </span>
                      <span style={{ fontSize: 12, color: '#f472b6', fontFamily: "'Orbitron',monospace" }}>
                        {kast ? `${fmt(kast)}%` : '0%'}
                      </span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,.78)', fontFamily: "'Orbitron',monospace" }}>
                        {fmt(toNumber(j.qtd_partidas))}
                      </span>
                      <span style={{ fontSize: 12, color: '#4ade80', fontFamily: "'Orbitron',monospace" }}>
                        {wr}%
                      </span>
                      <span
                        style={{
                          fontFamily: "'Orbitron',monospace",
                          fontSize: 13,
                          fontWeight: 700,
                          color:
                            sortKey === 'pontos' || sortKey === 'pontos_total'
                              ? '#c084fc'
                              : 'rgba(255,255,255,.72)',
                        }}
                      >
                        {fmt(points)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
