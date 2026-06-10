import { type MouseEvent } from 'react'
import { RARITY_STYLE, type SlotView } from './types'
import { updateHoloPointerVars } from './utils'
import ZeusStormOverlay from './ZeusStormOverlay'

export default function DetailModal({
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
              loading='lazy'
              decoding='async'
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
