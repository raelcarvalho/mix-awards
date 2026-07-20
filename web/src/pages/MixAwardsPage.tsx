import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import * as mixApi from '@/api/mixawards'
import type { AwardFile, AwardJogador, FinalReport } from '@/api/mixawards'

const MONO = "'Share Tech Mono','JetBrains Mono','Courier New',monospace"
const DISPLAY = "'Rajdhani',system-ui,sans-serif"
const GOLD = '#f6c453'
const GOLD_SOFT = 'rgba(246,196,83,.22)'
const BURGUNDY = '#7f1d2d'
const PURPLE = '#a78bfa'
const CYAN = '#67e8f9'
const PAPER = '#fff7df'
const TEXT = '#fffaf0'
const MUTED = 'rgba(255,250,240,.64)'
const STORAGE_KEY = 'mixawards:season-2-night:reveals'

type RevealState = Record<string, boolean>
type AwardStage = 'sealed' | 'nominees' | 'revealed'

function loadReveals(): RevealState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveReveals(state: RevealState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function normalizeAvatar(raw?: string | null): string | null {
  const src = String(raw || '').trim()
  if (!src) return null
  if (/^data:/i.test(src) || /^https?:\/\//i.test(src) || src.startsWith('/')) return src
  return `/${src.replace(/^\/+/, '')}`
}

function useCountdown(target: string | null) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  if (!target) return null
  const diff = new Date(target).getTime() - now
  if (diff <= 0) return null

  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)

  return [
    { label: 'DIAS', value: days },
    { label: 'HORAS', value: hours },
    { label: 'MIN', value: minutes },
    { label: 'SEG', value: seconds },
  ]
}

function playRevealSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const gain = ctx.createGain()
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0.001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7)

    ;[523.25, 659.25, 783.99].forEach((freq, index) => {
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.08)
      osc.connect(gain)
      osc.start(ctx.currentTime + index * 0.08)
      osc.stop(ctx.currentTime + 0.72)
    })

    window.setTimeout(() => ctx.close().catch(() => {}), 900)
  } catch {
    // Som é só um acabamento da revelação; falhas de autoplay não devem quebrar a cerimônia.
  }
}

function metricLabel(file: AwardFile, value?: number) {
  const v = Number(value ?? file.valor ?? 0)
  switch (file.codigo) {
    case 'mvp_temporada':
      return `${Math.round(v)} pts`
    case 'maior_winrate':
      return `${v.toFixed(1)}% WR`
    case 'maratonista':
      return `${Math.round(v)} partidas`
    case 'rei_do_adr':
      return `${v.toFixed(1)} ADR`
    case 'exterminador':
      return `${Math.round(v)} kills`
    case 'flash_master':
      return `${Math.round(v)} flash assists`
    case 'entry_king':
      return `${Math.round(v)} first kills`
    case 'mais_consistente':
      return `${v.toFixed(1)} KAST`
    default:
      return String(v)
  }
}

function PlayerPortrait({
  jogador,
  size = 104,
  glow = GOLD,
}: {
  jogador: AwardJogador
  size?: number
  glow?: string
}) {
  const avatar = normalizeAvatar(jogador.imagem)
  const moldura = normalizeAvatar(jogador.moldura_equipada)
  const imageSize = Math.round(size * 0.82)
  const imageInset = Math.round((size - imageSize) / 2)

  return (
    <div style={{ position: 'relative', width: size, height: size, flex: '0 0 auto' }}>
      {avatar ? (
        <img
          src={avatar}
          alt={jogador.nome}
          style={{
            position: 'absolute',
            inset: imageInset,
            width: imageSize,
            height: imageSize,
            borderRadius: '50%',
            objectFit: 'cover',
            border: `2px solid ${glow}`,
            boxShadow: `0 0 24px ${glow}55`,
          }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: imageInset,
            width: imageSize,
            height: imageSize,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(255,255,255,.08)',
            color: glow,
            border: `2px solid ${glow}`,
            fontFamily: DISPLAY,
            fontSize: 30,
            fontWeight: 800,
          }}
        >
          {jogador.nome.slice(0, 1).toUpperCase()}
        </div>
      )}
      {moldura && (
        <img
          src={moldura}
          alt=""
          style={{
            position: 'absolute',
            inset: -Math.round(size * 0.07),
            width: Math.round(size * 1.14),
            height: Math.round(size * 1.14),
            objectFit: 'contain',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  )
}

function ConfettiBurst({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div className="awards-confetti" aria-hidden="true">
      {Array.from({ length: 22 }).map((_, i) => (
        <span
          key={i}
          style={
            {
              '--x': `${(i % 11) * 18 - 90}px`,
              '--delay': `${(i % 5) * 38}ms`,
              '--color': [GOLD, PAPER, BURGUNDY, PURPLE, CYAN][i % 5],
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}

function NomineeRow({
  nominee,
  index,
  file,
}: {
  nominee: AwardJogador
  index: number
  file: AwardFile
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="nominee-row"
    >
      <div className="nominee-rank">#{index + 1}</div>
      <PlayerPortrait jogador={nominee} size={44} glow={index === 0 ? GOLD : PURPLE} />
      <div className="nominee-main">
        <span>{nominee.nome}</span>
        <small>{metricLabel(file, nominee.valor)}</small>
      </div>
    </motion.div>
  )
}

function AwardEnvelopeCard({
  file,
  liberado,
  revealed,
  onRevealed,
}: {
  file: AwardFile
  liberado: boolean
  revealed: boolean
  onRevealed: () => void
}) {
  const [stage, setStage] = useState<AwardStage>(revealed ? 'revealed' : 'sealed')
  const [confetti, setConfetti] = useState(false)
  const flipped = stage === 'revealed'

  useEffect(() => {
    if (!confetti) return
    const id = window.setTimeout(() => setConfetti(false), 1200)
    return () => window.clearTimeout(id)
  }, [confetti])

  const revealWinner = () => {
    if (!file.jogador) return
    playRevealSound()
    setStage('revealed')
    setConfetti(true)
    onRevealed()
  }

  return (
    <div className="award-card-shell">
      <motion.div
        className="award-card-flip"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          className="award-card award-card-front"
          onClick={() => {
            if (stage === 'sealed' && liberado && file.jogador) setStage('nominees')
          }}
        >
          {stage === 'sealed' && (
            <div className="envelope-face">
              <div className="award-number">{file.file}</div>
              <div className="envelope-mark" aria-hidden="true">
                <span />
              </div>
              <h3>{file.titulo}</h3>
              <p>{file.descricao}</p>
              <button type="button" className="award-action" disabled={!liberado || !file.jogador}>
                {liberado ? 'Ver indicados' : 'Em breve'}
              </button>
            </div>
          )}

          {stage === 'nominees' && (
            <div className="nominees-face">
              <div className="award-kicker">Indicados</div>
              <h3>{file.titulo}</h3>
              <div className="nominee-list">
                {file.indicados.slice(0, 5).map((nominee, index) => (
                  <NomineeRow key={`${file.codigo}-${nominee.id}`} nominee={nominee} index={index} file={file} />
                ))}
              </div>
              <button
                type="button"
                className="award-action award-action-primary"
                onClick={(event) => {
                  event.stopPropagation()
                  revealWinner()
                }}
              >
                Abrir envelope
              </button>
            </div>
          )}
        </div>

        <div className="award-card award-card-back">
          <ConfettiBurst active={confetti} />
          {file.jogador && (
            <div className="winner-face">
              <div className="award-kicker">Vencedor</div>
              <PlayerPortrait jogador={file.jogador} size={124} glow={GOLD} />
              <h3>{file.jogador.nome}</h3>
              <p>{file.titulo}</p>
              <strong>{metricLabel(file)}</strong>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default function MixAwardsPage() {
  const [reveals, setReveals] = useState<RevealState>(() => loadReveals())

  const {
    data: report = null,
    isPending: loading,
    error: reportError,
  } = useQuery({
    queryKey: ['mix-awards-final-report'],
    queryFn: () => mixApi.getFinalReport(),
  })

  const erro = reportError
    ? (reportError as any)?.status === 401
      ? 'Faça login para acessar a cerimônia do Mix Awards.'
      : (reportError as any)?.message || 'Erro ao carregar a cerimônia.'
    : ''

  const countdown = useCountdown(report && !report.liberado ? report.reveal_at : null)
  const liberado = !!report && (report.liberado || report.preview_admin)
  const categories = useMemo(() => report?.files || [], [report])

  const markRevealed = useCallback((codigo: string) => {
    setReveals((prev) => {
      const next = { ...prev, [codigo]: true }
      saveReveals(next)
      return next
    })
  }, [])

  return (
    <div className="awards-page">
      <style>{`
        .awards-page {
          display: flex;
          flex-direction: column;
          gap: 28px;
          padding-bottom: 48px;
          color: ${TEXT};
        }
        .awards-hero {
          position: relative;
          min-height: 260px;
          overflow: hidden;
          border: 1px solid rgba(246,196,83,.26);
          border-radius: 8px;
          background:
            linear-gradient(115deg, rgba(127,29,45,.78), rgba(9,7,11,.94) 45%, rgba(20,16,12,.98)),
            repeating-linear-gradient(90deg, rgba(246,196,83,.06) 0 1px, transparent 1px 16px);
          box-shadow: 0 22px 70px rgba(0,0,0,.32);
          padding: clamp(28px, 5vw, 56px) 22px;
          text-align: center;
        }
        .awards-hero::before,
        .awards-hero::after {
          content: '';
          position: absolute;
          top: -20%;
          bottom: -20%;
          width: 22%;
          opacity: .5;
          background: linear-gradient(90deg, transparent, rgba(246,196,83,.18), transparent);
          transform: rotate(12deg);
          pointer-events: none;
        }
        .awards-hero::before { left: 8%; }
        .awards-hero::after { right: 8%; transform: rotate(-12deg); }
        .awards-hero h1 {
          position: relative;
          margin: 0;
          font-family: ${DISPLAY};
          font-size: clamp(42px, 8vw, 88px);
          line-height: .92;
          font-weight: 900;
          letter-spacing: 0;
          color: ${PAPER};
          text-shadow: 0 0 34px rgba(246,196,83,.36);
          text-transform: uppercase;
        }
        .awards-season {
          position: relative;
          margin-top: 12px;
          font-family: ${MONO};
          font-size: 12px;
          letter-spacing: 4px;
          color: ${GOLD};
          text-transform: uppercase;
        }
        .countdown-grid {
          position: relative;
          width: min(520px, 100%);
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin: 24px auto 0;
        }
        .countdown-cell {
          min-height: 74px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(246,196,83,.28);
          border-radius: 8px;
          background: rgba(8,6,9,.58);
        }
        .countdown-cell strong {
          display: block;
          font-family: ${DISPLAY};
          font-size: clamp(28px, 5vw, 42px);
          line-height: .9;
          color: ${GOLD};
        }
        .countdown-cell span {
          display: block;
          margin-top: 6px;
          font-family: ${MONO};
          font-size: 10px;
          letter-spacing: 2px;
          color: ${MUTED};
        }
        .ceremony-live {
          position: relative;
          display: inline-flex;
          align-items: center;
          min-height: 46px;
          margin-top: 24px;
          padding: 0 18px;
          border-radius: 999px;
          border: 1px solid rgba(246,196,83,.38);
          background: rgba(246,196,83,.1);
          font-family: ${MONO};
          color: ${GOLD};
          letter-spacing: 2px;
          text-transform: uppercase;
        }
        .section-title {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 16px;
          border-bottom: 1px solid rgba(255,255,255,.1);
          padding-bottom: 12px;
        }
        .section-title h2 {
          margin: 0;
          font-family: ${DISPLAY};
          font-size: clamp(26px, 4vw, 40px);
          letter-spacing: 0;
          color: ${TEXT};
          text-transform: uppercase;
        }
        .section-title span {
          font-family: ${MONO};
          font-size: 12px;
          letter-spacing: 2px;
          color: ${GOLD};
          text-transform: uppercase;
        }
        .awards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 18px;
        }
        .award-card-shell {
          perspective: 1200px;
          min-height: 390px;
        }
        .award-card-flip {
          position: relative;
          height: 100%;
          min-height: 390px;
          transform-style: preserve-3d;
        }
        .award-card {
          position: absolute;
          inset: 0;
          overflow: hidden;
          backface-visibility: hidden;
          border-radius: 8px;
          border: 1px solid rgba(246,196,83,.26);
          background:
            linear-gradient(180deg, rgba(35,12,18,.98), rgba(9,7,11,.98)),
            repeating-linear-gradient(0deg, rgba(255,255,255,.035) 0 1px, transparent 1px 12px);
          box-shadow: 0 18px 50px rgba(0,0,0,.26);
        }
        .award-card-back {
          transform: rotateY(180deg);
          border-color: rgba(246,196,83,.58);
          background:
            radial-gradient(circle at 50% 18%, rgba(246,196,83,.18), transparent 34%),
            linear-gradient(180deg, rgba(72,24,34,.98), rgba(11,8,10,.98));
        }
        .envelope-face,
        .nominees-face,
        .winner-face {
          min-height: 390px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 22px;
        }
        .envelope-face {
          justify-content: space-between;
          cursor: pointer;
        }
        .award-number,
        .award-kicker {
          font-family: ${MONO};
          font-size: 11px;
          letter-spacing: 3px;
          color: ${GOLD};
          text-transform: uppercase;
        }
        .envelope-mark {
          position: relative;
          width: 148px;
          height: 96px;
          margin: 10px 0 2px;
          border-radius: 8px;
          background: linear-gradient(145deg, #f9dfa0, #ac782b);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.36), 0 20px 36px rgba(0,0,0,.24);
        }
        .envelope-mark::before,
        .envelope-mark::after {
          content: '';
          position: absolute;
          inset: 0;
          clip-path: polygon(0 0, 50% 56%, 100% 0, 100% 100%, 0 100%);
          background: linear-gradient(180deg, rgba(255,255,255,.24), rgba(127,29,45,.2));
        }
        .envelope-mark span {
          position: absolute;
          width: 36px;
          height: 36px;
          left: 50%;
          top: 44%;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          background: ${BURGUNDY};
          box-shadow: 0 0 0 4px rgba(127,29,45,.18);
          z-index: 2;
        }
        .award-card h3 {
          margin: 0;
          font-family: ${DISPLAY};
          font-size: 28px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: 0;
          color: ${TEXT};
          text-transform: uppercase;
        }
        .award-card p {
          margin: 10px 0 0;
          font-family: ${MONO};
          font-size: 12px;
          line-height: 1.55;
          letter-spacing: 1px;
          color: ${MUTED};
          text-transform: uppercase;
        }
        .award-action {
          min-height: 42px;
          padding: 0 16px;
          border-radius: 8px;
          border: 1px solid rgba(246,196,83,.52);
          background: rgba(246,196,83,.12);
          color: ${GOLD};
          font-family: ${MONO};
          font-size: 12px;
          letter-spacing: 2px;
          text-transform: uppercase;
          cursor: pointer;
          transition: transform .18s ease, background .18s ease, box-shadow .18s ease;
        }
        .award-action:disabled {
          cursor: default;
          opacity: .55;
        }
        .award-action:not(:disabled):hover {
          transform: translateY(-1px);
          background: rgba(246,196,83,.2);
          box-shadow: 0 0 24px rgba(246,196,83,.22);
        }
        .award-action-primary {
          width: 100%;
          margin-top: 14px;
          color: #1a1205;
          background: ${GOLD};
          font-weight: 800;
        }
        .nominees-face {
          align-items: stretch;
          gap: 12px;
        }
        .nominee-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 4px;
        }
        .nominee-row {
          min-height: 58px;
          display: grid;
          grid-template-columns: 32px 44px 1fr;
          align-items: center;
          gap: 10px;
          padding: 7px 8px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,.08);
          background: rgba(255,255,255,.045);
          text-align: left;
        }
        .nominee-rank {
          font-family: ${MONO};
          font-size: 12px;
          color: ${GOLD};
        }
        .nominee-main {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .nominee-main span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-family: ${DISPLAY};
          font-size: 17px;
          font-weight: 800;
          color: ${TEXT};
        }
        .nominee-main small {
          font-family: ${MONO};
          font-size: 11px;
          color: ${MUTED};
          text-transform: uppercase;
        }
        .winner-face {
          position: relative;
          justify-content: center;
          gap: 12px;
        }
        .winner-face h3 {
          max-width: 100%;
          overflow-wrap: anywhere;
          font-size: 34px;
          color: ${PAPER};
          text-shadow: 0 0 26px rgba(246,196,83,.35);
        }
        .winner-face strong {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 40px;
          padding: 0 14px;
          border-radius: 999px;
          background: rgba(246,196,83,.14);
          border: 1px solid rgba(246,196,83,.32);
          color: ${GOLD};
          font-family: ${MONO};
          font-size: 13px;
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        .awards-confetti {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
          z-index: 4;
        }
        .awards-confetti span {
          position: absolute;
          left: 50%;
          top: 36%;
          width: 8px;
          height: 14px;
          border-radius: 2px;
          background: var(--color);
          animation: confetti-fall 900ms ease-out forwards;
          animation-delay: var(--delay);
        }
        @keyframes confetti-fall {
          0% { transform: translate(-50%, -50%) rotate(0deg); opacity: 1; }
          100% { transform: translate(calc(-50% + var(--x)), 180px) rotate(420deg); opacity: 0; }
        }
        .awards-state {
          min-height: 160px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,.08);
          background: rgba(255,255,255,.035);
          color: ${MUTED};
          font-family: ${MONO};
          text-align: center;
          padding: 24px;
        }
        .awards-state.error {
          color: #fca5a5;
          border-color: rgba(252,165,165,.22);
        }
        @media (max-width: 720px) {
          .countdown-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .section-title {
            align-items: flex-start;
            flex-direction: column;
          }
          .awards-grid {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>

      <section className="awards-hero">
        <h1>Mix Awards 2° Season</h1>
        <div className="awards-season">Cerimônia de encerramento</div>
        {countdown ? (
          <div className="countdown-grid">
            {countdown.map((item) => (
              <div className="countdown-cell" key={item.label}>
                <div>
                  <strong>{String(item.value).padStart(2, '0')}</strong>
                  <span>{item.label}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="ceremony-live">{liberado ? 'Cerimônia liberada' : 'Aguardando cerimônia'}</div>
        )}
        {report?.preview_admin && <div className="awards-season">Preview admin</div>}
      </section>

      {loading && <div className="awards-state">Carregando cerimônia...</div>}
      {!loading && erro && <div className="awards-state error">{erro}</div>}

      {!loading && !erro && report && (
        <>
          <div className="section-title">
            <h2>Categorias da noite</h2>
            <span>{categories.length} prêmios</span>
          </div>

          <div className="awards-grid">
            {categories.map((file) => (
              <AwardEnvelopeCard
                key={file.codigo}
                file={file}
                liberado={liberado}
                revealed={!!reveals[file.codigo]}
                onRevealed={() => markRevealed(file.codigo)}
              />
            ))}
          </div>
        </>
      )}

      <AnimatePresence>
        {!loading && !erro && report && !categories.length && (
          <motion.div
            className="awards-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            Nenhuma categoria disponível.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
