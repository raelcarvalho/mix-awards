import { memo } from 'react'
import { motion } from 'motion/react'
import { getLevelFramePreset } from './levelFramePresets'

const PARTICLES = Array.from({ length: 14 }, (_, index) => index)

function FrameSvg({ preset, size }) {
  return (
    <svg className="level-frame-svg" viewBox="0 0 220 220" aria-hidden="true" style={{ width: size, height: size }}>
      <defs>
        <linearGradient id={`mix-frame-gradient-${preset.level}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={preset.accent} />
          <stop offset="48%" stopColor={preset.tone} />
          <stop offset="100%" stopColor={preset.accent} />
        </linearGradient>
        <filter id={`mix-frame-glow-${preset.level}`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle className="level-frame-ring level-frame-ring--back" cx="110" cy="110" r="84" />
      <circle
        className="level-frame-ring level-frame-ring--main"
        cx="110"
        cy="110"
        r="88"
        stroke={`url(#mix-frame-gradient-${preset.level})`}
        filter={`url(#mix-frame-glow-${preset.level})`}
      />
      <circle className="level-frame-ring level-frame-ring--inner" cx="110" cy="110" r="72" />

      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <g key={angle} transform={`rotate(${angle} 110 110)`} className="level-frame-rune">
          <path d="M110 12 L119 29 L110 43 L101 29 Z" fill={preset.tone} opacity=".9" />
          <path d="M110 18 L114 29 L110 36 L106 29 Z" fill={preset.accent} opacity=".8" />
        </g>
      ))}

      {['legendary', 'celestial', 'gold'].includes(preset.animation) && (
        <g className="level-frame-crown" transform="translate(82 4)">
          <path d="M10 38 L14 16 L29 30 L45 10 L61 30 L76 16 L80 38 Z" fill={preset.tone} opacity=".9" />
          <rect x="10" y="38" width="70" height="10" rx="5" fill={preset.accent} opacity=".75" />
        </g>
      )}

      {['inferno', 'storm', 'phantom'].includes(preset.animation) && (
        <g className="level-frame-aura">
          <path d="M34 116 C45 72 66 58 90 32 C85 68 116 64 112 96 C136 70 164 64 184 36 C176 76 194 88 190 122 C184 167 150 196 110 197 C67 197 28 166 34 116 Z" fill={preset.tone} opacity=".10" />
        </g>
      )}
    </svg>
  )
}

function AvatarContent({ avatarUrl, playerName }) {
  const initial = String(playerName || '?').slice(0, 1).toUpperCase()

  if (avatarUrl) {
    return <img className="level-frame-avatar-img" src={avatarUrl} alt={`Avatar de ${playerName}`} />
  }

  return <span className="level-frame-avatar-initial">{initial}</span>
}

function LevelFrameComponent({
  level = 0,
  avatarUrl,
  playerName = 'Jogador',
  size = 176,
  showLabel = true,
  className = '',
}) {
  const preset = getLevelFramePreset(level)
  const cssVars = {
    '--frame-tone': preset.tone,
    '--frame-accent': preset.accent,
    '--frame-glow': preset.glow,
    '--frame-size': `${size}px`,
  }

  return (
    <motion.div
      className={`level-frame level-frame--${preset.animation} ${className}`}
      style={cssVars}
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ scale: 1.035 }}
      transition={{ type: 'spring', stiffness: 180, damping: 18 }}
    >
      <div className="level-frame-stage" style={{ width: size, height: size }}>
        <div className="level-frame-blur" />
        <FrameSvg preset={preset} size={size} />

        <div className="level-frame-particles" aria-hidden="true">
          {PARTICLES.map((particle) => (
            <span key={particle} style={{ '--i': particle }} />
          ))}
        </div>

        <div className="level-frame-avatar">
          <AvatarContent avatarUrl={avatarUrl} playerName={playerName} />
        </div>
      </div>

      {showLabel && (
        <div className="level-frame-label">
          <span className="level-frame-level">Level {preset.level}</span>
          <strong>{preset.name}</strong>
          <small>{preset.rarity}</small>
        </div>
      )}
    </motion.div>
  )
}

const LevelFrame = memo(LevelFrameComponent)
export default LevelFrame
