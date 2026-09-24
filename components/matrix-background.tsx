'use client'

import { useEffect, useRef } from 'react'

const CHARS = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン'.split('')
const FONT_SIZE = 14
const FRAME_MS = 50

export function MatrixBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    // Respect users who ask for less motion: draw one static frame
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let drops: number[] = []
    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      const columns = Math.ceil(canvas.width / FONT_SIZE)
      drops = Array.from({ length: columns }, (_, i) => drops[i] ?? Math.floor(Math.random() * -50))
    }
    resize()

    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.06)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#0f0'
      ctx.font = `${FONT_SIZE}px monospace`
      for (let i = 0; i < drops.length; i++) {
        ctx.fillText(CHARS[(Math.random() * CHARS.length) | 0], i * FONT_SIZE, drops[i] * FONT_SIZE)
        if (drops[i] * FONT_SIZE > canvas.height && Math.random() > 0.975) drops[i] = 0
        drops[i]++
      }
    }

    let frame = 0
    let last = 0
    const loop = (time: number) => {
      frame = requestAnimationFrame(loop)
      if (time - last < FRAME_MS) return
      last = time
      draw()
    }
    if (reduceMotion) {
      for (let i = 0; i < 60; i++) draw()
    } else {
      // requestAnimationFrame also pauses automatically in background tabs
      frame = requestAnimationFrame(loop)
    }

    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="matrix-bg" aria-hidden />
}
