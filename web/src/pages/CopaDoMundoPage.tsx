import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Card, Btn } from '@/components/ui/Card'
import { useAuth } from '@/hooks/useAuth'
import * as api from '@/services/api'
import '@/styles/album-effects.css'

const TOTAL_SLOTS = 20
const PER_PAGE = 10

interface Figurinha {
  id?: number
  slot: number
  nome: string
  imagem?: string
  raridade: 'normal' | 'epica' | 'lendaria' | 'mitica' | 'god'
  possui: boolean
  revelada?: boolean
}

interface SlotView extends Figurinha {
  nova?: boolean
}

const RARITY_STYLE: Record<
  Figurinha['raridade'],
  { color: string; label: string; glow: string; infoLabel: string; border: string; shadow: string }
> = {
  normal:   { color: '#94a3b8', label: 'Normal',   glow: 'rgba(148,163,184,.2)', infoLabel: 'Carta Normal',   border: 'rgba(0,156,59,.5)',    shadow: '0 0 10px rgba(0,156,59,.25)' },
  epica:    { color: '#a450f8', label: 'Épica',     glow: 'rgba(29, 252, 0, 0.3)', infoLabel: 'Carta Épica',    border: 'rgba(192,132,252,.6)', shadow: '0 0 14px rgba(132, 252, 186, 0.35)' },
  lendaria: { color: '#dda600', label: 'Lendária',  glow: 'rgba(245,200,66,.35)', infoLabel: 'Carta Lendária', border: 'rgba(255,223,0,.65)',  shadow: '0 0 16px rgba(255,223,0,.4)' },
  mitica:   { color: '#fd07dc', label: 'Mítica',    glow: 'rgb(15, 11, 255)', infoLabel: 'Carta Mítica',   border: 'rgba(255, 255, 255, 0.7)',  shadow: '0 0 18px rgba(76, 0, 253, 0.4)' },
  god:      { color: '#56c1ff', label: 'GOD',       glow: 'rgba(86,193,255,.5)',  infoLabel: 'Carta God',      border: 'rgba(86,193,255,.8)',  shadow: '0 0 22px rgba(86,193,255,.5)' },
}

const PRECO_REVELACAO: Record<Figurinha['raridade'], number> = {
  normal: 20,
  epica: 25,
  lendaria: 30,
  mitica: 35,
  god: 40,
}

function rarityBySlot(slot: number): Figurinha['raridade'] {
  if (slot <= 10) return 'normal'
  if (slot <= 14) return 'epica'
  if (slot <= 17) return 'lendaria'
  if (slot <= 19) return 'mitica'
  return 'god'
}

function updateHoloPointerVars(target: HTMLElement, xClient: number, yClient: number) {
  const rect = target.getBoundingClientRect()
  const x = ((xClient - rect.left) / rect.width) * 100
  const y = ((yClient - rect.top) / rect.height) * 100
  target.style.setProperty('--mouse-x', `${x}%`)
  target.style.setProperty('--mouse-y', `${y}%`)
}

function AlbumCard({
  slot,
  onClick,
  onReveal,
  revealing,
}: {
  slot: SlotView
  onClick: () => void
  onReveal: () => void
  revealing: boolean
}) {
  const rarity = RARITY_STYLE[slot.raridade]
  const locked = slot.possui && !slot.revelada

  const onMouseMove = (e: MouseEvent<HTMLButtonElement>) => {
    updateHoloPointerVars(e.currentTarget, e.clientX, e.clientY)
  }

  return (
    <div className="ma-album-slot-wrap">
      <button
        type="button"
        onClick={() => {
          if (!locked) onClick()
        }}
        onMouseMove={onMouseMove}
        className={`ma-album-slot ${slot.raridade} ${slot.possui ? 'has' : ''}`}
        title={slot.nome || `Figurinha ${slot.slot}`}
        aria-label={`Slot ${slot.slot} ${slot.nome}`}
        style={{
          border: `1.5px solid ${rarity.border}`,
          boxShadow: rarity.shadow,
        }}
      >
        <span className="rarity">{locked ? 'Bloqueado' : rarity.label}</span>
        <span className="num">{slot.slot}</span>

        {slot.possui ? (
          <>
            {slot.imagem ? (
              <div className={`ma-album-img-container ${locked ? 'dimmed' : ''}`}>
                <img
                  src={slot.imagem}
                  alt={locked ? `Figurinha ${slot.slot}` : slot.nome}
                  loading='lazy'
                  decoding='async'
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  className={slot.slot === 16 ? 'ma-album-img-pandemonium' : ''}
                  style={locked ? { pointerEvents: 'none', userSelect: 'none' } : undefined}
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              </div>
            ) : (
              <div className="ma-album-slot-empty">
                Figurinha
                <br />
                {slot.slot}
              </div>
            )}
            {!locked && <div className="ma-holo" aria-hidden="true" />}
          </>
        ) : (
          <div className="ma-album-slot-empty">
            Figurinha
            <br />
            {slot.slot}
          </div>
        )}
      </button>

      {locked && (
        <button type="button" className="ma-reveal-bar" onClick={onReveal} disabled={revealing}>
          Deseja revelar carta por <strong style={{ color: '#ffdf00' }}>{PRECO_REVELACAO[slot.raridade]} gold</strong>?
        </button>
      )}
    </div>
  )
}

function DetailModal({
  figurinha,
  onClose,
}: {
  figurinha: SlotView
  onClose: () => void
}) {
  const rarity = RARITY_STYLE[figurinha.raridade]

  const onMovePreview = (e: MouseEvent<HTMLDivElement>) => {
    updateHoloPointerVars(e.currentTarget, e.clientX, e.clientY)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="ma-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="ma-modal-shell"
        style={{
          maxWidth: 560,
          width: '95vw',
          border: '1px solid rgba(0,156,59,.55)',
          boxShadow: '0 0 0 1px rgba(255,223,0,.12), 0 24px 80px rgba(0,0,0,.7), 0 0 32px rgba(0,156,59,.2)',
          background: 'linear-gradient(180deg, rgba(0,18,8,0.98), rgba(0,10,4,0.98))',
          position: 'relative',
        }}
      >
        <button
          type="button"
          className="ma-modal-close"
          onClick={onClose}
          aria-label="Fechar"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            border: '1px solid rgba(0,156,59,.5)',
            background: 'rgba(0,20,8,.9)',
            zIndex: 2,
          }}
        >
          ×
        </button>

        <div className="ma-card-preview" onMouseMove={onMovePreview}>
          {figurinha.imagem ? (
            <img
              src={figurinha.imagem}
              alt={figurinha.nome}
              loading='lazy'
              decoding='async'
              className={figurinha.slot === 16 ? 'ma-album-img-pandemonium' : ''}
              onError={(e) => {
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          ) : (
            <div className="ma-album-slot-empty h-full flex items-center justify-center text-4xl opacity-35">
              ?
            </div>
          )}

          <div className={`ma-holo ${figurinha.raridade}`} aria-hidden="true" />
        </div>

        <div className="text-center mt-2">
          <div className={`ma-card-info ${figurinha.raridade}`}>{rarity.infoLabel}</div>
        </div>
      </div>
    </div>
  )
}

function normalizeAlbumCopa(raw: any): Figurinha[] {
  const payload = raw?.resultados ?? raw ?? {}
  const list = Array.isArray(payload?.figurinhas) ? payload.figurinhas : []

  return list.map((f: any) => ({
    id: f?.id,
    slot: Number(f?.slot),
    nome: String(f?.nome || `Figurinha ${f?.slot}`),
    imagem: f?.imagem,
    raridade: f?.raridade || 'normal',
    possui: Boolean(f?.possui),
    revelada: Boolean(f?.revelada),
  }))
}

export default function CopaDoMundoPage({ setPage }: { setPage: (p: any) => void }) {
  const { isLogged, refreshGold } = useAuth()
  const [figurinhas, setFigurinhas] = useState<Figurinha[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [selected, setSelected] = useState<SlotView | null>(null)
  const [revealingId, setRevealingId] = useState<number | null>(null)
  const [toast, setToast] = useState('')
  const toastTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current)
      }
    }
  }, [])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current)
    }
    toastTimerRef.current = window.setTimeout(() => setToast(''), 2600)
  }, [])

  const loadAlbum = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.meuAlbumCopa()
      setFigurinhas(normalizeAlbumCopa(data))
    } catch {
      setFigurinhas([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadAlbum()
  }, [loadAlbum])

  const revealCard = useCallback(
    async (figurinhaId: number | undefined) => {
      if (!figurinhaId) return
      if (!isLogged) {
        showToast('Faça login para revelar cartas.')
        return
      }

      setRevealingId(figurinhaId)
      try {
        await api.revelarCartaCopa(figurinhaId)
        setFigurinhas((prev) =>
          prev.map((f) => (f.id === figurinhaId ? { ...f, revelada: true } : f))
        )
        await refreshGold()
        showToast('✓ Carta revelada!')
      } catch (err: any) {
        showToast(err.message || 'Erro ao revelar carta')
      } finally {
        setRevealingId(null)
      }
    },
    [isLogged, refreshGold, showToast]
  )

  const totalPages = Math.max(1, Math.ceil(TOTAL_SLOTS / PER_PAGE))

  const obtidas = useMemo(() => figurinhas.filter((f) => f.possui).length, [figurinhas])
  const pct = Math.round((obtidas / TOTAL_SLOTS) * 100)

  const slotMap = useMemo(() => {
    const map = new Map<number, Figurinha>()
    for (const f of figurinhas) map.set(f.slot, f)
    return map
  }, [figurinhas])

  const pageSlots = useMemo<SlotView[]>(() => {
    const start = (currentPage - 1) * PER_PAGE + 1
    const end = Math.min(TOTAL_SLOTS, start + PER_PAGE - 1)
    const slots: SlotView[] = []
    for (let slot = start; slot <= end; slot++) {
      const found = slotMap.get(slot)
      if (found) {
        slots.push({ ...found })
      } else {
        slots.push({ slot, nome: `Figurinha ${slot}`, raridade: rarityBySlot(slot), possui: false })
      }
    }
    return slots
  }, [currentPage, slotMap])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        minHeight: '100%',
        position: 'relative',
      }}
    >
      {/* Header — layout-album.png como fundo */}
      <div
        style={{
          position: 'relative',
          borderRadius: 18,
          overflow: 'hidden',
          backgroundImage: "url('/copa/layout-album.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          padding: '28px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          minHeight: 130,
          border: '1px solid rgba(0,156,59,.4)',
          boxShadow: '0 0 24px rgba(0,156,59,.2), 0 0 48px rgba(255,223,0,.08)',
        }}
      >
        {/* overlay escuro para legibilidade do texto */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, rgba(0,8,2,0.72) 0%, rgba(0,8,2,0.45) 60%, transparent 100%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div
            style={{
              fontSize: 11,
              color: 'rgba(255,223,0,.9)',
              letterSpacing: 4,
              textTransform: 'uppercase',
              marginBottom: 4,
              fontFamily: "'Rajdhani',sans-serif",
              fontWeight: 700,
            }}
          >
            ★ COLEÇÃO
          </div>
          <h1
            style={{
              fontFamily: "'Orbitron',monospace",
              fontSize: 'clamp(22px,3vw,32px)',
              fontWeight: 900,
              margin: 0,
              letterSpacing: 3,
              background: 'linear-gradient(135deg, #009c3b 0%, #ffdf00 50%, #009c3b 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 18px rgba(255,223,0,0.5))',
            }}
          >
            MEU ÁLBUM DA COPA
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', fontFamily: "'Rajdhani',sans-serif" }}>
              {obtidas} / {TOTAL_SLOTS} figurinhas
            </div>
            <div style={{ height: 6, width: 160, background: 'rgba(255,255,255,.12)', borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: 'linear-gradient(90deg,#009c3b,#ffdf00)',
                  borderRadius: 3,
                  boxShadow: '0 0 8px rgba(255,223,0,.5)',
                  transition: 'width 1s ease',
                }}
              />
            </div>
            <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 13, fontWeight: 700, color: '#ffdf00' }}>
              {pct}%
            </div>
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn
            onClick={() => setPage('shop')}
            color="#ffdf00"
            variant="outline"
            size="lg"
            className="!text-sm sm:!text-[15px] min-h-[42px] sm:min-h-[46px] !px-4 sm:!px-5"
          >
            IR À LOJA →
          </Btn>
        </div>

      </div>

      {/* Raridade legend + paginação na mesma linha */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.values(RARITY_STYLE).map((v) => (
            <div
              key={v.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: `${v.color}0a`,
                border: `1px solid ${v.color}22`,
                borderRadius: 6,
                padding: '4px 10px',
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: v.color,
                  boxShadow: `0 0 5px ${v.color}`,
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  color: v.color,
                  fontFamily: "'Rajdhani',sans-serif",
                  fontWeight: 700,
                }}
              >
                {v.label}
              </span>
            </div>
          ))}
        </div>

        {/* Paginação — canto direito */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            style={{
              width: 29, height: 29, borderRadius: 9,
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              border: '1px solid rgba(255,255,255,.14)',
              background: 'rgba(255,255,255,.04)',
              color: currentPage === 1 ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.86)',
              fontSize: 15, fontWeight: 700,
              opacity: currentPage === 1 ? 0.6 : 1,
            }}
            aria-label="Primeira página"
          >«</button>

          <button
            type="button"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            style={{
              width: 29, height: 29, borderRadius: 9,
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              border: '1px solid rgba(255,255,255,.14)',
              background: 'rgba(255,255,255,.04)',
              color: currentPage === 1 ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.86)',
              fontSize: 15, fontWeight: 700,
              opacity: currentPage === 1 ? 0.6 : 1,
            }}
            aria-label="Página anterior"
          >‹</button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setCurrentPage(p)}
              style={{
                width: 33, height: 33, borderRadius: 9, cursor: 'pointer',
                background: currentPage === p
                  ? 'linear-gradient(180deg,#ffdf00 0%,#009c3b 100%)'
                  : 'rgba(255,255,255,.03)',
                border: `1px solid ${currentPage === p ? '#ffdf00' : 'rgba(255,255,255,.12)'}`,
                color: currentPage === p ? '#000' : 'rgba(255,255,255,.86)',
                fontSize: 15, fontWeight: 700,
                fontFamily: "'Orbitron',monospace",
              }}
            >
              {p}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            style={{
              width: 29, height: 29, borderRadius: 9,
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              border: '1px solid rgba(255,255,255,.14)',
              background: 'rgba(255,255,255,.04)',
              color: currentPage === totalPages ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.86)',
              fontSize: 15, fontWeight: 700,
              opacity: currentPage === totalPages ? 0.6 : 1,
            }}
            aria-label="Próxima página"
          >›</button>

          <button
            type="button"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            style={{
              width: 29, height: 29, borderRadius: 9,
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              border: '1px solid rgba(255,255,255,.14)',
              background: 'rgba(255,255,255,.04)',
              color: currentPage === totalPages ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.86)',
              fontSize: 15, fontWeight: 700,
              opacity: currentPage === totalPages ? 0.6 : 1,
            }}
            aria-label="Última página"
          >»</button>
        </div>
      </div>

      {/* Grid de figurinhas */}
      {loading ? (
        <div
          style={{
            textAlign: 'center',
            padding: 60,
            color: 'rgba(255,255,255,.3)',
            fontFamily: "'Rajdhani',sans-serif",
          }}
        >
          Carregando álbum...
        </div>
      ) : (
        <Card style={{ width: '100%', margin: 0 }}>
          <div
            className="copa-album-grid grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-[25px]"
            style={{ paddingLeft: 15, paddingRight: 15, paddingBottom: 15, paddingTop: 15 }}
          >
            {pageSlots.map((s) => (
              <AlbumCard
                key={s.slot}
                slot={s}
                onClick={() => setSelected(s)}
                onReveal={() => revealCard(s.id)}
                revealing={revealingId === s.id}
              />
            ))}
          </div>
        </Card>
      )}

      {selected && <DetailModal figurinha={selected} onClose={() => setSelected(null)} />}

      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,156,59,.15)',
            border: '1px solid #ffdf00',
            borderRadius: 10,
            padding: '12px 24px',
            color: '#ffdf00',
            fontFamily: "'Rajdhani',sans-serif",
            fontWeight: 700,
            fontSize: 14,
            zIndex: 200,
            backdropFilter: 'blur(12px)',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
