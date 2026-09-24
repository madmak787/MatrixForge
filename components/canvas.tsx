'use client'

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Maximize, Minus, Plus } from 'lucide-react'
import { TableNode } from './table-node'
import { Table } from '@/lib/types'
import { getColorByName } from '@/lib/colors'
import { NODE_WIDTH, cardinalityMarks, diagramBounds, edgePath, getEdges, tableHeight } from '@/lib/schema'

export interface CanvasHandle {
  fitView: () => void
  focusTable: (tableId: string) => void
  zoomBy: (factor: number) => void
  /** Canvas-space point at the middle of the visible area */
  viewportCenter: () => { x: number; y: number }
}

interface CanvasProps {
  ref?: React.Ref<CanvasHandle>
  tables: Table[]
  selectedTable: string | null
  selectedColumn: string | null
  onSelect: (tableId: string | null, columnId?: string) => void
  onOpenTable: (tableId: string) => void
  onMoveStart: () => void
  onMove: (tableId: string, position: { x: number; y: number }) => void
  onMoveEnd: () => void
  onDeleteTable: (tableId: string) => void
  onDuplicateTable: (tableId: string) => void
  onAddTableAt: (position: { x: number; y: number }) => void
  children?: React.ReactNode
}

interface View {
  x: number
  y: number
  scale: number
}

const MIN_SCALE = 0.15
const MAX_SCALE = 2.5
const GRID = 10
const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))

type Gesture =
  | { kind: 'pan'; pointerId: number; startX: number; startY: number; view: View; moved: boolean }
  | { kind: 'drag'; pointerId: number; tableId: string; startX: number; startY: number; origin: { x: number; y: number }; moved: boolean }
  | { kind: 'pinch'; distance: number; center: { x: number; y: number }; view: View }

export function Canvas({
  ref,
  tables,
  selectedTable,
  selectedColumn,
  onSelect,
  onOpenTable,
  onMoveStart,
  onMove,
  onMoveEnd,
  onDeleteTable,
  onDuplicateTable,
  onAddTableAt,
  children,
}: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 })
  const viewRef = useRef(view)
  viewRef.current = view
  const gesture = useRef<Gesture | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const tablesRef = useRef(tables)
  tablesRef.current = tables

  const toLocal = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect()
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const zoomAt = useCallback((factor: number, point?: { x: number; y: number }) => {
    const el = containerRef.current
    if (!el) return
    const p = point || { x: el.clientWidth / 2, y: el.clientHeight / 2 }
    setView(v => {
      const scale = clampScale(v.scale * factor)
      const k = scale / v.scale
      return { scale, x: p.x - (p.x - v.x) * k, y: p.y - (p.y - v.y) * k }
    })
  }, [])

  const fitView = useCallback(() => {
    const el = containerRef.current
    const bounds = diagramBounds(tablesRef.current)
    if (!el) return
    if (!bounds) {
      setView({ x: 0, y: 0, scale: 1 })
      return
    }
    const pad = 64
    const scale = clampScale(
      Math.min((el.clientWidth - pad * 2) / bounds.width, (el.clientHeight - pad * 2) / bounds.height, 1.1),
    )
    setView({
      scale,
      x: (el.clientWidth - bounds.width * scale) / 2 - bounds.x * scale,
      y: (el.clientHeight - bounds.height * scale) / 2 - bounds.y * scale,
    })
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      fitView,
      zoomBy: (factor: number) => zoomAt(factor),
      focusTable: (tableId: string) => {
        const el = containerRef.current
        const t = tablesRef.current.find(x => x.id === tableId)
        if (!el || !t) return
        setView(v => {
          const scale = Math.max(v.scale, 0.8)
          return {
            scale,
            x: el.clientWidth / 2 - (t.position.x + NODE_WIDTH / 2) * scale,
            y: el.clientHeight / 2 - (t.position.y + Math.min(tableHeight(t), el.clientHeight / scale - 80) / 2) * scale,
          }
        })
      },
      viewportCenter: () => {
        const el = containerRef.current
        const v = viewRef.current
        if (!el) return { x: 100, y: 100 }
        return { x: (el.clientWidth / 2 - v.x) / v.scale, y: (el.clientHeight / 2 - v.y) / v.scale }
      },
    }),
    [fitView, zoomAt],
  )

  // Wheel: pan, or zoom with Ctrl/Cmd (trackpad pinch also arrives as ctrl+wheel).
  // React's onWheel is passive, so preventDefault needs a native listener.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('[data-canvas-ui]')) return
      e.preventDefault()
      const scaleDelta = e.deltaMode === 1 ? 16 : 1
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-Math.max(-50, Math.min(50, e.deltaY * scaleDelta)) * 0.01)
        zoomAt(factor, toLocal(e.clientX, e.clientY))
      } else {
        const dx = (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * scaleDelta
        const dy = (e.shiftKey && !e.deltaX ? 0 : e.deltaY) * scaleDelta
        setView(v => ({ ...v, x: v.x - dx, y: v.y - dy }))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  const startPinchIfTwoPointers = () => {
    if (pointers.current.size !== 2) return false
    const [a, b] = [...pointers.current.values()]
    if (gesture.current?.kind === 'drag') onMoveEnd()
    gesture.current = {
      kind: 'pinch',
      distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      view: viewRef.current,
    }
    return true
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-canvas-ui]')) return
    pointers.current.set(e.pointerId, toLocal(e.clientX, e.clientY))
    if (startPinchIfTwoPointers()) return
    if ((e.target as HTMLElement).closest('[data-table-node]')) return
    // Empty canvas: left or middle button pans
    if (e.button !== 0 && e.button !== 1) return
    containerRef.current?.setPointerCapture(e.pointerId)
    gesture.current = { kind: 'pan', pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, view: viewRef.current, moved: false }
  }

  const handleHeaderPointerDown = useCallback((e: React.PointerEvent, table: Table) => {
    if (e.button !== 0) return
    e.preventDefault()
    pointers.current.set(e.pointerId, toLocal(e.clientX, e.clientY))
    if (pointers.current.size > 1) return
    containerRef.current?.setPointerCapture(e.pointerId)
    gesture.current = {
      kind: 'drag',
      pointerId: e.pointerId,
      tableId: table.id,
      startX: e.clientX,
      startY: e.clientY,
      origin: table.position,
      moved: false,
    }
  }, [])

  const handlePointerMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, toLocal(e.clientX, e.clientY))
    const g = gesture.current
    if (!g) return

    if (g.kind === 'pinch') {
      if (pointers.current.size < 2) return
      const [a, b] = [...pointers.current.values()]
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const scale = clampScale(g.view.scale * (distance / g.distance))
      const k = scale / g.view.scale
      setView({
        scale,
        x: center.x - (g.center.x - g.view.x) * k,
        y: center.y - (g.center.y - g.view.y) * k,
      })
      return
    }
    if (e.pointerId !== g.pointerId) return

    const dx = e.clientX - g.startX
    const dy = e.clientY - g.startY
    if (!g.moved && Math.hypot(dx, dy) < 3) return

    if (g.kind === 'pan') {
      g.moved = true
      setView({ ...g.view, x: g.view.x + dx, y: g.view.y + dy })
    } else {
      if (!g.moved) onMoveStart()
      g.moved = true
      const scale = viewRef.current.scale
      const snap = (n: number) => (e.altKey ? n : Math.round(n / GRID) * GRID)
      onMove(g.tableId, { x: snap(g.origin.x + dx / scale), y: snap(g.origin.y + dy / scale) })
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    const g = gesture.current
    if (!g) return
    if (g.kind === 'pinch') {
      if (pointers.current.size < 2) gesture.current = null
      return
    }
    if (e.pointerId !== g.pointerId) return
    if (g.kind === 'pan' && !g.moved && e.type === 'pointerup') onSelect(null)
    if (g.kind === 'drag' && g.moved) onMoveEnd()
    gesture.current = null
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-table-node], [data-canvas-ui]')) return
    const p = toLocal(e.clientX, e.clientY)
    const v = viewRef.current
    onAddTableAt({ x: Math.round((p.x - v.x) / v.scale / GRID) * GRID - NODE_WIDTH / 2, y: Math.round((p.y - v.y) / v.scale / GRID) * GRID - 20 })
  }

  const edges = useMemo(() => getEdges(tables), [tables])
  const related = useMemo(() => {
    const set = new Set<string>()
    for (const edge of edges) {
      if (edge.from.id === selectedTable) set.add(edge.to.id)
      if (edge.to.id === selectedTable) set.add(edge.from.id)
    }
    return set
  }, [edges, selectedTable])

  const gridSize = 20 * view.scale
  const majorSize = gridSize * 5

  return (
    <div
      ref={containerRef}
      data-diagram-canvas
      className="relative flex-1 touch-none select-none overflow-hidden outline-none"
      style={{
        backgroundColor: 'color-mix(in oklch, var(--background) 72%, transparent)',
        backgroundImage: `
          linear-gradient(to right, rgb(34 227 107 / 0.09) 1px, transparent 1px),
          linear-gradient(to bottom, rgb(34 227 107 / 0.09) 1px, transparent 1px),
          linear-gradient(to right, rgb(34 227 107 / 0.04) 1px, transparent 1px),
          linear-gradient(to bottom, rgb(34 227 107 / 0.04) 1px, transparent 1px)`,
        backgroundSize: `${majorSize}px ${majorSize}px, ${majorSize}px ${majorSize}px, ${gridSize}px ${gridSize}px, ${gridSize}px ${gridSize}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
        cursor: gesture.current?.kind === 'pan' && gesture.current.moved ? 'grabbing' : 'default',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
    >
      <div
        className="absolute left-0 top-0"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: '0 0' }}
      >
        <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1" aria-hidden>
          {edges.map(edge => {
            const p = edgePath(edge)
            const active = selectedTable !== null && (edge.from.id === selectedTable || edge.to.id === selectedTable)
            const dim = selectedTable !== null && !active
            const stroke = active ? getColorByName(edge.from.color || '').hex : '#22e36b'
            return (
              <g key={edge.id} opacity={dim ? 0.25 : active ? 1 : 0.7}>
                <path d={p.d} fill="none" stroke={stroke} strokeWidth={active ? 2.25 : 1.75} strokeLinecap="round" />
                <path d={cardinalityMarks(p, edge.oneToOne)} fill="none" stroke={stroke} strokeWidth={1.75} />
              </g>
            )
          })}
        </svg>

        {tables.map(table => (
          <TableNode
            key={table.id}
            table={table}
            isSelected={selectedTable === table.id}
            isRelated={related.has(table.id)}
            selectedColumnId={selectedTable === table.id ? selectedColumn : null}
            onHeaderPointerDown={handleHeaderPointerDown}
            onSelect={onSelect}
            onOpen={onOpenTable}
            onDelete={onDeleteTable}
            onDuplicate={onDuplicateTable}
          />
        ))}
      </div>

      {children}

      <div
        data-canvas-ui
        className="absolute bottom-4 right-4 z-10 flex items-center overflow-hidden rounded-md border border-primary/30 bg-card/90 text-xs text-primary backdrop-blur-sm"
      >
        <button type="button" className="p-2 hover:bg-primary/15" onClick={() => zoomAt(1 / 1.2)} title="Zoom out (-)" aria-label="Zoom out">
          <Minus className="size-4" />
        </button>
        <button
          type="button"
          className="min-w-14 px-1 py-2 tabular-nums hover:bg-primary/15"
          onClick={() => zoomAt(1 / viewRef.current.scale)}
          title="Reset zoom to 100%"
        >
          {Math.round(view.scale * 100)}%
        </button>
        <button type="button" className="p-2 hover:bg-primary/15" onClick={() => zoomAt(1.2)} title="Zoom in (+)" aria-label="Zoom in">
          <Plus className="size-4" />
        </button>
        <button
          type="button"
          className="border-l border-primary/30 p-2 hover:bg-primary/15"
          onClick={fitView}
          title="Fit diagram to screen (F)"
          aria-label="Fit diagram to screen"
        >
          <Maximize className="size-4" />
        </button>
      </div>
    </div>
  )
}
