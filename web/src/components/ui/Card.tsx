import { ReactNode, CSSProperties } from 'react'

// ─── Card ───────────────────────────────────────────────────────────────────
interface CardProps {
  title?: string
  sub?: string
  badge?: string
  badgeColor?: string
  action?: ReactNode
  centerTitle?: boolean
  headerGap?: number | string
  children: ReactNode
  className?: string
  style?: CSSProperties
  titleStyle?: CSSProperties
}

export function Card({
  title,
  sub,
  badge,
  badgeColor = '#c084fc',
  action,
  centerTitle = false,
  headerGap = 20,
  children,
  className = '',
  style,
  titleStyle,
}: CardProps) {
  return (
    <div
      className={`rounded-2xl border p-6 flex flex-col ${className}`}
      style={{ background: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.07)', ...style }}
    >
      {(title || badge || action) && (
        <div
          className={centerTitle ? 'relative' : 'flex justify-between items-start'}
          style={{ marginBottom: typeof headerGap === 'number' ? `${headerGap}px` : headerGap }}
        >
          <div style={centerTitle ? { textAlign: 'center', width: '100%' } : undefined}>
            {sub && (
              <p className="text-xs tracking-widest uppercase mb-1 font-rajdhani font-bold"
                style={{ color: 'rgba(255,255,255,0.3)', textAlign: centerTitle ? 'center' : undefined }}>
                {sub}
              </p>
            )}
            {title && (
              <h2
                className="text-lg font-bold text-white font-rajdhani"
                style={{ textAlign: centerTitle ? 'center' : undefined, ...titleStyle }}
              >
                {title}
              </h2>
            )}
          </div>
          <div
            className="flex gap-2 items-center"
            style={centerTitle ? { position: 'absolute', right: 0, top: 0 } : undefined}
          >
            {badge && (
              <span className="text-xs font-bold tracking-wide px-2 py-1 rounded font-rajdhani"
                style={{ background: `${badgeColor}18`, border: `1px solid ${badgeColor}33`, color: badgeColor }}>
                {badge}
              </span>
            )}
            {action}
          </div>
        </div>
      )}
      {children}
    </div>
  )
}

// ─── StatCard ────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  icon?: string
  color?: string
}

export function StatCard({ label, value, sub, icon, color = '#c084fc' }: StatCardProps) {
  return (
    <div
      className="rounded-2xl p-5 relative overflow-hidden cursor-default transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${color}28`,
      }}
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLElement).style.borderColor = `${color}60`
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLElement).style.borderColor = `${color}28`
      }}
    >
      {/* Glow corner */}
      <div className="absolute -top-4 -right-4 w-18 h-18 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${color}18 0%, transparent 70%)` }} />

      <div className="flex justify-between items-start mb-3">
        <span className="text-xs tracking-widest uppercase font-rajdhani font-bold"
          style={{ color: 'rgba(255,255,255,0.4)' }}>
          {label}
        </span>
        {icon && <span className="text-xl">{icon}</span>}
      </div>

      <div className="font-orbitron text-2xl font-bold text-white leading-none mb-1.5">
        {value}
      </div>

      {sub && (
        <div className="text-xs font-bold font-rajdhani" style={{ color }}>
          {sub}
        </div>
      )}

      {/* Bottom accent */}
      <div className="absolute bottom-0 left-0 h-0.5 w-2/5"
        style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
    </div>
  )
}

// ─── Btn ─────────────────────────────────────────────────────────────────────
interface BtnProps {
  children: ReactNode
  onClick?: () => void
  color?: string
  variant?: 'solid' | 'outline' | 'ghost'
  disabled?: boolean
  fullWidth?: boolean
  size?: 'sm' | 'md' | 'lg'
  type?: 'button' | 'submit'
  className?: string
}

const SIZE_CLASS = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-4 py-2 text-xs',
  lg: 'px-6 py-2.5 text-sm',
}

export function Btn({
  children, onClick, color = '#c084fc',
  variant = 'solid', disabled, fullWidth,
  size = 'md', type = 'button', className = '',
}: BtnProps) {
  const bg =
    variant === 'solid'
      ? `linear-gradient(135deg, ${color}, ${color}aa)`
      : 'transparent'

  const border = variant === 'ghost' ? 'transparent' : `1px solid ${color}55`
  const textColor = variant === 'solid' ? '#fff' : color

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg font-bold tracking-wide font-rajdhani transition-all duration-200 cursor-pointer
        ${SIZE_CLASS[size]} ${fullWidth ? 'w-full' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}`}
      style={{ background: bg, border, color: textColor }}
    >
      {children}
    </button>
  )
}

// ─── Toast ───────────────────────────────────────────────────────────────────
export function Toast({ msg, type }: { msg: string; type: 'ok' | 'err' | '' }) {
  if (!msg) return null
  const color = type === 'ok' ? '#4ade80' : '#f87171'
  return (
    <div
      className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl font-rajdhani font-bold text-sm tracking-wide z-50 backdrop-blur-md"
      style={{
        background: type === 'ok' ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
        border: `1px solid ${color}`,
        color,
        boxShadow: `0 0 24px ${color}22`,
      }}
    >
      {msg}
    </div>
  )
}
