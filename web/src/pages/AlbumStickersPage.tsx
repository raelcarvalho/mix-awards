import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, Btn } from '@/components/ui/Card'
import { useAuth } from '@/hooks/useAuth'
import * as api from '@/services/api'
import '@/styles/album-effects.css'

const PER_PAGE = 10
const FALLBACK_TOTAL = 24
const REVEAL_PRICE = 30
const ALBUM_ACTION_BTN_CLASS =
  '!text-sm sm:!text-[15px] min-h-[42px] sm:min-h-[46px] !px-4 sm:!px-5'

const VERSIONED_STICKER_SRC: Record<number, string> = {
  8: '/uploads/stickers/sticker8.png?v=20250902',
  10: '/uploads/stickers/sticker10.png?v=20250902',
  14: '/uploads/stickers/sticker14.png?v=20250902',
  20: '/uploads/stickers/sticker20.png?v=20250902',
}

const slotImagePath = (slot: number) => VERSIONED_STICKER_SRC[slot] || `/uploads/stickers/sticker${slot}.png`

interface Sticker {
  id?: number
  slot: number
  nome: string
  imagem?: string
  raridade?: string
  possui: boolean
  revelado?: boolean
}

interface StickerPreview {
  slot: number
  nome: string
  imagem: string
  raridade: string
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0
  const n = Number(String(value).replace(',', '.').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function normalizeStickers(raw: any): {
  stickers: Sticker[]
  total: number
  obtidas: number
  revealed: Set<number>
} {
  const payload = raw?.resultados ?? raw ?? {}
  const revealed = new Set<number>()

  const list: Sticker[] = Array.isArray(payload?.stickers)
    ? payload.stickers.map((s: any, idx: number) => {
        const slot = toNumber(s?.slot) || idx + 1
        if (Boolean(s?.revelado)) revealed.add(slot)

        return {
          id: s?.id,
          slot,
          nome: String(s?.nome || `Sticker ${slot}`),
          imagem: s?.imagem,
          raridade: s?.raridade || 'Normal',
          possui: Boolean(s?.possui),
          revelado: Boolean(s?.revelado),
        }
      })
    : []

  const stickers = list.sort((a, b) => a.slot - b.slot)
  const total = toNumber(payload?.progresso?.total) || stickers.length || FALLBACK_TOTAL
  const obtidas = toNumber(payload?.progresso?.obtidas) || stickers.filter((s) => s.possui).length

  return { stickers, total, obtidas, revealed }
}

function StickerPreviewModal({
  sticker,
  onClose,
}: {
  sticker: StickerPreview
  onClose: () => void
}) {
  const innerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const inner = innerRef.current
    if (!inner) return

    let rx = 0
    let ry = 0
    let tx = 0
    let ty = 0
    let raf = 0

    const animate = () => {
      rx += (tx - rx) * 0.12
      ry += (ty - ry) * 0.12
      inner.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) scale3d(1.05, 1.05, 1.05)`
      raf = window.requestAnimationFrame(animate)
    }

    const onMove = (e: MouseEvent) => {
      const rect = inner.getBoundingClientRect()
      const nx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)
      const ny = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)
      ty = -ny * 15
      tx = nx * 18
    }

    const onLeave = () => {
      tx = 0
      ty = 0
    }

    inner.addEventListener('mousemove', onMove)
    inner.addEventListener('mouseleave', onLeave)
    raf = window.requestAnimationFrame(animate)

    return () => {
      window.cancelAnimationFrame(raf)
      inner.removeEventListener('mousemove', onMove)
      inner.removeEventListener('mouseleave', onLeave)
      inner.style.transform = ''
    }
  }, [sticker.slot])

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [onClose])

  return (
    <div
      className='ma-modal-backdrop'
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className='ma-modal-shell'>
        <div className='ma-modal-head'>
          <h4 className='ma-modal-title'>{sticker.nome}</h4>
          <button type='button' className='ma-modal-close' onClick={onClose} aria-label='Fechar'>
            ×
          </button>
        </div>

        <div className='ma-sticker-card3d'>
          <div className='ma-sticker-card3d-inner' ref={innerRef}>
            <img
              src={sticker.imagem}
              alt={sticker.nome}
              onError={(e) => {
                ;(e.target as HTMLImageElement).src = '/uploads/stickers/capsula_sticker.png'
              }}
            />
          </div>
        </div>

        <div className='ma-card-info' style={{ color: '#f5c842', textShadow: '0 0 10px rgba(245,200,66,.4)' }}>
          {sticker.raridade}
        </div>
      </div>
    </div>
  )
}

function SlotCard({
  sticker,
  revealed,
  revealing,
  onReveal,
  onPreview,
}: {
  sticker: Sticker
  revealed: boolean
  revealing: boolean
  onReveal: () => void
  onPreview: () => void
}) {
  const isOwned = sticker.possui
  const isRevealed = isOwned || revealed
  const displayName = isOwned ? sticker.nome : `Sticker ${sticker.slot}`
  const label = isOwned ? sticker.raridade || 'Normal' : isRevealed ? 'Revelado' : 'Bloqueado'

  return (
    <div className='ma-sticker-slot-wrap'>
      <button
        type='button'
        onClick={() => {
          if (isRevealed) onPreview()
        }}
        disabled={revealing}
        className='ma-sticker-slot'
        aria-label={displayName}
      >
        <span className='label'>{label}</span>

        <div className={`ma-sticker-img-container ${!isRevealed ? 'dimmed' : ''}`}>
          <img
            src={isOwned ? sticker.imagem || slotImagePath(sticker.slot) : slotImagePath(sticker.slot)}
            alt={displayName}
            onError={(e) => {
              ;(e.target as HTMLImageElement).src = '/uploads/stickers/capsula_sticker.png'
            }}
          />
        </div>

        <span className='num'>{sticker.slot}</span>
      </button>

      {!isRevealed && (
        <button type='button' className='ma-reveal-bar' onClick={onReveal} disabled={revealing}>
          Deseja revelar sticker por <strong style={{ color: '#f5c842' }}>{REVEAL_PRICE} gold</strong>?
        </button>
      )}
    </div>
  )
}

export default function AlbumStickersPage({ setPage }: { setPage: (p: any) => void }) {
  const { isLogged, refreshGold } = useAuth()
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [revealedSlots, setRevealedSlots] = useState<Set<number>>(new Set())
  const [total, setTotal] = useState(FALLBACK_TOTAL)
  const [obtidas, setObtidas] = useState(0)
  const [page, setAlbumPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [revealingSlot, setRevealingSlot] = useState<number | null>(null)
  const [selected, setSelected] = useState<StickerPreview | null>(null)
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

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.meuAlbumStickers()
      const normalized = normalizeStickers(data)
      setStickers(normalized.stickers)
      setTotal(normalized.total)
      setObtidas(normalized.obtidas)
      setRevealedSlots((prev) => {
        const next = new Set(prev)
        normalized.revealed.forEach((slot) => next.add(slot))
        return next
      })

      try {
        const rev = await api.stickersRevelados()
        const payload = rev?.resultados ?? rev ?? {}
        const list = Array.isArray(payload?.slots) ? payload.slots : []
        setRevealedSlots((prev) => {
          const next = new Set(prev)
          for (const slot of list) next.add(Number(slot))
          return next
        })
      } catch {
        // endpoint opcional
      }
    } catch {
      setStickers([])
      setTotal(FALLBACK_TOTAL)
      setObtidas(0)
      setRevealedSlots(new Set())
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const reveal = async (slot: number) => {
    if (!isLogged) {
      showToast('Faça login para revelar stickers.')
      return
    }

    setRevealingSlot(slot)
    try {
      await api.revelarSticker(slot)
      setRevealedSlots((prev) => {
        const next = new Set(prev)
        next.add(slot)
        return next
      })
      await refreshGold()
      await load()
      showToast(`✓ Sticker do slot #${slot} revelado!`)
    } catch (err: any) {
      showToast(err.message || 'Erro ao revelar sticker')
    } finally {
      setRevealingSlot(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))
  const pct = Math.round((obtidas / Math.max(total, 1)) * 100)

  const slotMap = useMemo(() => {
    const map = new Map<number, Sticker>()
    for (const s of stickers) map.set(s.slot, s)
    return map
  }, [stickers])

  const pageSlots = useMemo<Sticker[]>(() => {
    const start = (page - 1) * PER_PAGE + 1
    const end = Math.min(total, start + PER_PAGE - 1)
    const list: Sticker[] = []

    for (let slot = start; slot <= end; slot += 1) {
      list.push(
        slotMap.get(slot) || {
          slot,
          nome: `Sticker ${slot}`,
          imagem: slotImagePath(slot),
          raridade: 'Normal',
          possui: false,
        }
      )
    }

    return list
  }, [page, slotMap, total])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div
        style={{
          background: 'linear-gradient(135deg,rgba(34,211,238,.1),rgba(192,132,252,.07))',
          border: '1px solid rgba(34,211,238,.22)',
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
              color: 'rgba(34,211,238,.7)',
              letterSpacing: 3,
              textTransform: 'uppercase',
              marginBottom: 6,
              fontWeight: 700,
              fontFamily: "'Rajdhani',sans-serif",
            }}
          >
            ✨ Assinaturas
          </div>
          <h1
            style={{
              fontFamily: "'Orbitron',monospace",
              fontSize: 'clamp(20px,3vw,24px)',
              fontWeight: 900,
              color: '#fff',
              margin: 0,
              letterSpacing: 2,
            }}
          >
            ÁLBUM DE <span style={{ color: '#22d3ee' }}>STICKERS</span>
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <span
              style={{
                fontSize: 13,
                color: 'rgba(255,255,255,.4)',
                fontFamily: "'Rajdhani',sans-serif",
              }}
            >
              {obtidas} / {total} stickers
            </span>
            <div
              style={{
                height: 6,
                width: 180,
                background: 'rgba(255,255,255,.08)',
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: 'linear-gradient(90deg,#22d3ee,#818cf8)',
                  borderRadius: 3,
                  boxShadow: '0 0 8px rgba(34,211,238,.5)',
                  transition: 'width 1s ease',
                }}
              />
            </div>
            <span
              style={{
                fontFamily: "'Orbitron',monospace",
                fontSize: 13,
                fontWeight: 700,
                color: '#22d3ee',
              }}
            >
              {pct}%
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div
            style={{
              background: 'rgba(34,211,238,.1)',
              border: '1px solid rgba(34,211,238,.25)',
              borderRadius: 10,
              padding: '8px 16px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: 'rgba(34,211,238,.6)',
                letterSpacing: 1.5,
                marginBottom: 2,
                fontFamily: "'Rajdhani',sans-serif",
              }}
            >
              CUSTO POR REVELAÇÃO
            </div>
            <div
              style={{
                fontFamily: "'Orbitron',monospace",
                fontSize: 20,
                fontWeight: 700,
                color: '#22d3ee',
              }}
            >
              {REVEAL_PRICE}G
            </div>
          </div>
          <Btn
            onClick={() => setPage('shop')}
            color='#f5c842'
            variant='outline'
            size='lg'
            className={ALBUM_ACTION_BTN_CLASS}
          >
            IR À LOJA →
          </Btn>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[
          { color: '#f5c842', label: 'Obtido / Revelado' },
          { color: 'rgba(255,255,255,0.2)', label: 'Não revelado' },
        ].map((v) => (
          <div
            key={v.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: `${v.color}12`,
              border: `1px solid ${v.color}28`,
              borderRadius: 6,
              padding: '4px 12px',
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
            <span style={{ fontSize: 11, color: v.color, fontWeight: 700 }}>{v.label}</span>
          </div>
        ))}
        <div
          style={{
            marginLeft: 'auto',
            fontSize: 11,
            color: 'rgba(255,255,255,.35)',
            alignSelf: 'center',
            fontFamily: "'Rajdhani',sans-serif",
          }}
        >
          Clique em revelar para desbloquear o sticker
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
          Carregando stickers...
        </div>
      ) : (
        <Card
          headerGap={5}
          style={{ width: '100%', margin: 0 }}
          action={
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type='button'
                onClick={() => setAlbumPage(1)}
                disabled={page === 1}
                style={{
                  width: 29,
                  height: 29,
                  borderRadius: 9,
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  border: '1px solid rgba(255,255,255,.14)',
                  background: 'rgba(255,255,255,.04)',
                  color: page === 1 ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.86)',
                  fontSize: 15,
                  fontWeight: 700,
                  opacity: page === 1 ? 0.6 : 1,
                }}
                aria-label='Primeira página'
              >
                «
              </button>

              <button
                type='button'
                onClick={() => setAlbumPage(Math.max(1, page - 1))}
                disabled={page === 1}
                style={{
                  width: 29,
                  height: 29,
                  borderRadius: 9,
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  border: '1px solid rgba(255,255,255,.14)',
                  background: 'rgba(255,255,255,.04)',
                  color: page === 1 ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.86)',
                  fontSize: 15,
                  fontWeight: 700,
                  opacity: page === 1 ? 0.6 : 1,
                }}
                aria-label='Página anterior'
              >
                ‹
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p <= 3 || p >= totalPages - 2 || Math.abs(p - page) <= 1)
                .map((p, i, arr) => {
                  const prev = arr[i - 1]
                  const showGap = prev && p - prev > 1
                  return (
                    <div key={`wrap-${p}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {showGap && (
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.25)' }}>…</span>
                      )}
                      <button
                        type='button'
                        onClick={() => setAlbumPage(p)}
                        style={{
                          width: 33,
                          height: 33,
                          borderRadius: 9,
                          cursor: 'pointer',
                          background:
                            p === page
                              ? 'linear-gradient(180deg,#bb8cff 0%,#8c5cff 100%)'
                              : 'rgba(255,255,255,.03)',
                          border: `1px solid ${p === page ? '#cda4ff' : 'rgba(255,255,255,.12)'}`,
                          color: p === page ? '#fff' : 'rgba(255,255,255,.86)',
                          fontSize: 15,
                          fontWeight: 700,
                          fontFamily: "'Orbitron',monospace",
                        }}
                      >
                        {p}
                      </button>
                    </div>
                  )
                })}

              <button
                type='button'
                onClick={() => setAlbumPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                style={{
                  width: 29,
                  height: 29,
                  borderRadius: 9,
                  cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  border: '1px solid rgba(255,255,255,.14)',
                  background: 'rgba(255,255,255,.04)',
                  color: page === totalPages ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.86)',
                  fontSize: 15,
                  fontWeight: 700,
                  opacity: page === totalPages ? 0.6 : 1,
                }}
                aria-label='Próxima página'
              >
                ›
              </button>

              <button
                type='button'
                onClick={() => setAlbumPage(totalPages)}
                disabled={page === totalPages}
                style={{
                  width: 29,
                  height: 29,
                  borderRadius: 9,
                  cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  border: '1px solid rgba(255,255,255,.14)',
                  background: 'rgba(255,255,255,.04)',
                  color: page === totalPages ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.86)',
                  fontSize: 15,
                  fontWeight: 700,
                  opacity: page === totalPages ? 0.6 : 1,
                }}
                aria-label='Última página'
              >
                »
              </button>
            </div>
          }
        >
          <div
            className='grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3'
            style={{ paddingLeft: 5, paddingRight: 5 }}
          >
            {pageSlots.map((s) => {
              const revealed = revealedSlots.has(s.slot)
              return (
                <SlotCard
                  key={s.slot}
                  sticker={s}
                  revealed={revealed}
                  revealing={revealingSlot === s.slot}
                  onReveal={() => reveal(s.slot)}
                  onPreview={() => {
                    setSelected({
                      slot: s.slot,
                      nome: s.possui ? s.nome : `Sticker ${s.slot}`,
                      imagem: s.possui ? s.imagem || slotImagePath(s.slot) : slotImagePath(s.slot),
                      raridade: s.possui ? s.raridade || 'Normal' : revealed ? 'Revelado' : 'Bloqueado',
                    })
                  }}
                />
              )
            })}
          </div>
        </Card>
      )}

      {selected && <StickerPreviewModal sticker={selected} onClose={() => setSelected(null)} />}

      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(34,211,238,.15)',
            border: '1px solid #22d3ee',
            borderRadius: 10,
            padding: '12px 24px',
            color: '#22d3ee',
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
