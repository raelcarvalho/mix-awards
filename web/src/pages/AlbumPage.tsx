import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, Btn } from '@/components/ui/Card'
import { useAuth } from '@/hooks/useAuth'
import * as api from '@/services/api'
import '@/styles/album-effects.css'

const FALLBACK_TOTAL = 82
const PER_PAGE = 10
const ALBUM_ACTION_BTN_CLASS =
  '!text-sm sm:!text-[15px] min-h-[42px] sm:min-h-[46px] !px-4 sm:!px-5'

interface Figurinha {
  id?: number
  slot: number
  nome: string
  imagem?: string
  raridade: 'normal' | 'epica' | 'lendaria' | 'mitica' | 'god'
  possui: boolean
}

interface SlotView extends Figurinha {
  nova?: boolean
}

interface OpenedPackCard {
  key: string
  id: number
  nome: string
  imagem?: string
  raridade: Figurinha['raridade']
  isDuplicate: boolean
  isNew: boolean
}

const RARITY_STYLE: Record<
  Figurinha['raridade'],
  { color: string; label: string; glow: string; infoLabel: string }
> = {
  normal: {
    color: '#94a3b8',
    label: 'Normal',
    glow: 'rgba(148,163,184,.2)',
    infoLabel: 'Carta Normal',
  },
  epica: {
    color: '#c084fc',
    label: 'Épica',
    glow: 'rgba(192,132,252,.3)',
    infoLabel: 'Carta Épica',
  },
  lendaria: {
    color: '#f5c842',
    label: 'Lendária',
    glow: 'rgba(245,200,66,.35)',
    infoLabel: 'Carta Lendária',
  },
  mitica: {
    color: '#fb923c',
    label: 'Mítica',
    glow: 'rgba(251,146,60,.35)',
    infoLabel: 'Carta Mítica',
  },
  god: {
    color: '#56c1ff',
    label: 'GOD',
    glow: 'rgba(86,193,255,.5)',
    infoLabel: 'Carta God',
  },
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0
  const n = Number(String(value).replace(',', '.').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function fixImagePath(path?: string | null): string {
  const raw = String(path || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  if (raw.startsWith('/')) return raw
  return `/${raw}`
}

function canonRarity(value: unknown): Figurinha['raridade'] {
  const s = String(value ?? '')
    .trim()
    .toLowerCase()

  if (s === '4') return 'mitica'
  if (s === '3') return 'lendaria'
  if (s === '2') return 'epica'
  if (s === '1' || s === '0') return 'normal'
  if (['normal', 'comum', 'common'].includes(s)) return 'normal'
  if (['épica', 'epica', 'epic', 'rara', 'rare'].includes(s)) return 'epica'
  if (/(legend|lend[aá]r[io]a)/.test(s)) return 'lendaria'
  if (/(mythic|mitic[ao])/i.test(s)) return 'mitica'
  if (/(god|zeus)/.test(s)) return 'god'
  return 'normal'
}

function normalizeOpenedPackCards(raw: any): OpenedPackCard[] {
  const payload = raw?.resultados ?? raw ?? {}
  const novas = Array.isArray(payload?.novas) ? payload.novas : []
  const duplicadas = Array.isArray(payload?.duplicadas) ? payload.duplicadas : []
  const combined = [
    ...novas.map((item: any) => ({ item, isNew: true, isDuplicate: false })),
    ...duplicadas.map((item: any) => ({ item, isNew: false, isDuplicate: true })),
  ]

  return combined.map((entry: any, idx: number) => {
    const f = entry?.item?.figurinha || entry?.item || {}
    const id = toNumber(f?.id) || idx + 1
    const nome = String(f?.nome || entry?.item?.nome || `Carta #${idx + 1}`).trim() || `Carta #${idx + 1}`
    const imagem = fixImagePath(f?.imagem || f?.img || entry?.item?.imagem || entry?.item?.img || '')
    const raridade = canonRarity(
      f?.raridade ||
        entry?.item?.raridade ||
        f?.raridade_id ||
        f?.raridadeId ||
        entry?.item?.raridade_id ||
        entry?.item?.raridadeId
    )

    return {
      key: `${id}-${idx}-${entry.isDuplicate ? 'dup' : 'new'}`,
      id,
      nome,
      imagem,
      raridade,
      isDuplicate: Boolean(entry.isDuplicate),
      isNew: Boolean(entry.isNew),
    }
  })
}

function rarityBySlot(slot: number): Figurinha['raridade'] {
  if (slot <= 50) return 'normal'
  if (slot <= 70) return 'epica'
  if (slot <= 78) return 'lendaria'
  if (slot <= 81) return 'mitica'
  return 'god'
}

function normalizeAlbum(raw: any): { total: number; obtidas: number; figurinhas: Figurinha[] } {
  const payload = raw?.resultados ?? raw ?? {}

  let figurinhas: Figurinha[] = []

  if (Array.isArray(payload?.figurinhas)) {
    figurinhas = payload.figurinhas.map((f: any, idx: number) => {
      const slot = toNumber(f?.slot) || idx + 1
      const raridade = String(f?.raridade || rarityBySlot(slot)).toLowerCase()
      return {
        id: f?.id,
        slot,
        nome: String(f?.nome || `Figurinha ${slot}`),
        imagem: f?.imagem || f?.img,
        raridade: (['normal', 'epica', 'lendaria', 'mitica', 'god'].includes(raridade)
          ? raridade
          : rarityBySlot(slot)) as Figurinha['raridade'],
        possui: Boolean(f?.possui ?? f?.colada),
      }
    })
  } else if (Array.isArray(payload?.slots)) {
    figurinhas = payload.slots.map((f: any, idx: number) => {
      const slot = toNumber(f?.slot) || idx + 1
      const raridade = String(f?.raridade || rarityBySlot(slot)).toLowerCase()
      return {
        id: f?.figurinha?.id,
        slot,
        nome: String(f?.figurinha?.nome || `Figurinha ${slot}`),
        imagem: f?.figurinha?.img || f?.figurinha?.imagem,
        raridade: (['normal', 'epica', 'lendaria', 'mitica', 'god'].includes(raridade)
          ? raridade
          : rarityBySlot(slot)) as Figurinha['raridade'],
        possui: Boolean(f?.colada),
      }
    })
  }

  figurinhas = figurinhas.sort((a, b) => a.slot - b.slot)

  const total = toNumber(payload?.progresso?.total) || figurinhas.length || FALLBACK_TOTAL
  const obtidas = toNumber(payload?.progresso?.obtidas) || figurinhas.filter((f) => f.possui).length

  return { total, obtidas, figurinhas }
}

function updateHoloPointerVars(target: HTMLElement, xClient: number, yClient: number) {
  const rect = target.getBoundingClientRect()
  const x = ((xClient - rect.left) / rect.width) * 100
  const y = ((yClient - rect.top) / rect.height) * 100
  target.style.setProperty('--mouse-x', `${x}%`)
  target.style.setProperty('--mouse-y', `${y}%`)
}

function ZeusStormOverlay({ active }: { active: boolean }) {
  const hostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!active || !host) return

    host.innerHTML = ''

    const clouds = document.createElement('div')
    clouds.className = 'ma-zeus-clouds'

    const flash = document.createElement('div')
    flash.className = 'ma-zeus-flash'

    const canvas = document.createElement('canvas')
    canvas.className = 'ma-zeus-layer'

    host.append(clouds, flash, canvas)

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let width = 1
    let height = 1
    let running = true
    let last = performance.now()
    let spawnAt = 0
    let raf = 0
    let flashTimer: number | null = null

    type Bolt = {
      pts: Array<{ x: number; y: number }>
      life: number
      age: number
      thick: number
    }

    const bolts: Bolt[] = []

    const rand = (min: number, max: number) => min + Math.random() * (max - min)

    const resize = () => {
      const r = host.getBoundingClientRect()
      width = Math.max(1, r.width)
      height = Math.max(1, r.height)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(host)
    resize()

    const makeBoltSimple = (x0: number, y0: number, x1: number, y1: number) => {
      let pts = [
        { x: x0, y: y0 },
        { x: x1, y: y1 },
      ]
      let offset = Math.hypot(x1 - x0, y1 - y0) * 0.2
      for (let i = 0; i < 3; i += 1) {
        const next = [pts[0]]
        for (let j = 0; j < pts.length - 1; j += 1) {
          const a = pts[j]
          const b = pts[j + 1]
          const mx = (a.x + b.x) / 2
          const my = (a.y + b.y) / 2
          const dx = b.x - a.x
          const dy = b.y - a.y
          const len = Math.hypot(dx, dy) || 1
          const nx = -dy / len
          const ny = dx / len
          const disp = (Math.random() * 2 - 1) * offset
          next.push({ x: mx + nx * disp, y: my + ny * disp }, b)
        }
        pts = next
        offset *= 0.55
      }
      return pts
    }

    const makeBolt = (x0: number, y0: number, x1: number, y1: number) => {
      let pts = [
        { x: x0, y: y0 },
        { x: x1, y: y1 },
      ]
      let offset = Math.hypot(x1 - x0, y1 - y0) * 0.18

      for (let i = 0; i < 6; i += 1) {
        const next = [pts[0]]
        for (let j = 0; j < pts.length - 1; j += 1) {
          const a = pts[j]
          const b = pts[j + 1]
          const mx = (a.x + b.x) / 2
          const my = (a.y + b.y) / 2
          const dx = b.x - a.x
          const dy = b.y - a.y
          const len = Math.hypot(dx, dy) || 1
          const nx = -dy / len
          const ny = dx / len
          const disp = (Math.random() * 2 - 1) * offset

          next.push({ x: mx + nx * disp, y: my + ny * disp }, b)

          if (Math.random() < 0.35 && offset > 2.2) {
            const bx = mx + nx * disp * 0.6
            const by = my + ny * disp * 0.6
            const ang =
              Math.atan2(dy, dx) +
              (Math.random() < 0.5 ? 1 : -1) * rand(Math.PI / 6, Math.PI / 3)
            const blen = rand(len * 0.18, len * 0.33)
            const ex = bx + Math.cos(ang) * blen
            const ey = by + Math.sin(ang) * blen
            bolts.push({
              pts: makeBoltSimple(bx, by, ex, ey),
              life: rand(120, 220),
              age: 0,
              thick: rand(0.6, 1.2),
            })
          }
        }
        pts = next
        offset *= 0.55
      }

      return pts
    }

    const drawBoltPath = (pts: Array<{ x: number; y: number }>, baseAlpha: number, thick: number) => {
      if (pts.length < 2) return

      ctx.globalCompositeOperation = 'lighter'
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      ctx.shadowColor = 'rgba(0,160,255,.8)'
      ctx.shadowBlur = 18
      ctx.strokeStyle = `rgba(0,160,255,${0.28 * baseAlpha})`
      ctx.lineWidth = thick * 8
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y)
      ctx.stroke()

      ctx.shadowBlur = 10
      ctx.strokeStyle = `rgba(120,210,255,${0.55 * baseAlpha})`
      ctx.lineWidth = thick * 4.5
      ctx.stroke()

      ctx.shadowBlur = 0
      ctx.strokeStyle = `rgba(255,255,255,${0.95 * baseAlpha})`
      ctx.lineWidth = thick * 1.6
      ctx.stroke()
    }

    const spawn = () => {
      const startX = rand(width * 0.15, width * 0.85)
      const endX = startX + rand(-width * 0.2, width * 0.2)
      const pts = makeBolt(startX, -width * 0.05, endX, height * rand(0.6, 0.95))

      bolts.push({
        pts,
        life: rand(240, 360),
        age: 0,
        thick: rand(1.2, 2.2),
      })

      flash.style.opacity = '0.38'
      if (flashTimer) window.clearTimeout(flashTimer)
      flashTimer = window.setTimeout(() => {
        flash.style.opacity = '0'
      }, 120)
    }

    const tick = (ts: number) => {
      if (!running) return

      const dt = Math.min(60, ts - last)
      last = ts

      ctx.clearRect(0, 0, width, height)

      for (let i = bolts.length - 1; i >= 0; i -= 1) {
        const b = bolts[i]
        b.age += dt
        const alpha = Math.max(0, 1 - b.age / b.life)
        drawBoltPath(b.pts, alpha, b.thick)
        if (b.age >= b.life) bolts.splice(i, 1)
      }

      if (ts > spawnAt) {
        spawn()
        spawnAt = ts + (300 + Math.random() * 900)
      }

      raf = window.requestAnimationFrame(tick)
    }

    raf = window.requestAnimationFrame(tick)

    return () => {
      running = false
      window.cancelAnimationFrame(raf)
      ro.disconnect()
      if (flashTimer) window.clearTimeout(flashTimer)
      host.innerHTML = ''
    }
  }, [active])

  if (!active) return null
  return <div className='ma-zeus-host' ref={hostRef} aria-hidden='true' />
}

function AlbumCard({
  slot,
  onClick,
  onAcknowledgeNew,
}: {
  slot: SlotView
  onClick: () => void
  onAcknowledgeNew: (figurinhaId: number) => void
}) {
  const rarity = RARITY_STYLE[slot.raridade]

  const onMouseMove = (e: MouseEvent<HTMLButtonElement>) => {
    updateHoloPointerVars(e.currentTarget, e.clientX, e.clientY)
  }

  const onMouseEnter = () => {
    if (slot.nova && slot.id) {
      onAcknowledgeNew(slot.id)
    }
  }

  return (
    <button
      type='button'
      onClick={onClick}
      onMouseMove={onMouseMove}
      onMouseEnter={onMouseEnter}
      className={`ma-album-slot ${slot.raridade} ${slot.nova ? 'is-new' : ''} ${slot.possui ? 'has' : ''}`}
      title={slot.nome || `Figurinha ${slot.slot}`}
      aria-label={`Slot ${slot.slot} ${slot.nome}`}
    >
      <span className='rarity'>{rarity.label}</span>
      <span className='num'>{slot.slot}</span>

      {slot.possui ? (
        <>
          {slot.imagem ? (
            <img
              src={slot.imagem}
              alt={slot.nome}
              onError={(e) => {
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          ) : (
            <div className='ma-album-slot-empty'>
              Figurinha
              <br />
              {slot.slot}
            </div>
          )}
          <div className='ma-holo' aria-hidden='true' />
          <ZeusStormOverlay active={slot.raridade === 'god'} />
        </>
      ) : (
        <div className='ma-album-slot-empty'>
          Figurinha
          <br />
          {slot.slot}
        </div>
      )}
    </button>
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

  return (
    <div
      className='ma-modal-backdrop'
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className='ma-modal-shell'>
        <div className='ma-modal-head'>
          <h4 className='ma-modal-title'>
          </h4>
          <button type='button' className='ma-modal-close' onClick={onClose} aria-label='Fechar'>
            ×
          </button>
        </div>

        <div className='ma-card-preview' onMouseMove={onMovePreview}>
          {figurinha.imagem ? (
            <img
              src={figurinha.imagem}
              alt={figurinha.nome}
              onError={(e) => {
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          ) : (
            <div className='ma-album-slot-empty h-full flex items-center justify-center text-4xl opacity-35'>
              ?
            </div>
          )}

          <div className={`ma-holo ${figurinha.raridade}`} aria-hidden='true' />
          <ZeusStormOverlay active={figurinha.raridade === 'god'} />
        </div>

        <div className='text-center mt-2'>
          <div className={`ma-card-info ${figurinha.raridade}`}>{rarity.infoLabel}</div>
        </div>
      </div>
    </div>
  )
}

function PackOpeningModal({
  cards,
  opening,
  onClose,
}: {
  cards: OpenedPackCard[]
  opening: boolean
  onClose: () => void
}) {
  const [stage, setStage] = useState<'pack' | 'fan'>('pack')
  const [revealedMap, setRevealedMap] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const t = window.setTimeout(() => setStage('fan'), 1100)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const toggleReveal = useCallback((key: string) => {
    setRevealedMap((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const revealAll = useCallback(() => {
    const next: Record<string, boolean> = {}
    for (const card of cards) next[card.key] = true
    setRevealedMap(next)
  }, [cards])

  const mapLabelByRarity = useCallback((rarity: Figurinha['raridade']) => {
    return RARITY_STYLE[rarity]?.label || 'Normal'
  }, [])

  const rotationByIndex = useCallback((index: number, total: number) => {
    if (total <= 1) return 0
    if (total === 2) return [-4, 4][index] ?? 0
    if (total === 3) return [-7, 0, 7][index] ?? 0
    if (total === 4) return [-8, -2, 2, 8][index] ?? 0
    return [-10, -5, 0, 5, 10][index] ?? 0
  }, [])

  return (
    <div
      className='ma-modal-backdrop ma-packfx-backdrop'
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className='ma-packfx-shell'>
        <div className='ma-packfx-head'>
          <h4 className='ma-modal-title'>Abertura de pacote</h4>
          <div className='ma-packfx-actions'>
            <Btn
              color='#22d3ee'
              variant='outline'
              size='lg'
              className='!text-sm !min-h-[38px] !px-4'
              disabled={stage !== 'fan' || opening}
              onClick={revealAll}
            >
              Revelar tudo
            </Btn>
            <button type='button' className='ma-modal-close' onClick={onClose} aria-label='Fechar'>
              ×
            </button>
          </div>
        </div>

        <div className={`ma-packfx-stage ${stage === 'fan' ? 'is-opened' : ''}`}>
          <div className={`ma-packfx-pack ${stage === 'pack' ? 'is-shaking' : 'is-hidden'}`}>
            <div className='ma-packfx-foil' />
            <div className='ma-packfx-tap'>Abrindo pacote...</div>
          </div>

          <div className={`ma-packfx-fan ${stage === 'fan' ? 'is-ready' : ''}`}>
            {cards.map((card, idx) => {
              const revealed = Boolean(revealedMap[card.key])
              const rot = rotationByIndex(idx, cards.length)
              const rarityLabel = mapLabelByRarity(card.raridade)
              return (
                <div className='ma-packfx-card-wrap' key={card.key}>
                  <button
                    type='button'
                    className={`ma-packfx-card ${card.raridade} ${card.isDuplicate ? 'is-duplicate' : ''} ${
                      revealed ? 'is-revealed' : ''
                    }`}
                    style={{
                      ['--rot' as any]: `${rot}deg`,
                      animationDelay: `${idx * 120}ms`,
                    }}
                    onClick={() => toggleReveal(card.key)}
                    aria-label={`Revelar carta ${card.nome}`}
                  >
                    <div className='ma-packfx-inner'>
                      <div className='ma-packfx-face ma-packfx-back' />
                      <div className='ma-packfx-face ma-packfx-front'>
                        <div className='ma-packfx-art'>
                          {card.imagem ? (
                            <img
                              src={card.imagem}
                              alt={card.nome}
                              onError={(e) => {
                                ;(e.target as HTMLImageElement).style.display = 'none'
                              }}
                            />
                          ) : (
                            <div className='ma-packfx-art-fallback'>?</div>
                          )}
                          {(card.raridade === 'mitica' || card.raridade === 'god') && <div className='ma-holo' />}
                          <ZeusStormOverlay active={card.raridade === 'god' && revealed} />
                        </div>
                        <div className='ma-packfx-meta'>
                          <strong>{card.nome}</strong>
                          <span className={`ma-packfx-tag ${card.raridade}`}>{rarityLabel}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                  {card.isDuplicate && <div className='ma-packfx-dup'>Repetida • vendida em gold</div>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AlbumPage({ setPage }: { setPage: (p: any) => void }) {
  const { isLogged } = useAuth()
  const [figurinhas, setFigurinhas] = useState<Figurinha[]>([])
  const [total, setTotal] = useState(FALLBACK_TOTAL)
  const [obtidas, setObtidas] = useState(0)
  const [packCount, setPackCount] = useState(0)
  const [page, setAlbumPage] = useState(1)
  const [selected, setSelected] = useState<SlotView | null>(null)
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState(false)
  const [packFxOpen, setPackFxOpen] = useState(false)
  const [packFxCards, setPackFxCards] = useState<OpenedPackCard[]>([])
  const [pendingReloadAfterFx, setPendingReloadAfterFx] = useState(false)
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
    toastTimerRef.current = window.setTimeout(() => setToast(''), 2500)
  }, [])

  const loadAlbum = useCallback(async () => {
    setLoading(true)

    try {
      const data = await api.meuAlbum()
      const album = normalizeAlbum(data)
      setFigurinhas(album.figurinhas)
      setTotal(album.total)
      setObtidas(album.obtidas)
    } catch {
      setFigurinhas([])
      setTotal(FALLBACK_TOTAL)
      setObtidas(0)
    }

    try {
      const pacs = await api.listarPacotesFechados()
      const arr = pacs?.resultados?.pacotes ?? pacs?.pacotes ?? []
      setPackCount(Array.isArray(arr) ? arr.length : 0)
    } catch {
      setPackCount(0)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    loadAlbum()
  }, [loadAlbum])

  const acknowledgeNew = useCallback(async (figurinhaId: number) => {
    setFigurinhas((prev) => prev.map((f) => (f.id === figurinhaId ? { ...f, nova: false } : f)))
    try {
      await api.ackFigurinhasNovas([figurinhaId])
    } catch {
      // sem bloqueio de UI
    }
  }, [])

  const openPack = async () => {
    setOpening(true)
    try {
      const pacs = await api.listarPacotesFechados()
      const arr = pacs?.resultados?.pacotes ?? pacs?.pacotes ?? []
      if (!arr.length) {
        showToast('Nenhum pacote disponível.')
        return
      }
      const opened = await api.abrirPacote(arr[0].id)
      const openedCards = normalizeOpenedPackCards(opened)
      if (!openedCards.length) {
        showToast('Pacote aberto, mas não foi possível carregar as cartas.')
        await loadAlbum()
        return
      }
      setPackFxCards(openedCards)
      setPackFxOpen(true)
      setPendingReloadAfterFx(true)
      setPackCount((prev) => Math.max(0, prev - 1))
      showToast('✓ Pacote aberto! Revele as cartas.')
    } catch (err: any) {
      showToast(err.message || 'Erro ao abrir pacote')
    } finally {
      setOpening(false)
    }
  }

  const closePackFx = useCallback(() => {
    setPackFxOpen(false)
    setPackFxCards([])
    if (pendingReloadAfterFx) {
      setPendingReloadAfterFx(false)
      void loadAlbum()
    }
  }, [loadAlbum, pendingReloadAfterFx])

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  const slotMap = useMemo(() => {
    const map = new Map<number, Figurinha>()
    for (const f of figurinhas) map.set(f.slot, f)
    return map
  }, [figurinhas])

  const pageSlots = useMemo<SlotView[]>(() => {
    const start = (page - 1) * PER_PAGE + 1
    const end = Math.min(total, start + PER_PAGE - 1)
    const slots: SlotView[] = []

    for (let slot = start; slot <= end; slot += 1) {
      const found = slotMap.get(slot)
      if (found) {
        slots.push({ ...found })
      } else {
        slots.push({
          slot,
          nome: `Figurinha ${slot}`,
          raridade: rarityBySlot(slot),
          possui: false,
        })
      }
    }

    return slots
  }, [page, slotMap, total])

  const pct = Math.round((obtidas / Math.max(total, 1)) * 100)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div
        style={{
          background: 'linear-gradient(135deg,rgba(192,132,252,.1) 0%,rgba(129,140,248,.07) 100%)',
          border: '1px solid rgba(192,132,252,.2)',
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
              color: 'rgba(192,132,252,.7)',
              letterSpacing: 3,
              textTransform: 'uppercase',
              marginBottom: 6,
              fontFamily: "'Rajdhani',sans-serif",
              fontWeight: 700,
            }}
          >
            📋 Coleção
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
            MEU <span style={{ color: '#c084fc' }}>ÁLBUM</span>
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <div
              style={{
                fontSize: 13,
                color: 'rgba(255,255,255,.4)',
                fontFamily: "'Rajdhani',sans-serif",
              }}
            >
              {obtidas} / {total} figurinhas
            </div>
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
                  background: 'linear-gradient(90deg,#818cf8,#c084fc)',
                  borderRadius: 3,
                  boxShadow: '0 0 8px rgba(192,132,252,.5)',
                  transition: 'width 1s ease',
                }}
              />
            </div>
            <div
              style={{
                fontFamily: "'Orbitron',monospace",
                fontSize: 13,
                fontWeight: 700,
                color: '#c084fc',
              }}
            >
              {pct}%
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {isLogged && (
            <div
              style={{
                background: 'rgba(192,132,252,.1)',
                border: '1px solid rgba(192,132,252,.25)',
                borderRadius: 10,
                padding: '8px 16px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: 'rgba(192,132,252,.6)',
                  letterSpacing: 1.5,
                  marginBottom: 2,
                  fontFamily: "'Rajdhani',sans-serif",
                }}
              >
                PACOTES
              </div>
              <div
                style={{
                  fontFamily: "'Orbitron',monospace",
                  fontSize: 20,
                  fontWeight: 700,
                  color: '#c084fc',
                }}
              >
                {packCount}
              </div>
            </div>
          )}

          {isLogged && packCount > 0 ? (
            <Btn
              onClick={openPack}
              disabled={opening || packFxOpen}
              color='#c084fc'
              size='lg'
              className={ALBUM_ACTION_BTN_CLASS}
            >
              {opening ? 'ABRINDO...' : '🎁 ABRIR PACOTE'}
            </Btn>
          ) : (
            <Btn
              onClick={() => setPage('shop')}
              color='#f5c842'
              variant='outline'
              size='lg'
              className={ALBUM_ACTION_BTN_CLASS}
            >
              IR À LOJA →
            </Btn>
          )}
        </div>
      </div>

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
                            page === p
                              ? 'linear-gradient(180deg,#bb8cff 0%,#8c5cff 100%)'
                              : 'rgba(255,255,255,.03)',
                          border: `1px solid ${page === p ? '#cda4ff' : 'rgba(255,255,255,.12)'}`,
                          color: page === p ? '#fff' : 'rgba(255,255,255,.86)',
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
            {pageSlots.map((s) => (
              <AlbumCard
                key={s.slot}
                slot={s}
                onClick={() => setSelected(s)}
                onAcknowledgeNew={acknowledgeNew}
              />
            ))}
          </div>
        </Card>
      )}

      {packFxOpen && (
        <PackOpeningModal
          cards={packFxCards}
          opening={opening}
          onClose={closePackFx}
        />
      )}

      {selected && <DetailModal figurinha={selected} onClose={() => setSelected(null)} />}

      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(192,132,252,.15)',
            border: '1px solid #c084fc',
            borderRadius: 10,
            padding: '12px 24px',
            color: '#c084fc',
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
