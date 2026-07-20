import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, Btn } from '@/components/ui/Card'
import { useAuth } from '@/hooks/useAuth'
import * as api from '@/services/api'
import AlbumCard from '@/components/album/AlbumCard'
import DetailModal from '@/components/album/DetailModal'
import PackOpeningModal from '@/components/album/PackOpeningModal'
import { RARITY_STYLE, type Figurinha, type OpenedPackCard, type SlotView } from '@/components/album/types'
import {
  FALLBACK_TOTAL,
  PER_PAGE,
  normalizeAlbum,
  normalizeOpenedPackCards,
  rarityBySlot,
} from '@/components/album/utils'
import '@/styles/album-effects.css'

const ALBUM_ACTION_BTN_CLASS =
  '!text-sm sm:!text-[15px] min-h-[42px] sm:min-h-[46px] !px-4 sm:!px-5'

export default function AlbumPage({ setPage }: { setPage: (p: any) => void }) {
  const { isLogged } = useAuth()
  const queryClient = useQueryClient()
  const albumQueryKey = useMemo(() => ['album', isLogged] as const, [isLogged])
  const [page, setAlbumPage] = useState(1)
  const [selected, setSelected] = useState<SlotView | null>(null)
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

  const { data: albumData, isPending: loading, refetch: loadAlbum } = useQuery({
    queryKey: albumQueryKey,
    queryFn: async () => {
      let figurinhas: Figurinha[] = []
      let total = FALLBACK_TOTAL
      let obtidas = 0
      try {
        const data = await api.meuAlbum()
        const album = normalizeAlbum(data)
        figurinhas = album.figurinhas
        total = album.total
        obtidas = album.obtidas
      } catch {}

      let packCount = 0
      try {
        const pacs = await api.listarPacotesFechados()
        const arr = pacs?.resultados?.pacotes ?? pacs?.pacotes ?? []
        packCount = Array.isArray(arr) ? arr.length : 0
      } catch {}

      return { figurinhas, total, obtidas, packCount }
    },
  })

  const figurinhas = albumData?.figurinhas ?? []
  const total = albumData?.total ?? FALLBACK_TOTAL
  const obtidas = albumData?.obtidas ?? 0
  const packCount = albumData?.packCount ?? 0

  const acknowledgeNew = useCallback(
    async (figurinhaId: number) => {
      queryClient.setQueryData(albumQueryKey, (prev: typeof albumData) =>
        prev
          ? {
              ...prev,
              figurinhas: prev.figurinhas.map((f) =>
                f.id === figurinhaId ? { ...f, nova: false } : f
              ),
            }
          : prev
      )
      try {
        await api.ackFigurinhasNovas([figurinhaId])
      } catch {
        // sem bloqueio de UI
      }
    },
    [albumQueryKey, queryClient]
  )

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
      queryClient.setQueryData(albumQueryKey, (prev: typeof albumData) =>
        prev ? { ...prev, packCount: Math.max(0, prev.packCount - 1) } : prev
      )
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
        <Card style={{ width: '100%', margin: 0 }}>
          <div
            className='grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-[5px]'
            style={{ paddingLeft: 15, paddingRight: 15, paddingBottom: 15, paddingTop: 15 }}
          >
            {pageSlots.map((s) => (
              <AlbumCard
                key={s.slot}
                slot={s}
                onClick={() => {
                  if (s.possui) setSelected(s)
                }}
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
