import { useEffect, useMemo, useRef, useState } from 'react'

export interface PlayerOption {
  id: number
  nome: string
  imagem?: string | null
  qtd_partidas?: number
}

interface Props {
  label: string
  color: string
  options: PlayerOption[]
  value: number | null
  onChange: (id: number | null) => void
  disabled?: boolean
  placeholder?: string
}

/**
 * Dropdown de jogador com busca por nome. Fecha ao clicar fora — o listener de
 * document é registrado apenas enquanto o dropdown está aberto e removido no
 * cleanup do efeito.
 *
 * NOTA: o reset global de index.css (`* { margin: 0; padding: 0 }`) não está em
 * @layer, então anula os utilitários de espaçamento do Tailwind. Padding aqui
 * vai por style inline; espaçamento entre elementos usa `gap`, que funciona.
 */
export default function PlayerSelect({
  label,
  color,
  options,
  value,
  onChange,
  disabled,
  placeholder = 'Buscar jogador...',
}: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement | null>(null)

  const selected = useMemo(
    () => options.find((o) => o.id === value) || null,
    [options, value]
  )

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return options
    return options.filter((o) => String(o.nome || '').toLowerCase().includes(term))
  }, [options, search])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current) return
      if (containerRef.current.contains(event.target as Node)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // Se a lista mudar (troca de temporada) e o jogador selecionado não jogou
  // aquela temporada, limpa a seleção.
  useEffect(() => {
    if (value === null) return
    if (options.some((o) => o.id === value)) return
    onChange(null)
  }, [options, value, onChange])

  return (
    <div ref={containerRef} className="relative w-full min-w-0 flex flex-col gap-1.5">
      <span
        className="font-rajdhani text-[10px] font-bold uppercase tracking-[0.2em] leading-4 text-center"
        style={{ color: `${color}aa` }}
      >
        {label}
      </span>

      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setSearch('')
          setOpen((v) => !v)
        }}
        className={`w-full h-12 flex items-center gap-2.5 rounded-xl border text-sm transition-colors
          ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        style={{
          padding: '0 14px',
          background: 'rgba(255,255,255,.05)',
          borderColor: open ? `${color}88` : 'rgba(255,255,255,.12)',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {selected?.imagem ? (
          <img
            src={selected.imagem}
            alt={selected.nome}
            className="w-7 h-7 shrink-0 rounded-full object-cover border"
            style={{ borderColor: `${color}66` }}
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.visibility = 'hidden'
            }}
          />
        ) : (
          <span
            className="w-7 h-7 shrink-0 rounded-full border flex items-center justify-center text-xs font-bold"
            style={{ background: `${color}22`, borderColor: `${color}55`, color }}
          >
            {selected?.nome?.[0]?.toUpperCase() || '?'}
          </span>
        )}

        <span
          className="flex-1 min-w-0 truncate text-left font-rajdhani font-bold"
          style={{ color: selected ? '#fff' : 'rgba(255,255,255,.35)' }}
        >
          {selected?.nome || 'Selecionar jogador'}
        </span>

        <span className="shrink-0 text-[10px]" style={{ color: `${color}aa` }}>
          ▾
        </span>
      </button>

      {open && (
        <div
          className="absolute z-30 left-0 right-0 rounded-xl border shadow-2xl backdrop-blur-md flex flex-col gap-2"
          style={{
            top: 'calc(100% + 6px)',
            padding: 10,
            background: 'rgba(16,16,24,.98)',
            borderColor: `${color}44`,
          }}
        >
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={placeholder}
            className="w-full h-9 rounded-lg border text-sm text-white font-rajdhani outline-none placeholder:text-white/30"
            style={{
              padding: '0 12px',
              background: 'rgba(255,255,255,.05)',
              borderColor: `${color}55`,
            }}
          />

          <div className="max-h-64 overflow-y-auto flex flex-col gap-1">
            {filtered.length === 0 && (
              <span
                className="text-center text-xs text-white/30 font-rajdhani"
                style={{ padding: '16px 0' }}
              >
                Nenhum jogador encontrado
              </span>
            )}

            {filtered.map((o) => {
              const active = o.id === value
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    onChange(o.id)
                    setOpen(false)
                  }}
                  className={`w-full flex items-center gap-2.5 rounded-lg border text-left cursor-pointer transition-colors ${
                    active ? '' : 'border-transparent hover:bg-white/5'
                  }`}
                  style={{
                    padding: '8px 10px',
                    ...(active
                      ? { background: `${color}18`, borderColor: `${color}55` }
                      : null),
                  }}
                >
                  {o.imagem ? (
                    <img
                      src={o.imagem}
                      alt={o.nome}
                      className="w-6 h-6 shrink-0 rounded-full object-cover"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.visibility = 'hidden'
                      }}
                    />
                  ) : (
                    <span className="w-6 h-6 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-[11px] font-bold text-white/60">
                      {o.nome?.[0]?.toUpperCase()}
                    </span>
                  )}

                  <span
                    className="flex-1 min-w-0 truncate text-sm font-bold font-rajdhani"
                    style={{ color: active ? color : '#fff' }}
                  >
                    {o.nome}
                  </span>

                  {o.qtd_partidas !== undefined && (
                    <span className="shrink-0 font-orbitron text-[10px] text-white/35">
                      {o.qtd_partidas}p
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
