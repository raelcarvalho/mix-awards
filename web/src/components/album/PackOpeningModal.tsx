import { useCallback, useEffect, useState } from 'react'
import { Btn } from '@/components/ui/Card'
import { RARITY_STYLE, type Figurinha, type OpenedPackCard } from './types'
import ZeusStormOverlay from './ZeusStormOverlay'

function rotationByIndex(index: number, total: number) {
  if (total <= 1) return 0
  if (total === 2) return [-4, 4][index] ?? 0
  if (total === 3) return [-7, 0, 7][index] ?? 0
  if (total === 4) return [-8, -2, 2, 8][index] ?? 0
  return [-10, -5, 0, 5, 10][index] ?? 0
}

function mapLabelByRarity(rarity: Figurinha['raridade']) {
  return RARITY_STYLE[rarity]?.label || 'Normal'
}

export default function PackOpeningModal({
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
                              loading='lazy'
                              decoding='async'
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
