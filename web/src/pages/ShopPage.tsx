import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Card, Btn } from '@/components/ui/Card'
import { useAuth } from '@/hooks/useAuth'
import * as api from '@/services/api'

const PRICE_PACOTE = 20
const SHOP_BUY_BTN_CLASS =
  'min-h-[42px] sm:min-h-[46px] min-w-[132px] sm:min-w-[150px] !px-4 sm:!px-5 !text-sm sm:!text-[15px] tracking-wide'

function Toast({ msg, type }: { msg: string; type: 'ok' | 'err' | '' }) {
  if (!msg) return null
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 32,
        left: '50%',
        transform: 'translateX(-50%)',
        background:
          type === 'ok' ? 'rgba(74,222,128,.15)' : 'rgba(248,113,113,.15)',
        border: `1px solid ${type === 'ok' ? '#4ade80' : '#f87171'}`,
        borderRadius: 10,
        padding: '12px 24px',
        color: type === 'ok' ? '#4ade80' : '#f87171',
        fontFamily: "'Rajdhani',sans-serif",
        fontWeight: 700,
        fontSize: 14,
        letterSpacing: 1,
        zIndex: 200,
        backdropFilter: 'blur(12px)',
        boxShadow: `0 0 24px ${
          type === 'ok' ? 'rgba(74,222,128,.2)' : 'rgba(248,113,113,.2)'
        }`,
      }}
    >
      {msg}
    </div>
  )
}

function BuyModal({
  gold,
  onClose,
  onBuy,
}: {
  gold: number
  onClose: () => void
  onBuy: (qty: number) => Promise<void>
}) {
  const [qty, setQty] = useState(1)
  const [loading, setLoading] = useState(false)
  const total = PRICE_PACOTE * qty
  const diff = gold - total
  const canBuy = diff >= 0 && !loading

  const confirm = async () => {
    setLoading(true)
    try {
      await onBuy(qty)
      onClose()
    } finally {
      setLoading(false)
    }
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
          background: 'rgba(0,0,0,.7)',
          backdropFilter: 'blur(4px)',
        }}
      />
      <div
        style={{
          position: 'relative',
          width: 'min(92vw,420px)',
          background: '#11182a',
          border: '1px solid rgba(192,132,252,.25)',
          borderRadius: 18,
          padding: '28px 26px',
          boxShadow: '0 20px 60px rgba(0,0,0,.5)',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,.4)',
            fontSize: 20,
            cursor: 'pointer',
          }}
        >
          ×
        </button>

        <div
          style={{
            fontFamily: "'Orbitron',monospace",
            fontSize: 15,
            fontWeight: 700,
            color: '#fff',
            letterSpacing: 2,
            marginBottom: 4,
          }}
        >
          COMPRAR PACOTES
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'rgba(255,255,255,.3)',
            marginBottom: 24,
            fontFamily: "'Rajdhani',sans-serif",
          }}
        >
          Figurinhas colecionáveis · {PRICE_PACOTE} gold cada
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 24,
            justifyContent: 'center',
          }}
        >
          <button
            onClick={() => setQty(Math.max(1, qty - 1))}
            style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              background: 'rgba(255,255,255,.06)',
              border: '1px solid rgba(255,255,255,.12)',
              color: '#fff',
              fontSize: 22,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            −
          </button>
          <div
            style={{
              fontFamily: "'Orbitron',monospace",
              fontSize: 32,
              fontWeight: 900,
              color: '#fff',
              minWidth: 60,
              textAlign: 'center',
            }}
          >
            {qty}
          </div>
          <button
            onClick={() => setQty(Math.min(50, qty + 1))}
            style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              background: 'rgba(255,255,255,.06)',
              border: '1px solid rgba(255,255,255,.12)',
              color: '#fff',
              fontSize: 22,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            +
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            marginBottom: 20,
            justifyContent: 'center',
          }}
        >
          {[1, 5, 10].map((n) => (
            <button
              key={n}
              onClick={() => setQty(n)}
              style={{
                background:
                  qty === n ? 'rgba(192,132,252,.2)' : 'rgba(255,255,255,.05)',
                border: `1px solid ${
                  qty === n ? '#c084fc' : 'rgba(255,255,255,.1)'
                }`,
                borderRadius: 7,
                padding: '7px 16px',
                color: qty === n ? '#c084fc' : 'rgba(255,255,255,.4)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: "'Rajdhani',sans-serif",
              }}
            >
              ×{n}
            </button>
          ))}
        </div>

        <div
          style={{
            background: 'rgba(0,0,0,.25)',
            border: '1px solid rgba(255,255,255,.08)',
            borderRadius: 10,
            padding: '14px 16px',
            marginBottom: 20,
          }}
        >
          {[
            {
              label: 'Preço unitário',
              value: `${PRICE_PACOTE} gold`,
              color: 'rgba(255,255,255,.6)',
            },
            {
              label: 'Seu saldo',
              value: `${gold.toLocaleString('pt-BR')} gold`,
              color: 'rgba(255,255,255,.6)',
            },
            {
              label: 'Total',
              value: `${total.toLocaleString('pt-BR')} gold`,
              color: '#f5c842',
            },
            {
              label: diff >= 0 ? 'Vai sobrar' : 'Faltam',
              value: `${Math.abs(diff).toLocaleString('pt-BR')} gold`,
              color: diff >= 0 ? '#4ade80' : '#f87171',
            },
          ].map((row) => (
            <div
              key={row.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 6,
                fontSize: 13,
                fontFamily: "'Rajdhani',sans-serif",
              }}
            >
              <span style={{ color: 'rgba(255,255,255,.4)' }}>{row.label}</span>
              <span style={{ fontWeight: 700, color: row.color }}>{row.value}</span>
            </div>
          ))}
        </div>

        <button
          onClick={confirm}
          disabled={!canBuy}
          style={{
            width: '100%',
            background: canBuy
              ? 'linear-gradient(135deg,#c084fc,#818cf8)'
              : 'rgba(255,255,255,.06)',
            border: 'none',
            borderRadius: 9,
            padding: '14px',
            color: canBuy ? '#fff' : 'rgba(255,255,255,.2)',
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: 1.5,
            cursor: canBuy ? 'pointer' : 'not-allowed',
            fontFamily: "'Rajdhani',sans-serif",
            transition: 'all .2s',
          }}
        >
          {loading
            ? 'COMPRANDO...'
            : canBuy
            ? `COMPRAR AGORA · ${total.toLocaleString('pt-BR')} GOLD`
            : 'SALDO INSUFICIENTE'}
        </button>
      </div>
    </div>
  )
}

function Pack3DCard({
  frontSrc,
  backSrc,
  label,
  accent,
  fallbackIcon,
}: {
  frontSrc: string
  backSrc?: string
  label: string
  accent: string
  fallbackIcon: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [showBack, setShowBack] = useState(false)
  const [imgError, setImgError] = useState(false)

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    const nx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2)
    const ny = (e.clientY - (r.top + r.height / 2)) / (r.height / 2)
    ref.current.style.transform = `rotateY(${-nx * 14}deg) rotateX(${ny * 6}deg)`
  }

  const onLeave = () => {
    if (!ref.current) return
    ref.current.style.transform = 'rotateY(0deg) rotateX(0deg)'
  }

  const currentSrc = backSrc && showBack ? backSrc : frontSrc

  return (
    <div style={{ perspective: 1000 }} onMouseMove={onMove} onMouseLeave={onLeave}>
      <div
        ref={ref}
        onClick={() => {
          if (!backSrc) return
          setImgError(false)
          setShowBack((s) => !s)
        }}
        style={{
          width: 200,
          height: 270,
          borderRadius: 16,
          background: `linear-gradient(135deg, ${accent}22, ${accent}0a)`,
          border: `1px solid ${accent}44`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          transition: 'transform .35s ease',
          boxShadow: `0 8px 32px ${accent}22`,
          cursor: backSrc ? 'pointer' : 'default',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'conic-gradient(from 180deg, rgba(255,255,255,.08), rgba(0,255,255,.04), rgba(255,0,255,.04), rgba(255,255,255,.06))',
            mixBlendMode: 'overlay',
            pointerEvents: 'none',
          }}
        />

        {!imgError ? (
          <img
            key={currentSrc}
            src={currentSrc}
            alt={label}
            style={{
              maxWidth: '85%',
              maxHeight: '85%',
              objectFit: 'contain',
              position: 'relative',
              zIndex: 1,
            }}
            onError={() => setImgError(true)}
          />
        ) : (
          <div style={{ fontSize: 64, zIndex: 1, position: 'relative' }}>
            {fallbackIcon}
          </div>
        )}

        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            padding: '2px 6px',
            borderRadius: 6,
            fontSize: 8,
            letterSpacing: 1,
            fontWeight: 700,
            color: accent,
            border: `1px solid ${accent}55`,
            background: 'rgba(0,0,0,.35)',
            fontFamily: "'Rajdhani',sans-serif",
          }}
        >
          {showBack ? 'VERSO' : 'FRENTE'}
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 10,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontFamily: "'Rajdhani',sans-serif",
            fontWeight: 700,
            fontSize: 10,
            color: accent,
            letterSpacing: 2,
          }}
        >
          {label.toUpperCase()}
        </div>
      </div>
    </div>
  )
}

export default function ShopPage({ setPage }: { setPage: (p: any) => void }) {
  const { gold, refreshGold, isLogged } = useAuth()
  const [pacotesFechados, setPacotesFechados] = useState(0)
  const [buyModalOpen, setBuyModalOpen] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' | '' }>({
    msg: '',
    type: '',
  })
  const [loading, setLoading] = useState(true)
  const [busyItem, setBusyItem] = useState('')

  const showToast = (msg: string, type: 'ok' | 'err') => {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg: '', type: '' }), 2600)
  }

  const loadCounts = async () => {
    setLoading(true)

    try {
      const pacs = await api.listarPacotesFechados()
      const arr = pacs?.resultados?.pacotes ?? pacs?.pacotes ?? []
      setPacotesFechados(Array.isArray(arr) ? arr.length : pacs?.quantidade ?? 0)
    } catch {
      setPacotesFechados(0)
    }

    setLoading(false)
  }

  useEffect(() => {
    loadCounts()
  }, [isLogged])

  const handleBuy = async (qty: number) => {
    try {
      await api.comprarPacotes(qty)
      await refreshGold()
      await loadCounts()
      showToast(`✓ ${qty} pacote(s) comprado(s)!`, 'ok')
    } catch (err: any) {
      showToast(err.message || 'Erro na compra', 'err')
      throw err
    }
  }

  const buyBonus = async () => {
    try {
      await api.comprarBonusPontos()
      await refreshGold()
      showToast('✓ Bônus de pontos comprado com sucesso!', 'ok')
    } catch (err: any) {
      showToast(err.message || 'Erro ao comprar bônus', 'err')
    }
  }

  const buyBoostXp = async () => {
    setBusyItem('boost-xp')
    try {
      await api.comprarBoostXp()
      await refreshGold()
      showToast('✓ Boost de XP comprado! +50 XP', 'ok')
    } catch (err: any) {
      showToast(err.message || 'Erro ao comprar boost', 'err')
    } finally {
      setBusyItem('')
    }
  }

  const buyReroll = async () => {
    setBusyItem('reroll')
    try {
      await api.rerollMissoes()
      await refreshGold()
      showToast('✓ Missões trocadas com sucesso!', 'ok')
    } catch (err: any) {
      showToast(err.message || 'Erro ao trocar missões', 'err')
    } finally {
      setBusyItem('')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div
        style={{
          background:
            'linear-gradient(135deg,rgba(245,200,66,.1) 0%,rgba(192,132,252,.07) 100%)',
          border: '1px solid rgba(245,200,66,.2)',
          borderRadius: 18,
          padding: '18px 22px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
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
            🛒 Loja
          </div>
          <h1
            style={{
              fontFamily: "'Orbitron',monospace",
              fontSize: 21,
              fontWeight: 900,
              color: '#fff',
              margin: 0,
              letterSpacing: 2,
            }}
          >
            MIX <span style={{ color: '#f5c842' }}>SHOP</span>
          </h1>
          <div
            style={{
              fontSize: 13,
              color: 'rgba(255,255,255,.4)',
              marginTop: 4,
              fontFamily: "'Rajdhani',sans-serif",
            }}
          >
            Use seu Gold para comprar pacotes e itens
          </div>
        </div>

        <div
          style={{
            background: 'rgba(245,200,66,.1)',
            border: '1px solid rgba(245,200,66,.3)',
            borderRadius: 12,
            padding: '9px 14px',
            textAlign: 'center',
            minWidth: 116,
          }}
        >
          <div
            style={{
              fontSize: 9,
              color: 'rgba(245,200,66,.6)',
              letterSpacing: 1.6,
              marginBottom: 3,
              fontFamily: "'Rajdhani',sans-serif",
              fontWeight: 700,
            }}
          >
            SEU SALDO
          </div>
          <div
            style={{
              fontFamily: "'Orbitron',monospace",
              fontSize: 20,
              fontWeight: 700,
              color: '#f5c842',
            }}
          >
            {gold.toLocaleString('pt-BR')}
          </div>
          <div
            style={{
              fontSize: 10,
              color: 'rgba(245,200,66,.82)',
              fontFamily: "'Rajdhani',sans-serif",
              fontWeight: 700,
              letterSpacing: 0.8,
            }}
          >
            GOLD
          </div>
        </div>
      </div>

      {isLogged && (
        <div className='grid grid-cols-1 gap-3.5'>
          <div
            style={{
              background: 'rgba(192,132,252,.08)',
              border: '1px solid rgba(192,132,252,.22)',
              borderRadius: 14,
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img
                src='/uploads/figurinhas/pacote.png'
                alt='Pacote de figurinhas'
                style={{
                  width: 40,
                  height: 40,
                  objectFit: 'contain',
                  borderRadius: 8,
                  border: '1px solid rgba(192,132,252,.35)',
                  background: 'rgba(255,255,255,.04)',
                  padding: 3,
                }}
              />
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: 'rgba(255,255,255,.35)',
                    letterSpacing: 1.5,
                    fontFamily: "'Rajdhani',sans-serif",
                    fontWeight: 700,
                    marginBottom: 3,
                  }}
                >
                  PACOTES FECHADOS
                </div>
                <div
                  style={{
                    fontFamily: "'Orbitron',monospace",
                    fontSize: 24,
                    fontWeight: 700,
                    color: '#c084fc',
                  }}
                >
                  {loading ? '—' : pacotesFechados}
                </div>
              </div>
            </div>
            <Btn
              onClick={() => setPage('album')}
              color='#c084fc'
              size='lg'
              variant='outline'
              className='!text-sm sm:!text-[15px] min-h-[42px] sm:min-h-[46px] !px-4 sm:!px-5'
            >
              IR AO ÁLBUM →
            </Btn>
          </div>
        </div>
      )}

      <Card
        title='Pacote de Figurinhas'
        titleStyle={{ paddingLeft: 5, marginTop: 2 }}
        badgeColor='#c084fc'
      >
        <div className='grid grid-cols-1 xl:grid-cols-[220px_minmax(0,1fr)] gap-5 items-start'>
          <Pack3DCard
            frontSrc='/uploads/figurinhas/pacote.png'
            backSrc='/uploads/figurinhas/pacote_verso.png'
            label='Pacote de Figurinhas'
            accent='#c084fc'
            fallbackIcon='📦'
          />
          <div>
            <p
              style={{
                fontSize: 18,
                color: 'rgba(255,255,255,.5)',
                fontFamily: "'Rajdhani',sans-serif",
                lineHeight: 1.6,
                marginBottom: 16,
              }}
            >
              Desbloqueie figurinhas com raridades variadas. Cada pacote contem 4 figurinhas. Clique no pacote
              para virar entre frente e verso.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {[
                { label: 'Normal', pct: '60%', color: '#94a3b8' },
                { label: 'Épica', pct: '24%', color: '#c084fc' },
                { label: 'Lendária', pct: '12%', color: '#f5c842' },
                { label: 'Mítica', pct: '3%', color: '#ff22da' },
                { label: 'God', pct: '1%', color: '#2cadf8' },
              ].map((r) => (
                <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      fontSize: 18,
                      color: r.color,
                      width: 65,
                      fontFamily: "'Rajdhani',sans-serif",
                      fontWeight: 700,
                    }}
                  >
                    {r.label}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: 4,
                      background: 'rgba(255,255,255,.07)',
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: r.pct,
                        background: r.color,
                        borderRadius: 2,
                        boxShadow: `0 0 6px ${r.color}88`,
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      color: 'rgba(255,255,255,.3)',
                      width: 32,
                      textAlign: 'right',
                      fontFamily: "'Orbitron',monospace",
                    }}
                  >
                    {r.pct}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {isLogged ? (
                <>
                  <Btn
                    onClick={() => handleBuy(1).catch(() => {})}
                    color='#c084fc'
                    size='lg'
                    className={SHOP_BUY_BTN_CLASS}
                  >
                    1 pacote · {PRICE_PACOTE}g
                  </Btn>
                  <Btn
                    onClick={() => handleBuy(5).catch(() => {})}
                    color='#c084fc'
                    variant='outline'
                    size='lg'
                    className={SHOP_BUY_BTN_CLASS}
                  >
                    5 · {PRICE_PACOTE * 5}g
                  </Btn>
                  <Btn
                    onClick={() => handleBuy(10).catch(() => {})}
                    color='#c084fc'
                    variant='outline'
                    size='lg'
                    className={SHOP_BUY_BTN_CLASS}
                  >
                    10 · {PRICE_PACOTE * 10}g
                  </Btn>
                  <Btn
                    onClick={() => setBuyModalOpen(true)}
                    color='#f5c842'
                    variant='outline'
                    size='lg'
                    className={SHOP_BUY_BTN_CLASS}
                  >
                    Personalizado
                  </Btn>
                </>
              ) : (
                <div
                  style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,.3)',
                    fontFamily: "'Rajdhani',sans-serif",
                  }}
                >
                  Faça login para comprar
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card
        title='Bônus de Pontos +10'
        titleStyle={{ paddingLeft: 5, marginTop: 2 }}
        badgeColor='#f5c842'
      >
        <div className='grid grid-cols-1 xl:grid-cols-[220px_minmax(0,1fr)] gap-5 items-start'>
          <Pack3DCard
            frontSrc='/uploads/shop/bonus.png'
            label='Bônus de Pontos'
            accent='#f5c842'
            fallbackIcon='⭐'
          />
          <div>
            <p
              style={{
                fontSize: 18,
                color: 'rgba(255,255,255,.5)',
                fontFamily: "'Rajdhani',sans-serif",
                lineHeight: 1.6,
                marginBottom: 16,
              }}
            >
              Adiciona +10 pontos na última partida importada. Ideal para subir
              no ranking.
            </p>
            {isLogged ? (
              <Btn onClick={buyBonus} color='#f5c842' size='lg' className={SHOP_BUY_BTN_CLASS}>
                Comprar · 100g
              </Btn>
            ) : (
              <div
                style={{
                  fontSize: 12,
                  color: 'rgba(255,255,255,.3)',
                  fontFamily: "'Rajdhani',sans-serif",
                }}
              >
                Faça login para comprar
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card
        title='Boost de XP +50'
        titleStyle={{ paddingLeft: 5, marginTop: 2 }}
        badgeColor='#22d3ee'
      >
        <div className='grid grid-cols-1 xl:grid-cols-[220px_minmax(0,1fr)] gap-5 items-start'>
          <Pack3DCard
            frontSrc='/uploads/shop/boost_xp.png'
            label='Boost de XP'
            accent='#22d3ee'
            fallbackIcon='⚡'
          />
          <div>
            <p
              style={{
                fontSize: 18,
                color: 'rgba(255,255,255,.5)',
                fontFamily: "'Rajdhani',sans-serif",
                lineHeight: 1.6,
                marginBottom: 16,
              }}
            >
              Adiciona +50 XP de level instantaneamente. Suba de nível mais rápido e desbloqueie novas molduras.
            </p>
            {isLogged ? (
              <Btn
                onClick={buyBoostXp}
                color='#22d3ee'
                size='lg'
                className={SHOP_BUY_BTN_CLASS}
                disabled={busyItem === 'boost-xp'}
              >
                {busyItem === 'boost-xp' ? 'Comprando...' : 'Comprar · 80g'}
              </Btn>
            ) : (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', fontFamily: "'Rajdhani',sans-serif" }}>
                Faça login para comprar
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card
        title='Reroll de Missões'
        titleStyle={{ paddingLeft: 5, marginTop: 2 }}
        badgeColor='#f472b6'
      >
        <div className='grid grid-cols-1 xl:grid-cols-[220px_minmax(0,1fr)] gap-5 items-start'>
          <Pack3DCard
            frontSrc='/uploads/shop/reroll.png'
            label='Reroll Missões'
            accent='#f472b6'
            fallbackIcon='🔄'
          />
          <div>
            <p
              style={{
                fontSize: 18,
                color: 'rgba(255,255,255,.5)',
                fontFamily: "'Rajdhani',sans-serif",
                lineHeight: 1.6,
                marginBottom: 16,
              }}
            >
              Troque suas missões atuais por novas aleatórias. Útil quando uma missão é muito difícil ou demorada.
            </p>
            {isLogged ? (
              <Btn
                onClick={buyReroll}
                color='#f472b6'
                size='lg'
                className={SHOP_BUY_BTN_CLASS}
                disabled={busyItem === 'reroll'}
              >
                {busyItem === 'reroll' ? 'Trocando...' : 'Trocar · 30g'}
              </Btn>
            ) : (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', fontFamily: "'Rajdhani',sans-serif" }}>
                Faça login para comprar
              </div>
            )}
          </div>
        </div>
      </Card>

      {buyModalOpen && (
        <BuyModal
          gold={gold}
          onClose={() => setBuyModalOpen(false)}
          onBuy={handleBuy}
        />
      )}
      <Toast msg={toast.msg} type={toast.type} />
    </div>
  )
}
