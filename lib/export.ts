import { Table } from './types'
import { getColorByName } from './colors'
import {
  BODY_PADDING,
  COMMENT_HEIGHT,
  HEADER_HEIGHT,
  NODE_WIDTH,
  ROW_HEIGHT,
  cardinalityMarks,
  diagramBounds,
  edgePath,
  getEdges,
  headerHeight,
  tableHeight,
} from './schema'

const MARGIN = 48
const FONT = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace"
const BG = '#0b120d'
const EDGE = '#22e36b'
const MUTED = '#6f8f79'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function truncate(text: string, maxChars: number) {
  return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text
}

/** A standalone SVG of the whole diagram, independent of the current zoom and pan */
export function buildDiagramSVG(tables: Table[], title?: string): { svg: string; width: number; height: number } {
  const bounds = diagramBounds(tables) || { x: 0, y: 0, width: 200, height: 100 }
  const titleSpace = title ? 36 : 0
  const width = Math.ceil(bounds.width + MARGIN * 2)
  const height = Math.ceil(bounds.height + MARGIN * 2 + titleSpace)
  const dx = MARGIN - bounds.x
  const dy = MARGIN + titleSpace - bounds.y

  const parts: string[] = []
  parts.push(`<rect width="100%" height="100%" fill="${BG}"/>`)
  if (title) {
    parts.push(`<text x="${MARGIN}" y="${MARGIN - 4}" fill="${EDGE}" font-size="18" font-weight="700">${esc(title)}</text>`)
  }
  parts.push(`<g transform="translate(${dx} ${dy})">`)

  for (const edge of getEdges(tables)) {
    const p = edgePath(edge)
    parts.push(`<path d="${p.d}" fill="none" stroke="${EDGE}" stroke-opacity="0.75" stroke-width="1.75"/>`)
    parts.push(`<path d="${cardinalityMarks(p, edge.oneToOne)}" fill="none" stroke="${EDGE}" stroke-width="1.75"/>`)
  }

  for (const t of tables) {
    const color = getColorByName(t.color || '')
    const { x, y } = t.position
    const h = tableHeight(t)
    const hh = headerHeight(t)
    parts.push(`<g transform="translate(${x} ${y})">`)
    parts.push(`<rect width="${NODE_WIDTH}" height="${h}" rx="8" fill="#0f1a13" stroke="${color.hex}" stroke-width="1.5"/>`)
    parts.push(`<path d="M 0 8 A 8 8 0 0 1 8 0 L ${NODE_WIDTH - 8} 0 A 8 8 0 0 1 ${NODE_WIDTH} 8 L ${NODE_WIDTH} ${hh} L 0 ${hh} Z" fill="${color.hex}" fill-opacity="0.16"/>`)
    parts.push(`<line x1="0" y1="${hh}" x2="${NODE_WIDTH}" y2="${hh}" stroke="${color.hex}" stroke-opacity="0.6"/>`)
    parts.push(`<text x="14" y="${HEADER_HEIGHT / 2 + 5}" fill="${color.hex}" font-size="14" font-weight="700">${esc(truncate(t.name, 30))}</text>`)
    if (t.comment) {
      parts.push(`<text x="14" y="${HEADER_HEIGHT + COMMENT_HEIGHT / 2 - 2}" fill="${MUTED}" font-size="11">${esc(truncate(t.comment, 38))}</text>`)
    }
    t.columns.forEach((c, i) => {
      const cy = hh + BODY_PADDING + i * ROW_HEIGHT + ROW_HEIGHT / 2 + 4
      const badge = c.isPrimaryKey ? 'PK' : c.isForeignKey ? 'FK' : c.isUnique ? 'UQ' : ''
      const badgeColor = c.isPrimaryKey ? '#facc15' : c.isForeignKey ? '#38bdf8' : '#c084fc'
      if (badge) parts.push(`<text x="12" y="${cy}" fill="${badgeColor}" font-size="10" font-weight="700">${badge}</text>`)
      parts.push(`<text x="36" y="${cy}" fill="#d7f5df" font-size="12">${esc(truncate(c.name, 18))}${c.isNullable || c.isPrimaryKey ? '' : '<tspan fill="#fb923c">*</tspan>'}</text>`)
      const type = c.length && c.type !== 'ENUM' ? `${c.type}(${c.length})` : c.type
      parts.push(`<text x="${NODE_WIDTH - 12}" y="${cy}" fill="${MUTED}" font-size="11" text-anchor="end">${esc(truncate(type.toLowerCase(), 14))}</text>`)
    })
    if (t.columns.length === 0) {
      parts.push(`<text x="14" y="${hh + BODY_PADDING + ROW_HEIGHT / 2 + 4}" fill="${MUTED}" font-size="11" font-style="italic">no columns</text>`)
    }
    parts.push('</g>')
  }
  parts.push('</g>')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${esc(FONT)}">${parts.join('')}</svg>`
  return { svg, width, height }
}

export async function svgToPngBlob(svg: string, width: number, height: number, scale = 2): Promise<Blob> {
  // Browsers cap canvas size; shrink the scale for very large diagrams
  const maxSide = 16000
  const s = Math.min(scale, maxSide / width, maxSide / height)
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = new Image()
    img.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Could not render the diagram'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * s)
    canvas.height = Math.round(height * s)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas is not available')
    ctx.scale(s, s)
    ctx.drawImage(img, 0, 0)
    return await new Promise((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not encode PNG'))), 'image/png'),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoking right away can cancel the download in some browsers
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'schema'
}
