import { useAnimIn } from '@/hooks/useCounter'

export interface LinePoint {
  label: string
  value: number
}

interface Props {
  data: LinePoint[]
  color?: string
  height?: number
  showLabels?: boolean
  showValues?: boolean
  gradientId?: string
}

export function LineChart({
  data,
  color = '#c084fc',
  height = 150,
  showLabels = true,
  showValues = true,
  gradientId = 'lineGrad',
}: Props) {
  const animated = useAnimIn(200)

  const W = 500
  const H = height
  const PL = 12, PR = 12, PT = 16, PB = 28

  const max = Math.max(...data.map(d => d.value), 1)
  const toX = (i: number) => PL + (i / Math.max(data.length - 1, 1)) * (W - PL - PR)
  const toY = (v: number) => PT + (1 - v / max) * (H - PT - PB)

  const lineD = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d.value)}`).join(' ')
  const areaD = `${lineD} L${toX(data.length - 1)},${H - PB} L${toX(0)},${H - PB} Z`

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(p => (
        <line key={p}
          x1={PL} y1={PT + p * (H - PT - PB)}
          x2={W - PR} y2={PT + p * (H - PT - PB)}
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={1}
          strokeDasharray="4,4"
        />
      ))}

      {/* Area fill */}
      {animated && (
        <path d={areaD} fill={`url(#${gradientId})`} />
      )}

      {/* Line */}
      {animated && (
        <path
          d={lineD}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 4px ${color}88)` }}
        />
      )}

      {/* Dots */}
      {animated && data.map((d, i) => (
        <circle key={i}
          cx={toX(i)} cy={toY(d.value)}
          r={4}
          fill={color}
          stroke="#09091a"
          strokeWidth={2}
        />
      ))}

      {/* Value labels */}
      {animated && showValues && data.map((d, i) => (
        <text key={i}
          x={toX(i)} y={toY(d.value) - 9}
          textAnchor="middle"
          fill={color}
          fontSize={9}
          fontWeight="700"
          fontFamily="'Orbitron', monospace"
        >
          {d.value}
        </text>
      ))}

      {/* X-axis labels */}
      {showLabels && data.map((d, i) => (
        <text key={i}
          x={toX(i)} y={H - 6}
          textAnchor="middle"
          fill="rgba(255,255,255,0.3)"
          fontSize={9}
          fontFamily="'Rajdhani', sans-serif"
        >
          {d.label}
        </text>
      ))}
    </svg>
  )
}
