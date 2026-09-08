'use client'

import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react'

export interface SignaturePadHandle {
  isEmpty: () => boolean
  toDataURL: () => string | null
  clear: () => void
}

interface Props {
  className?: string
  height?: number
}

/**
 * Lienzo de firma autógrafa compatible con mouse, touch y lápiz/tableta
 * (eventos Pointer Events — Wacom, Topaz, etc.).
 */
const SignaturePad = forwardRef<SignaturePadHandle, Props>(function SignaturePad(
  { className = '', height = 160 },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const hasInkRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const ratio = window.devicePixelRatio || 1
      canvas.width = Math.floor(rect.width * ratio)
      canvas.height = Math.floor(height * ratio)
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.lineWidth = 2.2
        ctx.strokeStyle = '#0f172a'
      }
    }

    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [height])

  useImperativeHandle(ref, () => ({
    isEmpty: () => !hasInkRef.current,
    toDataURL: () => {
      if (!hasInkRef.current || !canvasRef.current) return null
      return canvasRef.current.toDataURL('image/png')
    },
    clear: () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      hasInkRef.current = false
    },
  }))

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    canvas.setPointerCapture(e.pointerId)
    drawingRef.current = true
    const { x, y } = getPoint(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = getPoint(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    hasInkRef.current = true
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = false
    canvasRef.current?.releasePointerCapture(e.pointerId)
  }

  return (
    <canvas
      ref={canvasRef}
      className={`w-full touch-none cursor-crosshair bg-white ${className}`}
      style={{ height }}
      aria-label="Cuadro de firma autógrafa"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    />
  )
})

export default SignaturePad
