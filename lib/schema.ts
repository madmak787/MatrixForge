import { Column, ReferentialAction, Table } from './types'
import { TABLE_COLORS } from './colors'

export const DATA_TYPES = [
  'INT', 'BIGINT', 'SMALLINT', 'TINYINT',
  'VARCHAR', 'CHAR', 'TEXT', 'LONGTEXT',
  'BOOLEAN', 'DATE', 'TIME', 'TIMESTAMP', 'DATETIME',
  'DECIMAL', 'FLOAT', 'DOUBLE',
  'JSON', 'UUID', 'BLOB', 'ENUM',
]

export const REFERENTIAL_ACTIONS: ReferentialAction[] = ['NO ACTION', 'CASCADE', 'SET NULL', 'RESTRICT']

/** Types that take a size in parentheses, with the size used when none is given */
export const DEFAULT_LENGTH: Record<string, string> = {
  VARCHAR: '255',
  CHAR: '1',
  DECIMAL: '10,2',
}

export const isIntegerType = (type: string) => /INT/i.test(type)

export function uid(prefix: string) {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${Date.now().toString(36)}-${random}`
}

/** Letters, digits and underscores only, not starting with a digit */
export function sanitizeIdentifier(name: string) {
  return name.trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_$]/g, '')
}

export function uniqueName(base: string, taken: string[]) {
  const lower = new Set(taken.map(t => t.toLowerCase()))
  if (!lower.has(base.toLowerCase())) return base
  let i = 2
  while (lower.has(`${base}_${i}`.toLowerCase())) i++
  return `${base}_${i}`
}

// ---------------------------------------------------------------------------
// Normalizing data from localStorage, JSON imports and templates
// ---------------------------------------------------------------------------

function normalizeColumn(raw: any, index: number): Column {
  const references =
    raw?.references && typeof raw.references.table === 'string'
      ? { table: raw.references.table, column: String(raw.references.column || 'id') }
      : undefined
  const isPrimaryKey = !!raw?.isPrimaryKey
  return {
    id: typeof raw?.id === 'string' && raw.id ? raw.id : uid('col'),
    name: typeof raw?.name === 'string' && raw.name ? raw.name : `column_${index + 1}`,
    type: typeof raw?.type === 'string' && raw.type ? raw.type.toUpperCase() : 'VARCHAR',
    length: raw?.length ? String(raw.length) : undefined,
    isPrimaryKey,
    // Primary keys are never nullable; everything else defaults to nullable
    isNullable: isPrimaryKey ? false : raw?.isNullable !== false,
    isAutoIncrement: !!raw?.isAutoIncrement || undefined,
    defaultValue: raw?.defaultValue != null && raw.defaultValue !== '' ? String(raw.defaultValue) : undefined,
    comment: raw?.comment ? String(raw.comment) : undefined,
    isForeignKey: !!raw?.isForeignKey || !!references || undefined,
    references,
    onDelete: REFERENTIAL_ACTIONS.includes(raw?.onDelete) ? raw.onDelete : undefined,
    isIndexed: !!raw?.isIndexed || undefined,
    isUnique: !!raw?.isUnique || undefined,
  }
}

export function normalizeTables(raw: unknown): Table[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  return raw
    .filter(t => t && typeof t === 'object')
    .map((t: any, index) => {
      let id = typeof t.id === 'string' && t.id ? t.id : uid('table')
      if (seen.has(id)) id = uid('table')
      seen.add(id)
      const columnIds = new Set<string>()
      const columns = (Array.isArray(t.columns) ? t.columns : []).map((c: any, i: number) => {
        const col = normalizeColumn(c, i)
        if (columnIds.has(col.id)) col.id = uid('col')
        columnIds.add(col.id)
        return col
      })
      return {
        id,
        name: typeof t.name === 'string' && t.name ? t.name : `table_${index + 1}`,
        columns,
        position: {
          x: Number.isFinite(t.position?.x) ? t.position.x : 80 + (index % 4) * 320,
          y: Number.isFinite(t.position?.y) ? t.position.y : 80 + Math.floor(index / 4) * 300,
        },
        comment: t.comment ? String(t.comment) : undefined,
        color: TABLE_COLORS.some(c => c.name === t.color) ? t.color : TABLE_COLORS[index % TABLE_COLORS.length].name,
      }
    })
}

// ---------------------------------------------------------------------------
// Edits that keep foreign keys consistent
// ---------------------------------------------------------------------------

export function renameTable(tables: Table[], tableId: string, newName: string): Table[] {
  const table = tables.find(t => t.id === tableId)
  if (!table || table.name === newName) return tables
  const oldName = table.name
  return tables.map(t => ({
    ...(t.id === tableId ? { ...t, name: newName } : t),
    columns: t.columns.map(c =>
      c.references?.table === oldName ? { ...c, references: { ...c.references, table: newName } } : c,
    ),
  }))
}

export function renameColumn(tables: Table[], tableId: string, columnId: string, newName: string): Table[] {
  const table = tables.find(t => t.id === tableId)
  const column = table?.columns.find(c => c.id === columnId)
  if (!table || !column || column.name === newName) return tables
  return tables.map(t => ({
    ...t,
    columns: t.columns.map(c => {
      if (t.id === tableId && c.id === columnId) return { ...c, name: newName }
      if (c.references?.table === table.name && c.references.column === column.name) {
        return { ...c, references: { ...c.references, column: newName } }
      }
      return c
    }),
  }))
}

function dropReferences(tables: Table[], match: (ref: NonNullable<Column['references']>) => boolean): Table[] {
  return tables.map(t => ({
    ...t,
    columns: t.columns.map(c =>
      c.references && match(c.references)
        ? { ...c, isForeignKey: undefined, references: undefined, onDelete: undefined }
        : c,
    ),
  }))
}

export function deleteTable(tables: Table[], tableId: string): Table[] {
  const table = tables.find(t => t.id === tableId)
  if (!table) return tables
  return dropReferences(tables.filter(t => t.id !== tableId), ref => ref.table === table.name)
}

export function deleteColumn(tables: Table[], tableId: string, columnId: string): Table[] {
  const table = tables.find(t => t.id === tableId)
  const column = table?.columns.find(c => c.id === columnId)
  if (!table || !column) return tables
  const next = tables.map(t => (t.id === tableId ? { ...t, columns: t.columns.filter(c => c.id !== columnId) } : t))
  return dropReferences(next, ref => ref.table === table.name && ref.column === column.name)
}

// ---------------------------------------------------------------------------
// Node geometry, shared by the canvas, relationship lines and image export
// ---------------------------------------------------------------------------

export const NODE_WIDTH = 280
export const HEADER_HEIGHT = 40
export const COMMENT_HEIGHT = 18
export const ROW_HEIGHT = 26
export const BODY_PADDING = 6

export function headerHeight(table: Table) {
  return HEADER_HEIGHT + (table.comment ? COMMENT_HEIGHT : 0)
}

export function tableHeight(table: Table) {
  return headerHeight(table) + Math.max(table.columns.length, 1) * ROW_HEIGHT + BODY_PADDING * 2
}

/** Canvas-space Y of the middle of a column row */
export function columnCenterY(table: Table, columnIndex: number) {
  return table.position.y + headerHeight(table) + BODY_PADDING + columnIndex * ROW_HEIGHT + ROW_HEIGHT / 2
}

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export function diagramBounds(tables: Table[]): Bounds | null {
  if (tables.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const t of tables) {
    minX = Math.min(minX, t.position.x)
    minY = Math.min(minY, t.position.y)
    maxX = Math.max(maxX, t.position.x + NODE_WIDTH)
    maxY = Math.max(maxY, t.position.y + tableHeight(t))
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

// ---------------------------------------------------------------------------
// Relationships
// ---------------------------------------------------------------------------

export interface Edge {
  id: string
  from: Table
  fromColumn: Column
  fromIndex: number
  to: Table
  toColumn: Column
  toIndex: number
  /** The FK column is unique or the primary key, so at most one row points at each target */
  oneToOne: boolean
}

export function getEdges(tables: Table[]): Edge[] {
  const byName = new Map(tables.map(t => [t.name, t]))
  const edges: Edge[] = []
  for (const from of tables) {
    from.columns.forEach((col, fromIndex) => {
      if (!col.isForeignKey || !col.references) return
      const to = byName.get(col.references.table)
      if (!to) return
      const toIndex = to.columns.findIndex(c => c.name === col.references!.column)
      if (toIndex === -1) return
      edges.push({
        id: `${from.id}:${col.id}`,
        from,
        fromColumn: col,
        fromIndex,
        to,
        toColumn: to.columns[toIndex],
        toIndex,
        oneToOne: !!col.isUnique || (col.isPrimaryKey && from.columns.filter(c => c.isPrimaryKey).length === 1),
      })
    })
  }
  return edges
}

export interface EdgePath {
  d: string
  start: { x: number; y: number; dir: 1 | -1 }
  end: { x: number; y: number; dir: 1 | -1 }
  mid: { x: number; y: number }
}

const STUB = 18

/** Bezier from the FK row to the referenced row, leaving from whichever sides face each other */
export function edgePath(edge: Edge): EdgePath {
  const { from, to } = edge
  const y1 = columnCenterY(from, edge.fromIndex)
  const y2 = columnCenterY(to, edge.toIndex)
  const fromLeft = from.position.x
  const fromRight = fromLeft + NODE_WIDTH
  const toLeft = to.position.x
  const toRight = toLeft + NODE_WIDTH

  let x1: number, x2: number, d1: 1 | -1, d2: 1 | -1
  if (from.id === to.id) {
    // Self reference: loop out of the right side
    x1 = fromRight; x2 = fromRight; d1 = 1; d2 = 1
  } else if (toLeft >= fromRight + 2 * STUB) {
    x1 = fromRight; x2 = toLeft; d1 = 1; d2 = -1
  } else if (fromLeft >= toRight + 2 * STUB) {
    x1 = fromLeft; x2 = toRight; d1 = -1; d2 = 1
  } else {
    // Tables overlap horizontally: route around the right-hand side
    x1 = fromRight; x2 = toRight; d1 = 1; d2 = 1
  }

  const reach = from.id === to.id ? 60 : Math.max(Math.abs(x2 - x1) * 0.45, 60)
  const sx = x1 + d1 * STUB
  const ex = x2 + d2 * STUB
  const d = `M ${x1} ${y1} L ${sx} ${y1} C ${sx + d1 * reach} ${y1} ${ex + d2 * reach} ${y2} ${ex} ${y2} L ${x2} ${y2}`
  const mid = { x: (sx + ex) / 2 + (d1 === d2 ? d1 * reach * 0.75 : 0), y: (y1 + y2) / 2 }
  return { d, start: { x: x1, y: y1, dir: d1 }, end: { x: x2, y: y2, dir: d2 }, mid }
}

/** Crow's foot ("many") at the FK end, a bar ("one") at the referenced end */
export function cardinalityMarks(p: EdgePath, oneToOne: boolean) {
  const { start: s, end: e } = p
  const bar = (x: number, y: number) => `M ${x} ${y - 6} L ${x} ${y + 6}`
  const oneEnd = bar(e.x + e.dir * 8, e.y) + ' ' + bar(e.x + e.dir * 12, e.y)
  const manyStart = oneToOne
    ? bar(s.x + s.dir * 8, s.y) + ' ' + bar(s.x + s.dir * 12, s.y)
    : `M ${s.x} ${s.y - 7} L ${s.x + s.dir * 11} ${s.y} L ${s.x} ${s.y + 7} ${bar(s.x + s.dir * 14, s.y)}`
  return `${manyStart} ${oneEnd}`
}

// ---------------------------------------------------------------------------
// Automatic layout
// ---------------------------------------------------------------------------

const GAP_X = 120
const GAP_Y = 48

/**
 * Layered layout: referenced tables sit to the left of the tables that point at them.
 * Returns new positions starting at (origin.x, origin.y).
 */
export function autoLayout(tables: Table[], origin = { x: 80, y: 80 }): Table[] {
  if (tables.length === 0) return tables
  const byName = new Map(tables.map(t => [t.name, t]))
  const deps = new Map<string, string[]>()
  for (const t of tables) {
    const targets = t.columns
      .map(c => (c.isForeignKey && c.references ? byName.get(c.references.table)?.id : undefined))
      .filter((id): id is string => !!id && id !== t.id)
    deps.set(t.id, [...new Set(targets)])
  }

  const rank = new Map<string, number>()
  const visiting = new Set<string>()
  const depth = (id: string): number => {
    if (rank.has(id)) return rank.get(id)!
    if (visiting.has(id)) return 0 // cycle
    visiting.add(id)
    const r = Math.max(-1, ...(deps.get(id) || []).map(depth)) + 1
    visiting.delete(id)
    rank.set(id, r)
    return r
  }
  tables.forEach(t => depth(t.id))

  const layers: Table[][] = []
  for (const t of tables) {
    const r = rank.get(t.id) || 0
    ;(layers[r] ||= []).push(t)
  }

  // Very wide layers wrap into extra columns so the diagram stays roughly screen-shaped
  const maxLayerHeight = Math.max(900, Math.sqrt(tables.reduce((s, t) => s + tableHeight(t) + GAP_Y, 0) * 1200))
  const positions = new Map<string, { x: number; y: number }>()
  let x = origin.x
  for (const layer of layers.filter(Boolean)) {
    let y = origin.y
    for (const t of layer) {
      const h = tableHeight(t)
      if (y > origin.y && y + h > origin.y + maxLayerHeight) {
        x += NODE_WIDTH + GAP_X
        y = origin.y
      }
      positions.set(t.id, { x, y })
      y += h + GAP_Y
    }
    x += NODE_WIDTH + GAP_X
  }
  return tables.map(t => ({ ...t, position: positions.get(t.id) || t.position }))
}
