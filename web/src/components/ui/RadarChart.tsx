import { useAnimIn } from '@/hooks/useCounter'

export interface RadarStat {
  label: string
  value: number   // 0–100
  color: string
}

interface Props {
  stats: RadarStat[]
  size?: number
}

export function RadarChart({ stats, size = 200 }: Props) {
  const animated = useAnimIn(300)
  const cx = size / 2
  const cy = size / 2
  const r  = size * 0.36
  const n  = stats.length

  const angleOf = (i: number) => (i / n) * 2 * Math.PI - Math.PI / 2

  const dotPos = (i: number, val: number) => {
    const a = angleOf(i)
    const pr = animated ? (val / 100) * r : 0
    return { x: cx + pr * Math.cos(a), y: cy + pr * Math.sin(a) }
  }

  const labelPos = (i: number) => {
    const a = angleOf(i)
    return { x: cx + (r + size * 0.11) * Math.cos(a), y: cy + (r + size * 0.11) * Math.sin(a) }
  }

  const polygonPoints = stats
    .map((s, i) => { const p = dotPos(i, s.value); return `${p.x},${p.y}` })
    .join(' ')

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      {/* Background rings */}
      {[0.25, 0.5, 0.75, 1].map(pct => (
        <polygon key={pct}
          points={stats.map((_, i) => {
            const a = angleOf(i)
            return `${cx + r * pct * Math.cos(a)},${cy + r * pct * Math.sin(a)}`
          }).join(' ')}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={1}
        />
      ))}

      {/* Spokes */}
      {stats.map((_, i) => {
        const a = angleOf(i)
        return (
          <line key={i}
            x1={cx} y1={cy}
            x2={cx + r * Math.cos(a)}
            y2={cy + r * Math.sin(a)}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
        )
      })}

      {/* Filled polygon */}
      <polygon
        points={polygonPoints}
        fill="rgba(192,132,252,0.15)"
        stroke="rgba(192,132,252,0.7)"
        strokeWidth={1.5}
        style={{ transition: 'all 1.3s cubic-bezier(0.2,0.8,0.2,1)' }}
      />

      {/* Dots */}
      {stats.map((s, i) => {
        const p = dotPos(i, s.value)
        return (
          <circle key={i}
            cx={p.x} cy={p.y} r={4}
            fill={s.color}
            stroke="#09091a"
            strokeWidth={2}
            style={{ transition: 'all 1.3s cubic-bezier(0.2,0.8,0.2,1)' }}
          />
        )
      })}

      {/* Labels */}
      {stats.map((s, i) => {
        const lp = labelPos(i)
        return (
          <text key={i}
            x={lp.x} y={lp.y + 4}
            textAnchor="middle"
            fill={s.color}
            fontSize={Math.max(8, size * 0.048)}
            fontWeight={700}
            fontFamily="'Rajdhani', sans-serif"
          >
            {s.label}
          </text>
        )
      })}
    </svg>
  )
}
