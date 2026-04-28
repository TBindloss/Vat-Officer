import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useLocalStorage, STORAGE_KEYS } from '../hooks/useLocalStorage'

const NOTE_POSITION_KEY = 'vscpl_note_panel_position'
const NOTE_OPEN_KEY = 'vscpl_note_panel_open'
const NOTE_SIZE_KEY = 'vscpl_note_panel_size'
const NOTE_DRAW_MODE_KEY = 'vscpl_note_panel_draw_mode'
const NOTE_CANVAS_KEY = 'vscpl_note_canvas'
const NOTE_DRAW_COLOR_KEY = 'vscpl_note_draw_color'

const DRAW_COLORS = [
  '#e8e3d8', '#f59e0b', '#ef4444', '#2eb8a6', '#3dba5a', '#8b5cf6', '#ec4899', '#60a5fa'
]

const MIN_WIDTH = 240
const MIN_HEIGHT = 200
const DEFAULT_WIDTH = 320
const DEFAULT_HEIGHT = 300

const defaultPosition = () => ({
  x: typeof window !== 'undefined' ? window.innerWidth - DEFAULT_WIDTH - 24 : 100,
  y: 80
})

function getStoredPosition() {
  if (typeof window === 'undefined') return defaultPosition()
  try {
    const raw = window.localStorage.getItem(NOTE_POSITION_KEY)
    if (!raw) return defaultPosition()
    const { x, y } = JSON.parse(raw)
    if (typeof x !== 'number' || typeof y !== 'number') return defaultPosition()
    const padding = 16
    const w = DEFAULT_WIDTH
    const h = DEFAULT_HEIGHT
    const maxX = window.innerWidth - w - padding
    const maxY = window.innerHeight - h - padding
    return {
      x: Math.max(padding, Math.min(x, maxX)),
      y: Math.max(padding, Math.min(y, maxY))
    }
  } catch (_) {}
  return defaultPosition()
}

function getStoredSize() {
  if (typeof window === 'undefined') return { w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT }
  try {
    const raw = window.localStorage.getItem(NOTE_SIZE_KEY)
    if (!raw) return { w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT }
    const { w, h } = JSON.parse(raw)
    if (typeof w === 'number' && typeof h === 'number') {
      return { w: Math.max(MIN_WIDTH, Math.min(w, 0.9 * window.innerWidth)), h: Math.max(MIN_HEIGHT, Math.min(h, 0.8 * window.innerHeight)) }
    }
  } catch (_) {}
  return { w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT }
}

function getStoredOpen() {
  if (typeof window === 'undefined') return false
  try {
    return JSON.parse(window.localStorage.getItem(NOTE_OPEN_KEY) ?? 'false')
  } catch (_) {
    return false
  }
}

function getStoredDrawMode() {
  if (typeof window === 'undefined') return false
  try {
    return JSON.parse(window.localStorage.getItem(NOTE_DRAW_MODE_KEY) ?? 'false')
  } catch (_) {
    return false
  }
}

function setStoredPosition(x, y) {
  try {
    window.localStorage.setItem(NOTE_POSITION_KEY, JSON.stringify({ x, y }))
  } catch (_) {}
}

function setStoredSize(w, h) {
  try {
    window.localStorage.setItem(NOTE_SIZE_KEY, JSON.stringify({ w, h }))
  } catch (_) {}
}

function setStoredOpen(open) {
  try {
    window.localStorage.setItem(NOTE_OPEN_KEY, JSON.stringify(open))
  } catch (_) {}
}

function setStoredDrawMode(on) {
  try {
    window.localStorage.setItem(NOTE_DRAW_MODE_KEY, JSON.stringify(on))
  } catch (_) {}
}

function getStoredDrawColor() {
  if (typeof window === 'undefined') return DRAW_COLORS[0]
  try {
    const c = window.localStorage.getItem(NOTE_DRAW_COLOR_KEY)
    if (c && /^#[0-9a-fA-F]{6}$/.test(c)) return c
  } catch (_) {}
  return DRAW_COLORS[0]
}

function setStoredDrawColor(hex) {
  try {
    window.localStorage.setItem(NOTE_DRAW_COLOR_KEY, hex)
  } catch (_) {}
}

function PenIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  )
}

function NotesIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function EraserIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}

function MoveIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  )
}

function TrashIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 6v14a2 2 0 002 2h12a2 2 0 002-2V6M4 6l2-4h12l2 4M9 10v6M15 10v6" />
    </svg>
  )
}

const CANVAS_BG = '#1c1a16'

function NotePanel() {
  const [noteContent, setNoteContent] = useLocalStorage(STORAGE_KEYS.NOTE_CONTENT, '')
  const [isOpen, setIsOpen] = useState(getStoredOpen)
  const [position, setPosition] = useState(getStoredPosition)
  const [size, setSize] = useState(getStoredSize)
  const [isDrawMode, setIsDrawMode] = useState(getStoredDrawMode)
  const [drawColor, setDrawColor] = useState(getStoredDrawColor)
  const [isEraser, setIsEraser] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const dragRef = useRef({ startX: 0, startY: 0, startLeft: 0, startTop: 0 })
  const resizeRef = useRef({ startX: 0, startY: 0, startW: 0, startH: 0 })
  const canvasRef = useRef(null)
  const isDrawingRef = useRef(false)
  const lastPointRef = useRef(null)

  const handleOpen = useCallback(() => {
    setIsOpen(true)
    setStoredOpen(true)
  }, [])

  const handleClose = useCallback(() => {
    setIsOpen(false)
    setStoredOpen(false)
  }, [])

  const handleDragStart = useCallback(
    (e) => {
      const isMouse = e.pointerType === 'mouse' || e.type === 'mousedown'
      if (isMouse && e.button !== 0) return
      if (isResizing) return
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(true)
      dragRef.current = {
        startX: e.clientX ?? e.touches?.[0]?.clientX,
        startY: e.clientY ?? e.touches?.[0]?.clientY,
        startLeft: position.x,
        startTop: position.y
      }
      if (e.target.setPointerCapture && e.pointerId != null) {
        try {
          e.target.setPointerCapture(e.pointerId)
        } catch (_) {}
      }
    },
    [position, isResizing]
  )

  const handleMouseMove = useCallback(
    (e) => {
      const clientX = e.clientX ?? e.touches?.[0]?.clientX
      const clientY = e.clientY ?? e.touches?.[0]?.clientY
      if (isDragging) {
        const dx = clientX - dragRef.current.startX
        const dy = clientY - dragRef.current.startY
        let x = dragRef.current.startLeft + dx
        let y = dragRef.current.startTop + dy
        const padding = 16
        x = Math.max(padding, Math.min(window.innerWidth - size.w - padding, x))
        y = Math.max(padding, Math.min(window.innerHeight - size.h - padding, y))
        setPosition({ x, y })
        setStoredPosition(x, y)
      }
      if (isResizing) {
        const dx = clientX - resizeRef.current.startX
        const dy = clientY - resizeRef.current.startY
        let w = Math.max(MIN_WIDTH, resizeRef.current.startW + dx)
        let h = Math.max(MIN_HEIGHT, resizeRef.current.startH + dy)
        w = Math.min(0.9 * window.innerWidth, w)
        h = Math.min(0.8 * window.innerHeight, h)
        setSize({ w, h })
        setStoredSize(w, h)
      }
    },
    [isDragging, isResizing, size.w, size.h]
  )

  const handleEndDragResize = useCallback(() => {
    setIsDragging(false)
    setIsResizing(false)
  }, [])

  const handleResizeStart = useCallback(
    (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      setIsResizing(true)
      resizeRef.current = {
        startX: e.clientX ?? e.touches?.[0]?.clientX,
        startY: e.clientY ?? e.touches?.[0]?.clientY,
        startW: size.w,
        startH: size.h
      }
      if (e.target.setPointerCapture && e.pointerId != null) {
        e.target.setPointerCapture(e.pointerId)
      }
    },
    [size]
  )

  useEffect(() => {
    if (!isDragging && !isResizing) return
    const onMove = (e) => {
      handleMouseMove(e)
    }
    const onEnd = () => {
      handleEndDragResize()
    }
    const doc = document
    const capture = true
    const touchOpts = { capture, passive: false }
    doc.addEventListener('mousemove', onMove, capture)
    doc.addEventListener('mouseup', onEnd, capture)
    doc.addEventListener('pointermove', onMove, capture)
    doc.addEventListener('pointerup', onEnd, capture)
    doc.addEventListener('pointercancel', onEnd, capture)
    doc.addEventListener('touchmove', onMove, touchOpts)
    doc.addEventListener('touchend', onEnd, capture)
    return () => {
      doc.removeEventListener('mousemove', onMove, capture)
      doc.removeEventListener('mouseup', onEnd, capture)
      doc.removeEventListener('pointermove', onMove, capture)
      doc.removeEventListener('pointerup', onEnd, capture)
      doc.removeEventListener('pointercancel', onEnd, capture)
      doc.removeEventListener('touchmove', onMove, touchOpts)
      doc.removeEventListener('touchend', onEnd, capture)
    }
  }, [isDragging, isResizing, handleMouseMove, handleEndDragResize])

  const HEADER_H = 40

  useEffect(() => {
    if (!isOpen || !isDrawMode || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio ?? 1
    const w = size.w
    const h = Math.max(MIN_HEIGHT, size.h - HEADER_H)
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    try {
      const saved = window.localStorage.getItem(NOTE_CANVAS_KEY)
      if (saved) {
        const img = new Image()
        img.onload = () => {
          ctx.drawImage(img, 0, 0, w, h)
        }
        img.src = saved
      } else {
        ctx.fillStyle = CANVAS_BG
        ctx.fillRect(0, 0, w, h)
      }
    } catch (_) {}
  }, [isOpen, isDrawMode, size.w, size.h])

  const saveCanvas = useCallback(() => {
    if (!canvasRef.current) return
    try {
      const data = canvasRef.current.toDataURL('image/png')
      window.localStorage.setItem(NOTE_CANVAS_KEY, data)
    } catch (_) {}
  }, [])

  const getCanvasPoint = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX ?? e.touches?.[0]?.clientX) - rect.left
    const y = (e.clientY ?? e.touches?.[0]?.clientY) - rect.top
    return { x, y }
  }, [])

  const handleCanvasPointerDown = useCallback(
    (e) => {
      if (!isDrawMode) return
      e.preventDefault()
      const point = getCanvasPoint(e)
      if (!point) return
      isDrawingRef.current = true
      lastPointRef.current = point
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) return
      if (isEraser) {
        ctx.globalCompositeOperation = 'destination-out'
        ctx.strokeStyle = 'rgba(0,0,0,1)'
        ctx.lineWidth = 20
      } else {
        ctx.globalCompositeOperation = 'source-over'
        ctx.strokeStyle = drawColor
        ctx.lineWidth = 2
      }
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(point.x, point.y)
      ctx.lineTo(point.x, point.y)
      ctx.stroke()
    },
    [isDrawMode, isEraser, drawColor, getCanvasPoint]
  )

  const handleCanvasPointerMove = useCallback(
    (e) => {
      if (!isDrawMode || !isDrawingRef.current) return
      e.preventDefault()
      const point = getCanvasPoint(e)
      if (!point || !lastPointRef.current) return
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) return
      if (isEraser) {
        ctx.globalCompositeOperation = 'destination-out'
        ctx.strokeStyle = 'rgba(0,0,0,1)'
        ctx.lineWidth = 20
      } else {
        ctx.globalCompositeOperation = 'source-over'
        ctx.strokeStyle = drawColor
        ctx.lineWidth = 2
      }
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y)
      ctx.lineTo(point.x, point.y)
      ctx.stroke()
      lastPointRef.current = point
    },
    [isDrawMode, isEraser, drawColor, getCanvasPoint]
  )

  const handleCanvasPointerUp = useCallback(() => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false
      lastPointRef.current = null
      saveCanvas()
    }
  }, [saveCanvas])

  const handleDrawModeToggle = useCallback(() => {
    setIsDrawMode((prev) => {
      const next = !prev
      setStoredDrawMode(next)
      return next
    })
  }, [])

  const handleClearAll = useCallback(() => {
    setNoteContent('')
    try {
      window.localStorage.removeItem(NOTE_CANVAS_KEY)
    } catch (_) {}
    if (canvasRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (ctx) {
        const dpr = window.devicePixelRatio ?? 1
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.fillStyle = CANVAS_BG
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.scale(dpr, dpr)
      }
    }
  }, [setNoteContent])

  return (
    <>
      {/* Notes tab button */}
      {!isOpen && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            handleOpen()
          }}
          onTouchEnd={(e) => {
            e.preventDefault()
            handleOpen()
          }}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center justify-center gap-1
                     w-12 min-h-[80px] py-3 px-2 bg-aviation-surface border border-r-0
                     border-aviation-border rounded-l-lg shadow-lg
                     hover:bg-aviation-surface-light transition-colors focus:outline-none focus:ring-2 focus:ring-aviation-accent focus:ring-inset
                     touch-manipulation cursor-pointer"
          style={{ touchAction: 'manipulation' }}
          aria-label="Open notes"
        >
          <NotesIcon className="w-6 h-6 text-aviation-accent shrink-0" />
          <span className="text-aviation-text-secondary font-semibold text-[10px] select-none whitespace-nowrap">
            Notes
          </span>
        </button>
      )}

      {/* Floating notepad panel */}
      {isOpen && (
        <div
          className="fixed z-50 flex flex-col shadow-xl rounded-lg overflow-hidden
                     border border-aviation-border bg-aviation-surface"
          style={{
            left: position.x,
            top: position.y,
            width: size.w,
            height: size.h
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-2 py-2.5 bg-aviation-surface-light border-b border-aviation-border shrink-0 min-h-[44px]">
            <div className="flex items-center gap-2 min-w-0">
              <div
                role="button"
                tabIndex={0}
                onMouseDown={handleDragStart}
                onMouseUp={handleEndDragResize}
                onPointerDown={handleDragStart}
                onPointerUp={handleEndDragResize}
                onPointerCancel={handleEndDragResize}
                className="flex items-center justify-center min-w-[44px] min-h-[44px] -m-1 rounded cursor-grab active:cursor-grabbing
                           text-aviation-text-secondary hover:text-aviation-text hover:bg-aviation-border/40 touch-manipulation select-none
                           focus:outline-none focus:ring-2 focus:ring-aviation-accent"
                style={{ touchAction: 'none' }}
                aria-label="Drag to move notes panel"
              >
                <MoveIcon className="w-5 h-5 shrink-0 pointer-events-none" />
              </div>
              <span className="text-aviation-text font-medium text-sm truncate">Notes</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {isDrawMode && (
                <>
                  <button
                    type="button"
                    onClick={() => { setIsEraser(false) }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    title="Pen"
                    className={`p-1.5 rounded min-w-[36px] min-h-[36px] flex items-center justify-center ${!isEraser ? 'bg-aviation-accent text-white' : 'text-aviation-text-secondary hover:text-aviation-text hover:bg-aviation-border/40'} focus:outline-none focus:ring-2 focus:ring-aviation-accent`}
                    aria-label="Pen"
                  >
                    <PenIcon className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsEraser(true) }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    title="Eraser"
                    className={`p-1.5 rounded min-w-[36px] min-h-[36px] flex items-center justify-center ${isEraser ? 'bg-aviation-accent text-white' : 'text-aviation-text-secondary hover:text-aviation-text hover:bg-aviation-border/40'} focus:outline-none focus:ring-2 focus:ring-aviation-accent`}
                    aria-label="Eraser"
                  >
                    <EraserIcon className="w-4 h-4" />
                  </button>
                  {!isEraser && (
                    <div className="flex items-center gap-0.5" onMouseDown={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                      {DRAW_COLORS.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => { setDrawColor(hex); setStoredDrawColor(hex) }}
                          className={`w-6 h-6 rounded-full border-2 shrink-0 focus:outline-none focus:ring-2 focus:ring-aviation-accent ${drawColor === hex ? 'border-aviation-accent ring-1 ring-aviation-accent' : 'border-aviation-border hover:border-aviation-text-secondary'}`}
                          style={{ backgroundColor: hex }}
                          aria-label={`Colour ${hex}`}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={handleDrawModeToggle}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                title={isDrawMode ? 'Switch to text' : 'Draw mode'}
                className={`p-1.5 rounded min-w-[36px] min-h-[36px] flex items-center justify-center ${isDrawMode ? 'bg-aviation-accent text-white' : 'text-aviation-text-secondary hover:text-aviation-text hover:bg-aviation-border/40'} focus:outline-none focus:ring-2 focus:ring-aviation-accent`}
                aria-label={isDrawMode ? 'Switch to text' : 'Draw mode'}
              >
                <PenIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                title="Clear all (text and drawing)"
                className="p-1.5 rounded min-w-[36px] min-h-[36px] flex items-center justify-center text-aviation-text-secondary hover:text-aviation-text hover:bg-aviation-border/40
                           focus:outline-none focus:ring-2 focus:ring-aviation-accent"
                aria-label="Clear all notes"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleClose}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="p-1.5 rounded min-w-[36px] min-h-[36px] flex items-center justify-center text-aviation-text-secondary hover:text-aviation-text hover:bg-aviation-border/40
                           focus:outline-none focus:ring-2 focus:ring-aviation-accent"
                aria-label="Close notes"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 relative bg-aviation-bg">
            {!isDrawMode ? (
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Jot something down..."
                className="absolute inset-0 w-full h-full p-3 resize-none bg-aviation-bg text-aviation-text placeholder-aviation-text-secondary/50
                           border-0 focus:ring-0 focus:outline-none text-sm font-mono"
              />
            ) : (
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
                style={{ display: 'block' }}
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
                onPointerLeave={handleCanvasPointerUp}
                onTouchStart={(e) => e.preventDefault()}
              />
            )}
          </div>

          {/* Resize handle */}
          <div
            role="button"
            tabIndex={0}
            onMouseDown={handleResizeStart}
            onMouseUp={handleEndDragResize}
            onPointerDown={handleResizeStart}
            onPointerUp={handleEndDragResize}
            onPointerCancel={handleEndDragResize}
            onTouchStart={handleResizeStart}
            onTouchEnd={handleEndDragResize}
            className="absolute bottom-0 right-0 z-10 w-12 h-12 min-w-[48px] min-h-[48px] cursor-se-resize flex items-end justify-end p-1
                       text-aviation-border hover:text-aviation-accent focus:outline-none focus:ring-2 focus:ring-aviation-accent rounded-tl bg-aviation-surface/90 touch-manipulation"
            style={{ touchAction: 'none' }}
            aria-label="Resize panel"
          >
            <svg width={28} height={28} viewBox="0 0 24 24" fill="currentColor" className="shrink-0 pointer-events-none">
              <path d="M24 24V14L14 24H24Z" />
            </svg>
          </div>
        </div>
      )}
    </>
  )
}

export default NotePanel
