import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { PlayerAvatar } from '@/components/ui/PlayerAvatar'
import { useAuth } from '@/hooks/useAuth'
import { useAnimIn, useCounter } from '@/hooks/useCounter'
import * as api from '@/services/api'

interface Jogador {
  id: number
  nome: string
  kills?: string
  pontos?: string
  qtd_partidas?: string
  gold?: number | string
  imagem?: string
}

interface Partida {
  id: number
  codigo?: number
  mapa?: string
  created_at?: string
  data?: string
  nome_time1?: string
  nome_time2?: string
  time_a?: string
  time_b?: string
  score_time_1?: number | string
  score_time_2?: number | string
  resultado_time1?: number | string
  resultado_time2?: number | string
  partida_ganha?: boolean | number | string
}

type AlbumFigurinha = {
  possui?: boolean
  raridade?: string
}

type HomeStat = {
  label: string
  value: number
  suffix: '' | 'K' | '%'
  icon: string
  color: string
  sub: string
}

type MapStat = {
  name: string
  matches: number
  winRate: number
  color: string
  image: string
}

type RankingEntry = {
  pos: number
  id: number
  name: string
  pts: number
  avatar: string
  color: string
  online: boolean
  imagem?: string
}

type RecentEntry = {
  map: string
  result: string
  resultTone: 'win-a' | 'win-b' | 'draw' | 'na'
  teamA: string
  teamB: string
  date: string
}

type OnlinePlayer = {
  id: number
  nome: string
  imagem?: string
  lastSeen?: string
}

const MAP_COLORS = ['#22d3ee', '#fb923c', '#f5c842', '#c084fc', '#4ade80']
const RANK_COLORS = ['#f5c842', '#22d3ee', '#c084fc', '#4ade80', '#fb923c']

function fmtInt(n: number) {
  return Number.isFinite(n) ? n.toLocaleString('pt-BR') : '0'
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(String(value).replace(',', '.').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

function parseMatchTs(value?: string) {
  if (!value) return 0
  const raw = String(value).trim()
  if (!raw) return 0
  const direct = new Date(raw).getTime()
  if (Number.isFinite(direct)) return direct

  const m = raw.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:[ ,T](\d{2}):(\d{2})(?::(\d{2}))?)?$/
  )
  if (m) {
    const day = Number(m[1])
    const month = Number(m[2]) - 1
    const year = Number(m[3])
    const hour = Number(m[4] || 0)
    const min = Number(m[5] || 0)
    const sec = Number(m[6] || 0)
    const parsed = new Date(year, month, day, hour, min, sec).getTime()
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function readMatchDateField(p: Partida): string {
  const raw = String(p.created_at || p.data || '').trim()
  if (!raw) return ''
  return raw
}

function formatMatchDate(value?: string) {
  const ts = parseMatchTs(value)
  if (!ts) return '-'
  return new Date(ts).toLocaleDateString('pt-BR')
}

function readScoreA(p: Partida): number | null {
  return toNumber(p.score_time_1 ?? p.resultado_time1)
}

function readScoreB(p: Partida): number | null {
  return toNumber(p.score_time_2 ?? p.resultado_time2)
}

function readTeamA(p: Partida): string {
  const row = p as any
  return String(row.nome_time1 || row.nome_time_1 || row.time_a || row.timeA || 'Time')
}

function readTeamB(p: Partida): string {
  const row = p as any
  return String(row.nome_time2 || row.nome_time_2 || row.time_b || row.timeB || 'Time')
}

function mapImage(name: string) {
  const n = name.toLowerCase()
  if (n.includes('ancient')) return '/uploads/mapas/de_ancient.png'
  if (n.includes('anubis')) return '/uploads/mapas/de_anubis.png'
  if (n.includes('cache')) return '/uploads/mapas/de_cache.png'
  if (n.includes('dust2') || n.includes('dust_2') || n.includes('dust')) return '/uploads/mapas/de_dust2.png'
  if (n.includes('inferno')) return '/uploads/mapas/de_inferno.png'
  if (n.includes('mirage')) return '/uploads/mapas/de_mirage.png'
  if (n.includes('nuke')) return '/uploads/mapas/de_nuke.png'
  if (n.includes('overpass')) return '/uploads/mapas/de_overpass.png'
  return '/uploads/mapas/de_ancient.png'
}

function relativeDate(value?: string) {
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

function HomeStatCard({ stat, delay }: { stat: HomeStat; delay: number }) {
  const ready = useAnimIn(delay)
  const scaled = stat.suffix === 'K' ? Math.round((stat.value / 1000) * 10) : stat.value
  const val = useCounter(scaled, ready)

  const display =
    stat.suffix === 'K'
      ? `${(val / 10).toFixed(1)}K`
      : stat.suffix === '%'
      ? `${val}%`
      : fmtInt(val)

  return (
    <div
      style={{
        background: 'rgba(255,255,255,.03)',
        border: `1px solid ${stat.color}28`,
        borderRadius: 14,
        padding: '18px 20px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform .2s, border-color .2s',
        cursor: 'default',
        opacity: ready ? 1 : 0,
        transform: ready ? 'translateY(0)' : 'translateY(10px)',
        transitionProperty: 'opacity,transform,border-color',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = `${stat.color}60`
        el.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = `${stat.color}28`
        el.style.transform = 'translateY(0)'
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -16,
          right: -16,
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: `radial-gradient(circle,${stat.color}18 0%,transparent 70%)`,
          pointerEvents: 'none',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <span
          style={{
            fontSize: 10,
            color: 'rgba(255,255,255,.4)',
            letterSpacing: 2,
            textTransform: 'uppercase',
            fontFamily: "'Rajdhani',sans-serif",
            fontWeight: 700,
          }}
        >
          {stat.label}
        </span>
        <span style={{ fontSize: 20 }}>{stat.icon}</span>
      </div>
      <div
        style={{
          fontFamily: "'Orbitron',monospace",
          fontSize: 26,
          fontWeight: 700,
          color: '#fff',
          lineHeight: 1,
          marginBottom: 5,
        }}
      >
        {display}
      </div>
      <div style={{ fontSize: 11, color: stat.color, fontWeight: 700, fontFamily: "'Rajdhani',sans-serif" }}>
        {stat.sub}
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: 2,
          width: '40%',
          background: `linear-gradient(90deg,${stat.color},transparent)`,
        }}
      />
    </div>
  )
}

function MapPanel({ maps }: { maps: MapStat[] }) {
  const max = Math.max(1, ...maps.map((m) => m.matches))

  return (
    <Card
      title="Mapas Mais Jogados"
      titleStyle={{ paddingLeft: 5, marginTop: 2 }}
      style={{ minHeight: 392 }}
    >
      {maps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,.3)', fontFamily: "'Rajdhani',sans-serif" }}>
          Nenhuma partida importada para calcular mapas.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11, paddingLeft: 5 }}>
          {maps.map((m) => (
            <div key={m.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5, gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <img
                    src={m.image}
                    alt={m.name}
                    style={{
                      width: 75,
                      height: 45,
                      borderRadius: 5,
                      objectFit: 'cover',
                      border: '1px solid rgba(255,255,255,.18)',
                      flexShrink: 0,
                    }}
                    onError={(e) => {
                      ;(e.currentTarget as HTMLImageElement).src = '/uploads/mapas/de_ancient.png'
                    }}
                  />
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#fff',
                      fontFamily: "'Rajdhani',sans-serif",
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {m.name}
                  </span>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '88px 44px',
                    gap: 12,
                    alignItems: 'center',
                    justifyItems: 'end',
                    flexShrink: 0,
                    paddingRight: 5,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: 'rgba(255,255,255,.35)',
                      fontFamily: "'Rajdhani',sans-serif",
                      textAlign: 'right',
                      width: '100%',
                    }}
                  >
                    {fmtInt(m.matches)} partidas
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: "'Orbitron',monospace",
                      color: m.winRate >= 60 ? '#4ade80' : m.winRate >= 50 ? '#f5c842' : '#fb923c',
                      textAlign: 'right',
                      width: '100%',
                    }}
                  >
                    {m.winRate}%
                  </span>
                </div>
              </div>
              <div style={{ height: 5, background: 'rgba(255,255,255,.06)', borderRadius: 3, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${(m.matches / max) * 100}%`,
                    background: `linear-gradient(90deg,${m.color},${m.color}66)`,
                    borderRadius: 3,
                    boxShadow: `0 0 6px ${m.color}55`,
                    transition: 'width 1s cubic-bezier(.2,.8,.2,1)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function RankingPanel({ ranking, setPage }: { ranking: RankingEntry[]; setPage: (p: any) => void }) {
  return (
    <Card
      title="Top 5 jogadores"
      titleStyle={{ paddingLeft: 5, marginTop: 2 }}
      style={{ minHeight: 392 }}
      action={
        <button
          onClick={() => setPage('ranking')}
          style={{
            background: 'transparent',
            border: '1px solid #f5c84233',
            color: '#f5c842',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 10,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: "'Rajdhani',sans-serif",
            letterSpacing: 1,
          }}
        >
          VER TODOS →
        </button>
      }
    >
      {ranking.length < 3 ? (
        <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,.3)', fontFamily: "'Rajdhani',sans-serif" }}>
          Ranking insuficiente para montar o pódio.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 10, marginBottom: 14 }}>
            {[ranking[1], ranking[0], ranking[2]].map((p, pi) => {
              const isCenter = pi === 1
              const heights = [64, 84, 54]
              return (
                <div key={p.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  {isCenter && <span style={{ fontSize: 16 }}>👑</span>}
                  <PlayerAvatar
                    nome={p.name}
                    imagem={p.imagem}
                    color={p.color}
                    size={isCenter ? 48 : 38}
                    showGlow={isCenter}
                  />
                  <div
                    style={{
                      fontSize: 9,
                      color: 'rgba(255,255,255,.55)',
                      textAlign: 'center',
                      maxWidth: 72,
                      fontFamily: "'Rajdhani',sans-serif",
                      fontWeight: 600,
                    }}
                  >
                    {p.name}
                  </div>
                  <div
                    style={{
                      background: `${p.color}18`,
                      border: `1px solid ${p.color}33`,
                      borderRadius: 5,
                      padding: '2px 7px',
                      fontFamily: "'Orbitron',monospace",
                      fontSize: 10,
                      fontWeight: 700,
                      color: p.color,
                    }}
                  >
                    {fmtInt(p.pts)}
                  </div>
                  <div
                    style={{
                      width: 46,
                      height: heights[pi],
                      background: `linear-gradient(180deg,${p.color}28,${p.color}0a)`,
                      border: `1px solid ${p.color}28`,
                      borderBottom: 'none',
                      borderRadius: '4px 4px 0 0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                      fontWeight: 900,
                      color: `${p.color}66`,
                    }}
                  >
                    {p.pos}
                  </div>
                </div>
              )
            })}
          </div>

          {ranking.slice(3).map((p) => (
            <div
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '7px 12px',
                borderRadius: 8,
                marginBottom: 4,
                background: 'rgba(255,255,255,.03)',
                border: '1px solid rgba(255,255,255,.05)',
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,.25)',
                  width: 18,
                  textAlign: 'center',
                  fontWeight: 700,
                }}
              >
                #{p.pos}
              </span>
              <PlayerAvatar nome={p.name} imagem={p.imagem} color={p.color} size={28} />
              <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#fff', fontFamily: "'Rajdhani',sans-serif" }}>{p.name}</div>
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: p.online ? '#4ade80' : 'rgba(255,255,255,.15)',
                  boxShadow: p.online ? '0 0 5px #4ade80' : 'none',
                }}
              />
              <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 11, fontWeight: 700, color: p.color }}>{fmtInt(p.pts)}</div>
            </div>
          ))}
        </>
      )}
    </Card>
  )
}

function RecentMatchesPanel({ recent }: { recent: RecentEntry[] }) {
  return (
    <Card title="Últimas Partidas" titleStyle={{ paddingLeft: 5, marginTop: 2 }}>
      {recent.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,.3)', fontFamily: "'Rajdhani',sans-serif" }}>
          Nenhuma partida recente encontrada.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 620 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 120px 1fr 1fr 80px', gap: 6, padding: '3px 10px', marginBottom: 4 }}>
              {['MAPA', 'RESULTADO', 'TIME ', 'TIME ', 'DATA'].map((h, idx) => (
                <span
                  key={`${h}-${idx}`}
                  style={{
                    fontSize: 13,
                    color: 'rgb(255, 255, 255)',
                    letterSpacing: 1.5,
                    fontFamily: "'Rajdhani',sans-serif",
                    fontWeight: 700,
                  }}
                >
                  {h}
                </span>
              ))}
            </div>
            {recent.map((m, i) => (
              <div
                key={`${m.map}-${i}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '100px 120px 1fr 1fr 80px',
                  gap: 6,
                  padding: '9px 10px',
                  borderRadius: 8,
                  marginBottom: 4,
                  background: 'rgba(255,255,255,.03)',
                  border: '1px solid rgba(72, 235, 39, 0.05)',
                  alignItems: 'center',
                  transition: 'background .2s',
                  cursor: 'default',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement
                  el.style.background = 'rgba(255,255,255,.06)'
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement
                  el.style.background = 'rgba(43, 255, 15, 0.03)'
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: "'Rajdhani',sans-serif" }}>{m.map}</span>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color:
                      m.resultTone === 'win-a'
                        ? '#4ade80'
                        : m.resultTone === 'win-b'
                        ? '#ff5e14f5'
                        : m.resultTone === 'draw'
                        ? '#f5c842'
                        : 'rgba(255,255,255,.45)',
                    fontFamily: "'Rajdhani',sans-serif",
                    letterSpacing: 1,
                  }}
                >
                  {m.result}
                </span>
                <span
                  style={{
                    fontSize: 15,
                    color: 'rgb(255, 250, 250)',
                    fontFamily: "'Rajdhani',sans-serif",
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {m.teamA}
                </span>
                <span
                  style={{
                    fontSize: 15,
                    color: 'rgb(255, 255, 255)',
                    fontFamily: "'Rajdhani',sans-serif",
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {m.teamB}
                </span>
                <span style={{ fontSize: 17, color: 'rgb(255, 255, 255)', fontFamily: "'Rajdhani',sans-serif" }}>{m.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

function OnlinePlayersPanel({ players }: { players: OnlinePlayer[] }) {
  return (
    <Card title="Jogadores Online" titleStyle={{ paddingLeft: 5, marginTop: 2 }}>
      {players.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '14px 8px',
            color: 'rgba(255,255,255,.35)',
            fontFamily: "'Rajdhani',sans-serif",
          }}
        >
          Nenhum jogador online no momento.
        </div>
      ) : (
        <div style={{ maxHeight: 325, overflowY: 'auto', padding: '0 5px' }}>
          {players.map((p, i) => (
            <div
              key={`${p.id}-${i}`}
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
              <PlayerAvatar nome={p.nome} imagem={p.imagem} color="#4ade80" size={30} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 13,
                    color: '#fff',
                    fontWeight: 700,
                    fontFamily: "'Rajdhani',sans-serif",
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: 1.1,
                  }}
                >
                  {p.nome}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: 'rgba(255,255,255,.32)',
                    fontFamily: "'Rajdhani',sans-serif",
                    marginTop: 2,
                  }}
                >
                  {p.lastSeen ? `Ativo: ${relativeDate(p.lastSeen)}` : 'Online agora'}
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
          ))}
        </div>
      )}
    </Card>
  )
}

export default function HomePage({ setPage }: { setPage: (p: any) => void }) {
  const { isAdmin, isLogged, user, jogadorId } = useAuth()

  const { data: homeData, isPending: loading, error: homeError } = useQuery({
    queryKey: ['home-dashboard', isLogged, user?.nome, jogadorId],
    queryFn: async () => {
      const onlinePromise = isLogged
        ? api
            .mixHeartbeat()
            .catch(() => null)
            .then(() => api.mixOnline().catch(() => []))
        : Promise.resolve([])

      const [jogs, parts, albumRaw, onlineRaw] = await Promise.all([
        api.listarJogadores({ seasonId: 2 }).catch((e: any) => {
          throw new Error(e?.message || 'Erro ao carregar ranking')
        }),
        api.listarPartidas(undefined, { seasonId: 2 }).catch((e: any) => {
          throw new Error(e?.message || 'Erro ao carregar partidas')
        }),
        isLogged ? api.meuAlbum().catch(() => null) : Promise.resolve(null),
        onlinePromise,
      ])

      const ranking = [...(Array.isArray(jogs) ? jogs : [])].sort(
        (a, b) => Number(b.pontos || 0) - Number(a.pontos || 0)
      )

      const recents = [...(Array.isArray(parts) ? parts : [])].sort((a, b) => {
        const ta = parseMatchTs(String(a?.created_at || a?.data || ''))
        const tb = parseMatchTs(String(b?.created_at || b?.data || ''))
        return tb - ta
      })

      const onlineList = (Array.isArray(onlineRaw) ? onlineRaw : [])
        .map((o: any, idx: number) => ({
          id: Number(o?.jogador_id || o?.id || idx + 1),
          nome: String(o?.nome || '').trim(),
          imagem:
            String(o?.imagem || o?.jogador_imagem || o?.avatar || '').trim() || undefined,
          lastSeen: String(o?.last_seen || '').trim() || undefined,
        }))
        .filter((o) => !!o.nome)

      if (isLogged && user?.nome) {
        const myName = String(user.nome).trim().toLowerCase()
        const myJogadorId = Number(jogadorId || (user as any)?.jogador_id || 0)
        const alreadyExists = onlineList.some((o) => {
          const sameId = myJogadorId > 0 && Number(o.id) === myJogadorId
          const sameName = String(o.nome || '').trim().toLowerCase() === myName
          return sameId || sameName
        })

        if (!alreadyExists) {
          onlineList.unshift({
            id: myJogadorId > 0 ? myJogadorId : Number((user as any)?.id || Date.now()),
            nome: String(user.nome),
            imagem:
              String(
                (user as any)?.imagem ||
                  (user as any)?.jogador_imagem ||
                  (user as any)?.avatar ||
                  ''
              ).trim() || undefined,
            lastSeen: new Date().toISOString(),
          })
        }
      }

      let album = { obtidas: 0, total: 0, lendarias: 0, pacotesAbertos: 0 }
      if (albumRaw) {
        const payload = (albumRaw as any)?.resultados ?? albumRaw
        const figurinhas: AlbumFigurinha[] = Array.isArray(payload?.figurinhas)
          ? payload.figurinhas
          : []
        const obtidas =
          Number(payload?.progresso?.obtidas ?? 0) ||
          figurinhas.filter((f) => !!f.possui).length
        const total = Number(payload?.progresso?.total ?? figurinhas.length)
        const lendarias = figurinhas.filter((f) => {
          const raridade = String(f?.raridade || '').toLowerCase()
          return !!f.possui && ['lendaria', 'mitica', 'god'].includes(raridade)
        }).length

        album = { obtidas, total, lendarias, pacotesAbertos: Math.floor(obtidas / 4) }
      }

      return { jogadores: ranking, partidas: recents, onlinePlayers: onlineList, album }
    },
  })

  const jogadores = homeData?.jogadores ?? []
  const partidas = homeData?.partidas ?? []
  const onlinePlayers = homeData?.onlinePlayers ?? []
  const album = homeData?.album ?? { obtidas: 0, total: 0, lendarias: 0, pacotesAbertos: 0 }
  const fetchError = homeError ? (homeError as any)?.message || 'Falha ao carregar dashboard' : ''

  const totalPartidas = partidas.length
  const totalGold = jogadores.reduce((sum, j) => sum + Number(j.gold || 0), 0)
  const albumPct = album.total > 0 ? Math.round((album.obtidas / album.total) * 100) : 0

  const partidasSemana = useMemo(() => {
    const limit = Date.now() - 7 * 24 * 60 * 60 * 1000
    return partidas.filter((p) => {
      const ts = parseMatchTs(readMatchDateField(p))
      return Number.isFinite(ts) && ts >= limit
    }).length
  }, [partidas])

  const mapStats = useMemo<MapStat[]>(() => {
    const counts = new Map<string, number>()
    for (const p of partidas) {
      const mapName = String(p.mapa || '').trim()
      if (!mapName) continue
      counts.set(mapName, (counts.get(mapName) || 0) + 1)
    }

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, matches], idx) => {
        const winRate = totalPartidas > 0 ? Math.round((matches / totalPartidas) * 100) : 0
        return {
          name,
          matches,
          winRate,
          color: MAP_COLORS[idx % MAP_COLORS.length],
          image: mapImage(name),
        }
      })
  }, [partidas, totalPartidas])

  const ranking = useMemo<RankingEntry[]>(() => {
    return jogadores.slice(0, 5).map((j, idx) => ({
      pos: idx + 1,
      id: j.id,
      name: j.nome,
      pts: Number(j.pontos || 0),
      avatar: j.nome?.[0]?.toUpperCase() ?? '?',
      color: RANK_COLORS[idx % RANK_COLORS.length],
      online: idx % 2 === 0,
      imagem: j.imagem,
    }))
  }, [jogadores])

  const recent = useMemo<RecentEntry[]>(() => {
    return partidas.slice(0, 5).map((p) => {
      const scoreA = readScoreA(p)
      const scoreB = readScoreB(p)
      const teamA = readTeamA(p)
      const teamB = readTeamB(p)

      let result = 'N/A'
      let resultTone: RecentEntry['resultTone'] = 'na'
      if (scoreA !== null && scoreB !== null) {
        if (scoreA > scoreB) {
          result = `${scoreA} x ${scoreB}`
          resultTone = 'win-a'
        } else if (scoreB > scoreA) {
          result = `${scoreA} x ${scoreB}`
          resultTone = 'win-b'
        } else {
          result = `${scoreA} x ${scoreB}`
          resultTone = 'draw'
        }
      }

      return {
        map: p.mapa || 'Sem mapa',
        result,
        resultTone,
        teamA,
        teamB,
        date: formatMatchDate(readMatchDateField(p)),
      }
    })
  }, [partidas])

  const heroStats = [
    { label: 'Jogadores Ativos', value: loading ? '—' : fmtInt(jogadores.length), color: '#22d3ee' },
    { label: 'Partidas Importadas', value: loading ? '—' : fmtInt(totalPartidas), color: '#c084fc' },
    { label: 'Figurinhas Criadas', value: loading ? '—' : fmtInt(album.total), color: '#f5c842' },
  ]

  const homeStats: HomeStat[] = [
    {
      label: 'Partidas',
      value: totalPartidas,
      suffix: '',
      icon: '⚔️',
      color: '#22d3ee',
      sub: `+${fmtInt(partidasSemana)} essa semana`,
    },
    {
      label: 'Gold Total',
      value: totalGold,
      suffix: 'K',
      icon: '🪙',
      color: '#f5c842',
      sub: 'em circulação',
    },
    {
      label: 'Pacotes Abertos',
      value: album.pacotesAbertos,
      suffix: '',
      icon: '📦',
      color: '#c084fc',
      sub: `${fmtInt(album.lendarias)} lendárias`,
    },
    {
      label: 'Álbum',
      value: albumPct,
      suffix: '%',
      icon: '📋',
      color: '#4ade80',
      sub: `${fmtInt(album.obtidas)}/${fmtInt(album.total)} figurinhas`,
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 18,
          padding: '30px 34px',
          background:
            'linear-gradient(135deg, rgba(192,132,252,.1) 0%, rgba(129,140,248,.07) 50%, rgba(34,211,238,.06) 100%)',
          border: '1px solid rgba(192,132,252,.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 18,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(192,132,252,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(192,132,252,.04) 1px,transparent 1px)',
            backgroundSize: '44px 44px',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '25%',
            transform: 'translate(-50%,-50%)',
            width: 500,
            height: 200,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse,rgba(192,132,252,.07) 0%,transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div
            style={{
              fontSize: 11,
              color: 'rgba(192,132,252,.7)',
              letterSpacing: 3,
              textTransform: 'uppercase',
              marginBottom: 8,
              fontFamily: "'Rajdhani',sans-serif",
              fontWeight: 700,
            }}
          >
            ✦ Temporada 2 — Ativa
          </div>
          <h1
            style={{
              fontFamily: "'Orbitron',monospace",
              fontSize: 34,
              fontWeight: 900,
              color: '#fff',
              margin: 0,
              lineHeight: 1.1,
              letterSpacing: 2,
            }}
          >
            MIX <span style={{ color: '#c084fc' }}>AWARDS</span>
          </h1>
          <p
            style={{
              fontSize: 14,
              color: 'rgba(255,255,255,.45)',
              marginTop: 8,
              marginBottom: 22,
              maxWidth: 380,
              fontFamily: "'Rajdhani',sans-serif",
              lineHeight: 1.5,
            }}
          >
            Plataforma gamificada de estatísticas, ranking e álbum de figurinhas baseada em suas partidas reais.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {isAdmin && (
              <button
                onClick={() => setPage('importar')}
                style={{
                  background: 'linear-gradient(135deg,#c084fc,#818cf8)',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 22px',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 12,
                  letterSpacing: 1.5,
                  cursor: 'pointer',
                  boxShadow: '0 0 24px rgba(192,132,252,.4)',
                  fontFamily: "'Rajdhani',sans-serif",
                }}
              >
                IMPORTAR PARTIDA
              </button>
            )}
            <button
              onClick={() => setPage('dashboard')}
              style={{
                background: 'rgba(255,255,255,.07)',
                border: '1px solid rgba(255,255,255,.18)',
                borderRadius: 8,
                padding: '10px 22px',
                color: 'rgba(255,255,255,.8)',
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: 1.5,
                cursor: 'pointer',
                fontFamily: "'Rajdhani',sans-serif",
              }}
            >
              MEU DASHBOARD
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', zIndex: 1 }}>
          {heroStats.map((s) => (
            <div
              key={s.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                background: 'rgba(0,0,0,.3)',
                border: `1px solid ${s.color}22`,
                borderRadius: 10,
                padding: '10px 16px',
                minWidth: 190,
              }}
            >
              <div
                style={{
                  fontFamily: "'Orbitron',monospace",
                  fontSize: 22,
                  fontWeight: 700,
                  color: s.color,
                  lineHeight: 1,
                }}
              >
                {s.value}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,.4)',
                  lineHeight: 1.3,
                  fontFamily: "'Rajdhani',sans-serif",
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3.5 grid-cols-1 xl:grid-cols-4 items-start">
        <div className="xl:col-span-3 flex flex-col gap-3.5">
          <div className="grid gap-3.5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
            {homeStats.slice(0, 3).map((s, i) => (
              <HomeStatCard key={s.label} stat={s} delay={i * 80} />
            ))}
          </div>

          {!!fetchError && (
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
              Falha ao carregar dados do dashboard: {fetchError}
            </div>
          )}

          <MapPanel maps={mapStats} />
          <RecentMatchesPanel recent={recent} />
        </div>

        <div className="xl:col-span-1 flex flex-col gap-3.5">
          <HomeStatCard stat={homeStats[3]} delay={240} />
          <RankingPanel ranking={ranking} setPage={setPage} />
          <OnlinePlayersPanel players={onlinePlayers} />
        </div>
      </div>
    </div>
  )
}
