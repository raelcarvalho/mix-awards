import { type MouseEvent } from 'react'
import { RARITY_STYLE, type SlotView } from './types'
import { updateHoloPointerVars } from './utils'
import ZeusStormOverlay from './ZeusStormOverlay'

export default function AlbumCard({
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
              loading='lazy'
              decoding='async'
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
