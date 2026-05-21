import { useState, useEffect } from 'react'

/**
 * Anima um número de 0 até `target` com easing cúbico.
 * Ativa assim que `active` for true (default: true).
 */
export function useCounter(target: number, active = true, duration = 1400): number {
  const [val, setVal] = useState(0)

  useEffect(() => {
    if (!active) return
    let startTime: number | null = null

    const step = (ts: number) => {
      if (!startTime) startTime = ts
      const progress = Math.min((ts - startTime) / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setVal(Math.round(ease * target))
      if (progress < 1) requestAnimationFrame(step)
    }

    requestAnimationFrame(step)
  }, [target, active, duration])

  return val
}

/**
 * Retorna true após `delay` ms — usado para animações de entrada.
 */
export function useAnimIn(delay = 0): boolean {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), delay)
    return () => clearTimeout(t)
  }, [delay])
  return ready
}
