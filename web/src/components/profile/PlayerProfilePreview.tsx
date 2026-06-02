import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent } from 'react'

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

const PROFILE_AVATAR_SIZE = 108
const PROFILE_FRAME_STAGE_SIZE = 168
const PROFILE_FRAME_HOLE_TARGET = PROFILE_AVATAR_SIZE + 30

type FrameAdjustment = {
  offsetX: number
  offsetY: number
  scale: number
}

const DEFAULT_FRAME_ADJUSTMENT: FrameAdjustment = {
  offsetX: 0,
  offsetY: 0,
  scale: 1,
}

// Ajustes oficiais por level (produção): altere estes valores e suba o código.
const FRAME_ADJUSTMENT_BY_LEVEL: Record<number, FrameAdjustment> = {
  1: { offsetX: -2, offsetY: 6, scale: 1.16 },
  2: { offsetX: -2, offsetY: -1, scale: 1.14 },
  3: { offsetX: -1, offsetY: 7, scale: 1.37 },
  4: { offsetX: 0, offsetY: 5, scale: 1.16 },
  5: { offsetX: 0, offsetY: 3, scale: 1.19 },
  6: { offsetX: 0, offsetY: -6, scale: 1.26 },
  7: { offsetX: 0, offsetY: 2, scale: 1.35 },
  8: { offsetX: -1, offsetY: -10, scale: 1.21 },
  9: { offsetX: 0, offsetY: 3, scale: 1.3 },
  10: { offsetX: 1, offsetY: -5, scale: 1.27 },
  11: { offsetX: -6, offsetY: 12, scale: 1.54 },
  12: { offsetX: -3, offsetY: -4, scale: 1.35 },
  13: { offsetX: -1, offsetY: 7, scale: 1.4 },
  14: { offsetX: 0, offsetY: -4, scale: 1.3 },
  15: { offsetX: 0, offsetY: 2, scale: 1.34 },
}

const FRAME_HOLE_RATIO_BY_LEVEL: Record<number, number> = {
  1: 0.517,
  2: 0.525,
  3: 0.434,
  4: 0.538,
  5: 0.535,
  6: 0.489,
  7: 0.447,
  8: 0.488,
  9: 0.444,
  10: 0.447,
  11: 0.378,
  12: 0.404,
  13: 0.428,
  14: 0.435,
  15: 0.376,
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}

function normalizeFrameAdjustment(value: Partial<FrameAdjustment> = {}): FrameAdjustment {
  return {
    offsetX: Math.round(clampNumber(Number(value.offsetX ?? 0), -90, 90)),
    offsetY: Math.round(clampNumber(Number(value.offsetY ?? 0), -90, 90)),
    scale: Number(clampNumber(Number(value.scale ?? 1), 0.7, 3).toFixed(2)),
  }
}

function getCodeFrameAdjustment(level: number): FrameAdjustment {
  return normalizeFrameAdjustment(
    FRAME_ADJUSTMENT_BY_LEVEL[level] ?? DEFAULT_FRAME_ADJUSTMENT
  )
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
  const frameLevel = Math.max(1, Math.min(15, lv))
  const frameImageCandidates = useMemo(
    () =>
      Array.from(
        new Set([
          `/molduras/moldura_${frameLevel}.png`,
          `/molduras/moldura-${frameLevel}.png`,
          `/molduras/level_${frameLevel}.png`,
          `/molduras/level-${frameLevel}.png`,
          `/molduras/level ${frameLevel}.png`,
          `/level-icons/level-${frameLevel}.png`,
          `/level-icons/level ${frameLevel}.png`,
          `/uploads/levels/level-${frameLevel}.png`,
          `/uploads/levels/level ${frameLevel}.png`,
          `/uploads/levels/${frameLevel}.png`,
        ])
      ),
    [frameLevel]
  )
  const [frameImageIndex, setFrameImageIndex] = useState(0)
  const frameImageSrc = frameImageCandidates[frameImageIndex] || ''
  const frameIsFromMolduras = frameImageSrc.includes('/molduras/')
  const frameHoleRatio = FRAME_HOLE_RATIO_BY_LEVEL[frameLevel] || 0.5
  const frameRenderSize = frameIsFromMolduras
    ? Math.round(PROFILE_FRAME_HOLE_TARGET / frameHoleRatio)
    : PROFILE_FRAME_STAGE_SIZE
  const onlineDotOffset = (PROFILE_FRAME_STAGE_SIZE - PROFILE_AVATAR_SIZE) / 2 - 16
  const [runtimeFrameAdjustmentByLevel, setRuntimeFrameAdjustmentByLevel] = useState<
    Partial<Record<number, FrameAdjustment>>
  >(() => ({}))
  const savedFrameAdjustment = useMemo(
    () =>
      normalizeFrameAdjustment(
        runtimeFrameAdjustmentByLevel[frameLevel] ?? getCodeFrameAdjustment(frameLevel)
      ),
    [frameLevel, runtimeFrameAdjustmentByLevel]
  )
  const [draftFrameAdjustment, setDraftFrameAdjustment] = useState<FrameAdjustment>(
    savedFrameAdjustment
  )
  const [frameEditorOpen, setFrameEditorOpen] = useState(false)
  const dragStartRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    baseX: number
    baseY: number
  } | null>(null)
  const activeFrameAdjustment = frameEditorOpen
    ? draftFrameAdjustment
    : savedFrameAdjustment
  const frameFilter = useMemo(() => {
    if (!frameIsFromMolduras) {
      return `brightness(1.1) contrast(1.08) drop-shadow(0 0 10px ${glow})`
    }

    if (frameLevel === 6) {
      // Level 6 (Ouro): glow dourado mais intenso em camadas.
      return [
        'drop-shadow(0 0 6px rgba(250,204,21,.95))',
        'drop-shadow(0 0 14px rgba(250,204,21,.72))',
        'drop-shadow(0 0 24px rgba(245,158,11,.52))',
      ].join(' ')
    }

    return `drop-shadow(0 0 10px ${glow})`
  }, [frameIsFromMolduras, frameLevel, glow])
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
  useEffect(() => {
    setFrameImageIndex(0)
  }, [frameLevel])

  useEffect(() => {
    if (!frameEditorOpen) setDraftFrameAdjustment(savedFrameAdjustment)
  }, [frameEditorOpen, savedFrameAdjustment])

  const updateDraftFrameAdjustment = (next: Partial<FrameAdjustment>) => {
    setDraftFrameAdjustment((current) =>
      normalizeFrameAdjustment({ ...current, ...next })
    )
  }

  const saveFrameAdjustment = () => {
    const next = normalizeFrameAdjustment(draftFrameAdjustment)
    setRuntimeFrameAdjustmentByLevel((current) => ({
      ...current,
      [frameLevel]: next,
    }))
    setFrameEditorOpen(false)
  }

  const resetFrameAdjustment = () => {
    setDraftFrameAdjustment(getCodeFrameAdjustment(frameLevel))
  }

  const cancelFrameAdjustment = () => {
    setDraftFrameAdjustment(savedFrameAdjustment)
    setFrameEditorOpen(false)
  }

  const startFrameDrag = (event: PointerEvent<HTMLImageElement>) => {
    if (!frameEditorOpen) return

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStartRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseX: draftFrameAdjustment.offsetX,
      baseY: draftFrameAdjustment.offsetY,
    }
  }

  const moveFrameDrag = (event: PointerEvent<HTMLImageElement>) => {
    const start = dragStartRef.current
    if (!frameEditorOpen || !start || start.pointerId !== event.pointerId) return

    updateDraftFrameAdjustment({
      offsetX: start.baseX + event.clientX - start.startX,
      offsetY: start.baseY + event.clientY - start.startY,
    })
  }

  const endFrameDrag = (event: PointerEvent<HTMLImageElement>) => {
    const start = dragStartRef.current
    if (!start || start.pointerId !== event.pointerId) return

    event.currentTarget.releasePointerCapture(event.pointerId)
    dragStartRef.current = null
  }

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
          {/* Perfil do Jogador */}
        </div>

        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            style={{
              position: 'relative',
              width: PROFILE_FRAME_STAGE_SIZE,
              height: PROFILE_FRAME_STAGE_SIZE,
              display: 'grid',
              placeItems: 'center',
              overflow: 'visible',
            }}
          >
            <div
              style={{
                position: 'absolute',
                width: PROFILE_AVATAR_SIZE + 36,
                height: PROFILE_AVATAR_SIZE + 36,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${glow} 0%, transparent 72%)`,
                filter: 'blur(14px)',
              }}
            />
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={`Avatar de ${playerName}`}
                style={{
                  position: 'relative',
                  width: PROFILE_AVATAR_SIZE,
                  height: PROFILE_AVATAR_SIZE,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: `4px solid ${accent}`,
                  boxShadow: `0 0 22px ${glow}`,
                  zIndex: 2,
                }}
              />
            ) : (
              <div
                style={{
                  position: 'relative',
                  width: PROFILE_AVATAR_SIZE,
                  height: PROFILE_AVATAR_SIZE,
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
                  zIndex: 2,
                }}
              >
                {String(playerName || '?').slice(0, 1).toUpperCase()}
              </div>
            )}
            {frameImageSrc ? (
              <img
                src={frameImageSrc}
                alt=""
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: `calc(50% + ${activeFrameAdjustment.offsetX}px)`,
                  top: `calc(50% + ${activeFrameAdjustment.offsetY}px)`,
                  width: frameRenderSize,
                  height: frameRenderSize,
                  transform: `translate(-50%, -50%) scale(${activeFrameAdjustment.scale})`,
                  transformOrigin: 'center center',
                  objectFit: 'contain',
                  pointerEvents: frameEditorOpen ? 'auto' : 'none',
                  zIndex: 3,
                  mixBlendMode: frameIsFromMolduras ? 'normal' : 'screen',
                  filter: frameFilter,
                  cursor: frameEditorOpen ? 'grab' : 'default',
                  touchAction: 'none',
                }}
                onPointerDown={startFrameDrag}
                onPointerMove={moveFrameDrag}
                onPointerUp={endFrameDrag}
                onPointerCancel={endFrameDrag}
                onError={() => {
                  setFrameImageIndex((prev) => {
                    const next = prev + 1
                    return next < frameImageCandidates.length ? next : prev
                  })
                }}
              />
            ) : null}
            <span
              style={{
                position: 'absolute',
                right: onlineDotOffset,
                bottom: onlineDotOffset,
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: online ? '#4ade80' : '#64748b',
                border: '3px solid #0a1021',
                boxShadow: online ? '0 0 10px rgba(74,222,128,.85)' : 'none',
                zIndex: 4,
              }}
            />
            {/* <button
              type="button"
              onClick={() => {
                setDraftFrameAdjustment(savedFrameAdjustment)
                setFrameEditorOpen(true)
              }}
              style={{
                position: 'absolute',
                top: 2,
                right: 2,
                zIndex: 5,
                border: `1px solid ${accent}77`,
                borderRadius: 8,
                background: 'rgba(7,12,26,.86)',
                color: accent,
                fontFamily: "'Rajdhani',sans-serif",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: 0.8,
                lineHeight: 1,
                padding: '6px 8px',
                textTransform: 'uppercase',
                cursor: 'pointer',
                boxShadow: `0 0 12px ${glow}`,
              }}
            >
              Ajustar
            </button> */}
            {frameEditorOpen && (
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  bottom: -58,
                  transform: 'translateX(-50%)',
                  zIndex: 6,
                  width: 230,
                  borderRadius: 10,
                  border: `1px solid ${accent}88`,
                  background: 'rgba(5,8,18,.96)',
                  boxShadow: `0 0 18px ${glow}`,
                  padding: '8px 9px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <button
                    type="button"
                    onClick={() =>
                      updateDraftFrameAdjustment({
                        scale: draftFrameAdjustment.scale - 0.03,
                      })
                    }
                    style={{
                      width: 26,
                      height: 24,
                      borderRadius: 7,
                      border: '1px solid rgba(255,255,255,.13)',
                      background: 'rgba(255,255,255,.06)',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    -
                  </button>
                  <input
                    aria-label="Tamanho da moldura"
                    type="range"
                    min="0.7"
                    max="3"
                    step="0.01"
                    value={draftFrameAdjustment.scale}
                    onChange={(event) =>
                      updateDraftFrameAdjustment({
                        scale: Number(event.currentTarget.value),
                      })
                    }
                    style={{ flex: 1, accentColor: accent }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateDraftFrameAdjustment({
                        scale: draftFrameAdjustment.scale + 0.03,
                      })
                    }
                    style={{
                      width: 26,
                      height: 24,
                      borderRadius: 7,
                      border: '1px solid rgba(255,255,255,.13)',
                      background: 'rgba(255,255,255,.06)',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    +
                  </button>
                </div>
                <div
                  style={{
                    marginTop: 5,
                    textAlign: 'center',
                    fontFamily: "'Orbitron',monospace",
                    fontSize: 9,
                    fontWeight: 800,
                    color: accent,
                  }}
                >
                  {Math.round(draftFrameAdjustment.scale * 100)}%
                </div>
                <div
                  style={{
                    marginTop: 4,
                    textAlign: 'center',
                    fontFamily: "'Rajdhani',sans-serif",
                    fontSize: 10,
                    color: 'rgba(255,255,255,.62)',
                    lineHeight: 1.15,
                  }}
                >
                  {`Level ${frameLevel}: x ${draftFrameAdjustment.offsetX}, y ${draftFrameAdjustment.offsetY}, scale ${draftFrameAdjustment.scale.toFixed(2)}`}
                </div>
                <div
                  style={{
                    marginTop: 3,
                    textAlign: 'center',
                    fontFamily: "'Rajdhani',sans-serif",
                    fontSize: 9,
                    color: 'rgba(255,255,255,.5)',
                    lineHeight: 1.1,
                  }}
                >
                  Producao: edite FRAME_ADJUSTMENT_BY_LEVEL neste arquivo.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 7 }}>
                  {[
                    { label: 'Aplicar', action: saveFrameAdjustment, primary: true },
                    { label: 'Cancelar', action: cancelFrameAdjustment, primary: false },
                    { label: 'Resetar', action: resetFrameAdjustment, primary: false },
                  ].map(({ label, action, primary }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={action}
                      style={{
                        borderRadius: 7,
                        border: `1px solid ${primary ? accent : 'rgba(255,255,255,.12)'}`,
                        background: primary ? `${accent}22` : 'rgba(255,255,255,.05)',
                        color: primary ? accent : 'rgba(255,255,255,.72)',
                        fontFamily: "'Rajdhani',sans-serif",
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: 0.4,
                        padding: '6px 4px',
                        cursor: 'pointer',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <h2
            style={{
              marginTop: frameEditorOpen ? 70 : 25,
              marginBottom: -20,
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
              mixBlendMode: 'screen',
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
