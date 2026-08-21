import { ReactNode } from 'react'

interface Props {
  eyebrow?: string
  title: string
  titleAccent?: string
  accentColor?: string
  subtitle?: string
  action?: ReactNode
  gradient?: string
  borderColor?: string
}

export function PageHeader({
  eyebrow,
  title,
  titleAccent,
  accentColor = '#c084fc',
  subtitle,
  action,
  gradient = 'linear-gradient(135deg, rgba(192,132,252,0.1) 0%, rgba(129,140,248,0.07) 50%, rgba(34,211,238,0.06) 100%)',
  borderColor,
}: Props) {
  return (
    <div
      className="rounded-2xl p-6 flex justify-between items-center gap-5 flex-wrap"
      style={{
        background: gradient,
        border: `1px solid ${borderColor ?? accentColor + '33'}`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Grid pattern */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `linear-gradient(${accentColor}08 1px, transparent 1px), linear-gradient(90deg, ${accentColor}08 1px, transparent 1px)`,
        backgroundSize: '44px 44px',
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {eyebrow && (
          <p className="text-xs font-bold tracking-widest uppercase mb-2 font-rajdhani"
            style={{ color: `${accentColor}bb`, letterSpacing: '0.2em' }}>
            {eyebrow}
          </p>
        )}
        <h1 className="font-orbitron font-black text-white m-0 leading-tight" style={{ fontSize: 'clamp(20px, 3vw, 28px)', letterSpacing: 2 }}>
          {title}{' '}
          {titleAccent && <span style={{ color: accentColor }}>{titleAccent}</span>}
        </h1>
        {subtitle && (
          <p className="text-sm font-rajdhani mt-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {subtitle}
          </p>
        )}
      </div>

      {action && (
        <div style={{ position: 'relative', zIndex: 1, flexShrink: 0 }}>
          {action}
        </div>
      )}
    </div>
  )
}
