import { useEffect, useRef } from 'react'

type Bolt = {
  pts: Array<{ x: number; y: number }>
  life: number
  age: number
  thick: number
}

const rand = (min: number, max: number) => min + Math.random() * (max - min)

function makeBoltSimple(x0: number, y0: number, x1: number, y1: number) {
  let pts = [
    { x: x0, y: y0 },
    { x: x1, y: y1 },
  ]
  let offset = Math.hypot(x1 - x0, y1 - y0) * 0.2
  for (let i = 0; i < 3; i += 1) {
    const next = [pts[0]]
    for (let j = 0; j < pts.length - 1; j += 1) {
      const a = pts[j]
      const b = pts[j + 1]
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      const dx = b.x - a.x
      const dy = b.y - a.y
      const len = Math.hypot(dx, dy) || 1
      const nx = -dy / len
      const ny = dx / len
      const disp = (Math.random() * 2 - 1) * offset
      next.push({ x: mx + nx * disp, y: my + ny * disp }, b)
    }
    pts = next
    offset *= 0.55
  }
  return pts
}

/**
 * Camadas com cor translúcida e larguras crescentes simulam o brilho
 * sem o custo do shadowBlur do canvas (que recalcula um blur a cada stroke).
 */
function drawBoltPath(ctx: CanvasRenderingContext2D, pts: Array<{ x: number; y: number }>, baseAlpha: number, thick: number) {
  if (pts.length < 2) return

  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y)

  ctx.strokeStyle = `rgba(0,160,255,${0.18 * baseAlpha})`
  ctx.lineWidth = thick * 8
  ctx.stroke()

  ctx.strokeStyle = `rgba(120,210,255,${0.45 * baseAlpha})`
  ctx.lineWidth = thick * 4
  ctx.stroke()

  ctx.strokeStyle = `rgba(255,255,255,${0.95 * baseAlpha})`
  ctx.lineWidth = thick * 1.6
  ctx.stroke()
}

export default function ZeusStormOverlay({ active }: { active: boolean }) {
  const hostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!active || !host) return

    host.innerHTML = ''

    const clouds = document.createElement('div')
    clouds.className = 'ma-zeus-clouds'

    const flash = document.createElement('div')
    flash.className = 'ma-zeus-flash'

    const canvas = document.createElement('canvas')
    canvas.className = 'ma-zeus-layer'

    host.append(clouds, flash, canvas)

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(1.5, window.devicePixelRatio || 1)
    let width = 1
    let height = 1
    let running = true
    let last = performance.now()
    let spawnAt = 0
    let raf = 0
    let flashTimer: number | null = null

    const bolts: Bolt[] = []
    const MAX_BOLTS = 6

    const resize = () => {
      const r = host.getBoundingClientRect()
      width = Math.max(1, r.width)
      height = Math.max(1, r.height)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(host)
    resize()

    const makeBolt = (x0: number, y0: number, x1: number, y1: number) => {
      let pts = [
        { x: x0, y: y0 },
        { x: x1, y: y1 },
      ]
      let offset = Math.hypot(x1 - x0, y1 - y0) * 0.18

      for (let i = 0; i < 6; i += 1) {
        const next = [pts[0]]
        for (let j = 0; j < pts.length - 1; j += 1) {
          const a = pts[j]
          const b = pts[j + 1]
          const mx = (a.x + b.x) / 2
          const my = (a.y + b.y) / 2
          const dx = b.x - a.x
          const dy = b.y - a.y
          const len = Math.hypot(dx, dy) || 1
          const nx = -dy / len
          const ny = dx / len
          const disp = (Math.random() * 2 - 1) * offset

          next.push({ x: mx + nx * disp, y: my + ny * disp }, b)

          if (bolts.length < MAX_BOLTS && Math.random() < 0.35 && offset > 2.2) {
            const bx = mx + nx * disp * 0.6
            const by = my + ny * disp * 0.6
            const ang =
              Math.atan2(dy, dx) +
              (Math.random() < 0.5 ? 1 : -1) * rand(Math.PI / 6, Math.PI / 3)
            const blen = rand(len * 0.18, len * 0.33)
            const ex = bx + Math.cos(ang) * blen
            const ey = by + Math.sin(ang) * blen
            bolts.push({
              pts: makeBoltSimple(bx, by, ex, ey),
              life: rand(120, 220),
              age: 0,
              thick: rand(0.6, 1.2),
            })
          }
        }
        pts = next
        offset *= 0.55
      }

      return pts
    }

    const spawn = () => {
      if (bolts.length >= MAX_BOLTS) return

      const startX = rand(width * 0.15, width * 0.85)
      const endX = startX + rand(-width * 0.2, width * 0.2)
      const pts = makeBolt(startX, -width * 0.05, endX, height * rand(0.6, 0.95))

      bolts.push({
        pts,
        life: rand(240, 360),
        age: 0,
        thick: rand(1.2, 2.2),
      })

      flash.style.opacity = '0.38'
      if (flashTimer) window.clearTimeout(flashTimer)
      flashTimer = window.setTimeout(() => {
        flash.style.opacity = '0'
      }, 120)
    }

    const tick = (ts: number) => {
      if (!running) return

      const dt = Math.min(60, ts - last)
      last = ts

      ctx.clearRect(0, 0, width, height)

      for (let i = bolts.length - 1; i >= 0; i -= 1) {
        const b = bolts[i]
        b.age += dt
        const alpha = Math.max(0, 1 - b.age / b.life)
        drawBoltPath(ctx, b.pts, alpha, b.thick)
        if (b.age >= b.life) bolts.splice(i, 1)
      }

      if (ts > spawnAt) {
        spawn()
        spawnAt = ts + (300 + Math.random() * 900)
      }

      raf = window.requestAnimationFrame(tick)
    }

    raf = window.requestAnimationFrame(tick)

    return () => {
      running = false
      window.cancelAnimationFrame(raf)
      ro.disconnect()
      if (flashTimer) window.clearTimeout(flashTimer)
      host.innerHTML = ''
    }
  }, [active])

  if (!active) return null
  return <div className='ma-zeus-host' ref={hostRef} aria-hidden='true' />
}
