import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'

export const LEVEL_NAME_BY_ID = {
  0: 'Newba',
  1: 'Coitado',
  2: 'Iniciante',
  3: 'Nexus',
  4: 'Bronze',
  5: 'Prata',
  6: 'Ouro',
  7: 'Platina',
  8: 'Esmeralda',
  9: 'Diamante',
  10: 'Elite',
  11: 'Fantasma',
  12: 'Tempestade',
  13: 'Inferno',
  14: 'Celestial',
  15: 'Lendário',
} as const

export const LEVEL_COLOR_BY_ID: Record<number, string> = {
  0: '#94a3b8',
  1: '#38bdf8',
  2: '#22d3ee',
  3: '#2dd4bf',
  4: '#cd7f32',
  5: '#cbd5e1',
  6: '#facc15',
  7: '#bae6fd',
  8: '#34d399',
  9: '#60a5fa',
  10: '#a855f7',
  11: '#8b5cf6',
  12: '#d946ef',
  13: '#f97316',
  14: '#a78bfa',
  15: '#fde68a',
}

export const LEVEL_GLOW_BY_ID: Record<number, string> = {
  0: 'rgba(148,163,184,.45)',
  1: 'rgba(56,189,248,.55)',
  2: 'rgba(34,211,238,.55)',
  3: 'rgba(45,212,191,.55)',
  4: 'rgba(205,127,50,.55)',
  5: 'rgba(203,213,225,.55)',
  6: 'rgba(250,204,21,.6)',
  7: 'rgba(125,211,252,.6)',
  8: 'rgba(52,211,153,.58)',
  9: 'rgba(96,165,250,.62)',
  10: 'rgba(168,85,247,.68)',
  11: 'rgba(139,92,246,.7)',
  12: 'rgba(217,70,239,.72)',
  13: 'rgba(249,115,22,.75)',
  14: 'rgba(99,102,241,.75)',
  15: 'rgba(253,186,116,.85)',
}

export type PlayerProfilePreviewProps = {
  playerName: string
  avatarUrl?: string
  level: number
  levelIconUrl: string
  points: number
  wins: number
  losses: number
  currentXp: number
  nextLevelXp: number
  online?: boolean
  className?: string
  style?: CSSProperties
}

function clampLevel(value: number) {
  const n = Number.isFinite(value) ? Math.round(value) : 0
  return Math.max(0, Math.min(15, n))
}
const MAX_LEVEL = 15

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function fmt(value: number) {
  return Number.isFinite(value) ? value.toLocaleString('pt-BR') : '0'
}

function StatItem({
  icon,
  value,
  label,
  color,
}: {
  icon: string
  value: string | number
  label: string
  color: string
}) {
  return (
    <div
      style={{
        borderRadius: 11,
        border: '1px solid rgba(255,255,255,.1)',
        background: 'rgba(7,11,24,.8)',
        padding: '8px 8px 9px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 15, marginBottom: 4 }}>{icon}</div>
      <div
        style={{
          fontFamily: "'Orbitron',monospace",
          fontSize: 27,
          lineHeight: 1,
          color,
          fontWeight: 800,
          marginBottom: 2,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: "'Rajdhani',sans-serif",
          fontWeight: 700,
          fontSize: 10,
          letterSpacing: 1,
          color: 'rgba(255,255,255,.6)',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
    </div>
  )
}

export default function PlayerProfilePreview({
  playerName,
  avatarUrl,
  level,
  levelIconUrl,
  points,
  wins,
  losses,
  currentXp,
  nextLevelXp,
  online = true,
  className = '',
  style,
}: PlayerProfilePreviewProps) {
  const lv = clampLevel(level)
  const isMaxLevel = lv >= MAX_LEVEL
  const levelName = LEVEL_NAME_BY_ID[lv as keyof typeof LEVEL_NAME_BY_ID] || 'Newba'
  const accent = LEVEL_COLOR_BY_ID[lv] || '#a78bfa'
  const glow = LEVEL_GLOW_BY_ID[lv] || 'rgba(168,85,247,.7)'
  const xpPercent = isMaxLevel
    ? 100
    : clampPercent(nextLevelXp > 0 ? (currentXp / nextLevelXp) * 100 : 0)
  const levelImageCandidates = useMemo(
    () =>
      Array.from(
        new Set([
          levelIconUrl,
          `/level-icons/level-${lv}.png`,
          `/level-icons/level ${lv}.png`,
          `/uploads/levels/level ${lv}.png`,
          `/uploads/levels/level%20${lv}.png`,
          `/uploads/levels/level_${lv}.png`,
          `/uploads/levels/level-${lv}.png`,
          `/uploads/levels/${lv}.png`,
        ])
      ),
    [levelIconUrl, lv]
  )
  const [levelImageIndex, setLevelImageIndex] = useState(0)
  const levelImageSrc =
    levelImageCandidates[levelImageIndex] || `/uploads/levels/level ${lv}.png`
  useEffect(() => {
    setLevelImageIndex(0)
  }, [lv, levelIconUrl])

  return (
    <aside
      className={className}
        style={{
          height: '100%',
          borderRadius: 18,
          border: `1px solid ${accent}88`,
          background: 'rgba(255,255,255,0.025)',
          boxShadow: `0 0 0 1px rgba(255,255,255,.03) inset, 0 0 34px ${glow}`,
        padding: 16,
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px)',
          backgroundSize: '38px 38px',
          opacity: 0.22,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: -100,
          width: 250,
          height: 250,
          borderRadius: '50%',
          transform: 'translateX(-50%)',
          background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`,
          filter: 'blur(20px)',
          pointerEvents: 'none',
        }}
      />

        <div style={{ position: 'relative', zIndex: 1 }}>
        <style>{`
          @keyframes level-infinite-xp-shift {
            0% { background-position: 0% 0; }
            100% { background-position: 200% 0; }
          }
        `}</style>
        <div
          style={{
            fontFamily: "'Rajdhani',sans-serif",
            fontWeight: 700,
            fontSize: 10,
            letterSpacing: 2.4,
            color: 'rgba(255,255,255,.65)',
            textTransform: 'uppercase',
            textAlign: 'center',
          }}
        >
          Perfil do Jogador
        </div>

        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                inset: -16,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`,
                filter: 'blur(14px)',
              }}
            />
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={`Avatar de ${playerName}`}
                style={{
                  position: 'relative',
                  width: 108,
                  height: 108,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: `4px solid ${accent}`,
                  boxShadow: `0 0 22px ${glow}`,
                }}
              />
            ) : (
              <div
                style={{
                  position: 'relative',
                  width: 108,
                  height: 108,
                  borderRadius: '50%',
                  border: `4px solid ${accent}`,
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff',
                  fontFamily: "'Orbitron',monospace",
                  fontSize: 32,
                  fontWeight: 800,
                  background: 'rgba(17,23,44,.9)',
                  boxShadow: `0 0 22px ${glow}`,
                }}
              >
                {String(playerName || '?').slice(0, 1).toUpperCase()}
              </div>
            )}
            <span
              style={{
                position: 'absolute',
                right: 4,
                bottom: 4,
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: online ? '#4ade80' : '#64748b',
                border: '3px solid #0a1021',
                boxShadow: online ? '0 0 10px rgba(74,222,128,.85)' : 'none',
              }}
            />
          </div>

          <h2
            style={{
              marginTop: 12,
              marginBottom: 0,
              fontFamily: "'Rajdhani',sans-serif",
              fontSize: 44,
              lineHeight: 1,
              fontWeight: 700,
              color: '#fff',
            }}
          >
            {playerName}
          </h2>
        </div>

        <div style={{ marginTop: 10, minHeight: 182, display: 'grid', placeItems: 'center' }}>
          <img
            src={levelImageSrc}
            alt={`Ícone level ${lv} ${levelName}`}
            style={{
              maxHeight: 190,
              width: 'auto',
              objectFit: 'contain',
              filter: `drop-shadow(0 0 18px ${glow})`,
            }}
            onError={() => {
              setLevelImageIndex((prev) => {
                const next = prev + 1
                return next < levelImageCandidates.length ? next : prev
              })
            }}
          />
        </div>

        <div
          style={{
            margin: '6px auto 0',
            width: '100%',
            borderRadius: 10,
            border: `1px solid ${accent}88`,
            background: 'rgba(7,12,26,.88)',
            boxShadow: `0 0 16px ${glow}`,
            padding: '7px 10px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontFamily: "'Orbitron',monospace",
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: 1.2,
              color: accent,
              textTransform: 'uppercase',
            }}
          >
            Level {lv}
          </div>
          <div
            style={{
              marginTop: 1,
              fontFamily: "'Rajdhani',sans-serif",
              fontWeight: 700,
              fontSize: 34,
              lineHeight: 1,
              color: '#fff',
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            {levelName}
          </div>
        </div>

        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8 }}>
          <StatItem icon="⭐" value={fmt(points)} label="Pontos" color="#facc15" />
          <StatItem icon="⚡" value={lv} label="Level" color={accent} />
          <StatItem icon="🏆" value={fmt(wins)} label="Vitórias" color="#f59e0b" />
          <StatItem icon="💀" value={fmt(losses)} label="Derrotas" color="#fb7185" />
        </div>

        <div
          style={{
            marginTop: 11,
            borderRadius: 11,
            border: '1px solid rgba(255,255,255,.08)',
            background: 'rgba(0,0,0,.12)',
            padding: '10px 10px 9px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontFamily: "'Rajdhani',sans-serif",
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: 'uppercase',
                fontSize: 11,
                color: accent,
              }}
            >
              XP Progress
            </span>
            <span
              style={{
                fontFamily: "'Orbitron',monospace",
                fontWeight: 700,
                fontSize: 10,
                color: 'rgba(255,255,255,.7)',
              }}
            >
              {isMaxLevel ? `${fmt(currentXp)} XP` : `${fmt(currentXp)} / ${fmt(nextLevelXp)} XP`}
            </span>
          </div>
          <div
            style={{
              height: 9,
              borderRadius: 999,
              background: 'rgba(255,255,255,.09)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${xpPercent}%`,
                background: isMaxLevel
                  ? `linear-gradient(90deg, ${accent} 0%, #fde68a 35%, #8b5cf6 70%, ${accent} 100%)`
                  : `linear-gradient(90deg, ${accent}, #8b5cf6)`,
                backgroundSize: isMaxLevel ? '200% 100%' : undefined,
                animation: isMaxLevel ? 'level-infinite-xp-shift 2.4s linear infinite' : undefined,
                boxShadow: `0 0 12px ${glow}`,
              }}
            />
          </div>
          {!isMaxLevel && (
            <div
              style={{
                marginTop: 6,
                textAlign: 'center',
                fontFamily: "'Rajdhani',sans-serif",
                fontWeight: 700,
                fontSize: 14,
                color: accent,
              }}
            >
              {Math.round(xpPercent)}% para o proximo level
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
