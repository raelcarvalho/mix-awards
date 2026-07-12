import { useEffect, useMemo, useState, type MouseEvent, type ReactElement, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import * as mixApi from '@/api/mixawards'
import type { Retrospectiva } from '@/api/mixawards'

const MONO = "'Share Tech Mono','JetBrains Mono','Courier New',monospace"

interface Props {
  open: boolean
  onClose: () => void
}

interface Slide {
  key: string
  render: (r: Retrospectiva) => ReactElement
}

function Big({ children, cor = '#fff' }: { children: ReactNode; cor?: string }) {
  return (
    <div
      style={{
        fontFamily: "'Rajdhani',sans-serif",
        fontSize: 'clamp(40px, 8vw, 72px)',
        fontWeight: 800,
        color: cor,
        textShadow: `0 0 30px ${cor}55`,
        lineHeight: 1.05,
      }}
    >
      {children}
    </div>
  )
}

function Label({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: 3, color: 'rgba(255,255,255,.55)' }}>
      {children}
    </div>
  )
}

const SLIDES: Slide[] = [
  {
    key: 'intro',
    render: (r) => (
      <>
        <Label>MIX AWARDS · {r.season}</Label>
        <Big cor="#4ade80">SUA RETROSPECTIVA</Big>
        <div style={{ fontFamily: MONO, fontSize: 16, color: '#fff' }}>{r.jogador.nome}</div>
        <Label>TOQUE PARA AVANÇAR →</Label>
      </>
    ),
  },
  {
    key: 'partidas',
    render: (r) => (
      <>
        <Label>NESTA TEMPORADA VOCÊ JOGOU</Label>
        <Big cor="#c084fc">{r.resumo.partidas} PARTIDAS</Big>
        <div style={{ fontFamily: MONO, fontSize: 15, color: '#fff' }}>
          {r.resumo.winrate}% de win rate · {r.resumo.partidas - r.derrotas} vitórias · {r.derrotas} derrotas
        </div>
      </>
    ),
  },
  {
    key: 'frags',
    render: (r) => (
      <>
        <Label>SEU PODER DE FOGO</Label>
        <Big cor="#f87171">{r.resumo.kills} KILLS</Big>
        <div style={{ fontFamily: MONO, fontSize: 15, color: '#fff' }}>
          {r.resumo.kdr} KDR · {r.resumo.adr} ADR · {r.assistencias} assistências
        </div>
        <div style={{ fontFamily: MONO, fontSize: 13, color: 'rgba(255,255,255,.6)' }}>
          {r.resumo.first_kill} first kills · {r.resumo.multi_kill} multi kills · {r.resumo.flash_assist} flash assists
        </div>
      </>
    ),
  },
  {
    key: 'mapas',
    render: (r) => {
      const maisJogado = r.mapas[0]
      const melhor = [...r.mapas]
        .filter((m) => m.jogos >= 3)
        .sort((a, b) => b.winrate - a.winrate)[0]
      return (
        <>
          <Label>SEUS MAPAS</Label>
          {maisJogado && (
            <Big cor="#fbbf24">{String(maisJogado.mapa).toUpperCase()}</Big>
          )}
          {maisJogado && (
            <div style={{ fontFamily: MONO, fontSize: 15, color: '#fff' }}>
              foi seu mapa mais jogado — {maisJogado.jogos} jogos ({maisJogado.winrate}% WR)
            </div>
          )}
          {melhor && melhor.mapa !== maisJogado?.mapa && (
            <div style={{ fontFamily: MONO, fontSize: 13, color: 'rgba(255,255,255,.6)' }}>
              melhor aproveitamento: {String(melhor.mapa).toUpperCase()} com {melhor.winrate}% WR
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 360, marginTop: 8 }}>
            {r.mapas.slice(0, 5).map((m) => (
              <div key={m.mapa} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: MONO, fontSize: 11, color: '#fff', width: 90, textAlign: 'left' }}>
                  {String(m.mapa).toUpperCase()}
                </span>
                <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,.08)', borderRadius: 4 }}>
                  <div
                    style={{
                      width: `${Math.min(100, m.winrate)}%`,
                      height: '100%',
                      borderRadius: 4,
                      background: m.winrate >= 50 ? '#4ade80' : '#f87171',
                    }}
                  />
                </div>
                <span style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(255,255,255,.7)', width: 74, textAlign: 'right' }}>
                  {m.jogos}j · {m.winrate}%
                </span>
              </div>
            ))}
          </div>
        </>
      )
    },
  },
  {
    key: 'melhor-partida',
    render: (r) =>
      r.melhor_partida ? (
        <>
          <Label>SUA MELHOR PARTIDA</Label>
          <Big cor="#22d3ee">{r.melhor_partida.kills} KILLS</Big>
          <div style={{ fontFamily: MONO, fontSize: 15, color: '#fff' }}>
            {String(r.melhor_partida.mapa).toUpperCase()} · {r.melhor_partida.placar} ·{' '}
            {r.melhor_partida.vitoria ? 'VITÓRIA' : 'DERROTA'}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 13, color: 'rgba(255,255,255,.6)' }}>
            {r.melhor_partida.kills}/{r.melhor_partida.mortes}/{r.melhor_partida.assistencias} · {r.melhor_partida.adr} ADR
          </div>
          <div style={{ fontFamily: MONO, fontSize: 13, color: 'rgba(255,255,255,.6)' }}>
            melhor sequência da temporada: {r.melhor_streak} vitórias seguidas 🔥
          </div>
        </>
      ) : (
        <Label>SEM PARTIDAS REGISTRADAS</Label>
      ),
  },
  {
    key: 'parceiro',
    render: (r) =>
      r.parceiro ? (
        <>
          <Label>SEU PARCEIRO DE MIX</Label>
          <Big cor="#f472b6">{r.parceiro.nome}</Big>
          <div style={{ fontFamily: MONO, fontSize: 15, color: '#fff' }}>
            {r.parceiro.jogos_juntos} partidas no mesmo time
          </div>
          <div style={{ fontFamily: MONO, fontSize: 13, color: 'rgba(255,255,255,.6)' }}>
            {r.parceiro.winrate_juntos}% de win rate jogando juntos
          </div>
        </>
      ) : (
        <Label>VOCÊ É UM LOBO SOLITÁRIO 🐺</Label>
      ),
  },
  {
    key: 'ranking',
    render: (r) => (
      <>
        <Label>POSIÇÃO FINAL NO RANKING</Label>
        <Big cor="#fbbf24">#{r.posicao_ranking}</Big>
        <div style={{ fontFamily: MONO, fontSize: 15, color: '#fff' }}>
          de {r.total_jogadores} jogadores · {r.resumo.pontos} pontos
        </div>
        <div style={{ fontFamily: MONO, fontSize: 13, color: 'rgba(255,255,255,.6)' }}>
          você está no top {r.percentil}% do mix
        </div>
        <Label>OBRIGADO PELA TEMPORADA. NOS VEMOS NA PRÓXIMA. 🏆</Label>
      </>
    ),
  },
]

export default function RetrospectivaModal({ open, onClose }: Props) {
  const [data, setData] = useState<Retrospectiva | null>(null)
  const [erro, setErro] = useState('')
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (!open) return
    setIdx(0)
    setErro('')
    mixApi
      .getRetrospectiva()
      .then(setData)
      .catch((e: any) => setErro(e?.message || 'Erro ao carregar retrospectiva.'))
  }, [open])

  const slides = useMemo(() => SLIDES, [])

  if (!open) return null

  const avancar = () => {
    if (idx >= slides.length - 1) onClose()
    else setIdx((i) => i + 1)
  }
  const voltar = (e: MouseEvent) => {
    e.stopPropagation()
    setIdx((i) => Math.max(0, i - 1))
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={avancar}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 300,
          background: 'radial-gradient(ellipse at 50% 30%, #101426 0%, #05060d 70%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 24,
        }}
      >
        {/* Barra de progresso estilo stories */}
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            right: 16,
            display: 'flex',
            gap: 6,
          }}
        >
          {slides.map((s, i) => (
            <div key={s.key} style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(255,255,255,.15)' }}>
              <div
                style={{
                  width: i <= idx ? '100%' : '0%',
                  height: '100%',
                  borderRadius: 2,
                  background: '#4ade80',
                  transition: 'width .3s',
                }}
              />
            </div>
          ))}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          style={{
            position: 'absolute',
            top: 30,
            right: 20,
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,.7)',
            fontSize: 26,
            cursor: 'pointer',
          }}
          aria-label="Fechar"
        >
          ✕
        </button>

        {idx > 0 && (
          <button
            onClick={voltar}
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,.5)',
              fontSize: 30,
              cursor: 'pointer',
            }}
            aria-label="Voltar"
          >
            ‹
          </button>
        )}

        {erro && (
          <div style={{ fontFamily: MONO, color: '#f87171', fontSize: 14 }}>{erro}</div>
        )}
        {!erro && !data && (
          <div style={{ fontFamily: MONO, color: 'rgba(255,255,255,.6)', fontSize: 14 }}>
            CARREGANDO SUA TEMPORADA...
          </div>
        )}
        {data && (
          <AnimatePresence mode="wait">
            <motion.div
              key={slides[idx].key}
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: 16,
                maxWidth: 560,
              }}
            >
              {slides[idx].render(data)}
            </motion.div>
          </AnimatePresence>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
