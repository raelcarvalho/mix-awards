interface Props {
  nome: string
  imagem?: string
  color?: string
  size?: number
  online?: boolean
  showGlow?: boolean
}

export function PlayerAvatar({ nome, imagem, color = '#c084fc', size = 40, online, showGlow = false }: Props) {
  const initial = nome?.[0]?.toUpperCase() ?? '?'
  const borderSize = Math.max(2, size * 0.05)
  const indicatorSize = Math.max(8, size * 0.22)

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {imagem ? (
        <img
          src={imagem}
          alt={nome}
          style={{
            width: size, height: size,
            borderRadius: '50%',
            objectFit: 'cover',
            border: `${borderSize}px solid ${color}66`,
            boxShadow: showGlow ? `0 0 ${size * 0.4}px ${color}44` : 'none',
          }}
          onError={e => {
            const img = e.target as HTMLImageElement
            img.style.display = 'none'
            const div = document.createElement('div')
            div.textContent = initial
            div.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${color}22;border:${borderSize}px solid ${color}66;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:${size * 0.4}px;color:${color};`
            img.parentElement?.appendChild(div)
          }}
        />
      ) : (
        <div style={{
          width: size, height: size,
          borderRadius: '50%',
          background: `${color}22`,
          border: `${borderSize}px solid ${color}66`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900,
          fontSize: size * 0.4,
          color,
          boxShadow: showGlow ? `0 0 ${size * 0.4}px ${color}44` : 'none',
        }}>
          {initial}
        </div>
      )}

      {online !== undefined && (
        <div style={{
          position: 'absolute',
          bottom: borderSize,
          right: borderSize,
          width: indicatorSize,
          height: indicatorSize,
          borderRadius: '50%',
          background: online ? '#4ade80' : 'rgba(255,255,255,0.2)',
          border: `2px solid #09091a`,
          boxShadow: online ? '0 0 6px #4ade80' : 'none',
        }} />
      )}
    </div>
  )
}
