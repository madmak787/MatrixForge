'use client'

import { memo } from 'react'
import { Copy, Key, Link2, Trash2 } from 'lucide-react'
import { Table } from '@/lib/types'
import { cn } from '@/lib/utils'
import { getColorByName } from '@/lib/colors'
import { BODY_PADDING, COMMENT_HEIGHT, HEADER_HEIGHT, NODE_WIDTH, ROW_HEIGHT, tableHeight } from '@/lib/schema'

interface TableNodeProps {
  table: Table
  isSelected: boolean
  /** Name of a table related to the selected one, so it can be highlighted */
  isRelated: boolean
  selectedColumnId: string | null
  onHeaderPointerDown: (e: React.PointerEvent, table: Table) => void
  onSelect: (tableId: string, columnId?: string) => void
  onOpen: (tableId: string) => void
  onDelete: (tableId: string) => void
  onDuplicate: (tableId: string) => void
}

function formatType(type: string, length?: string) {
  if (!length || type === 'ENUM') return type.toLowerCase()
  return `${type.toLowerCase()}(${length})`
}

export const TableNode = memo(function TableNode({
  table,
  isSelected,
  isRelated,
  selectedColumnId,
  onHeaderPointerDown,
  onSelect,
  onOpen,
  onDelete,
  onDuplicate,
}: TableNodeProps) {
  const color = getColorByName(table.color || '')

  return (
    <div
      data-table-node={table.id}
      className={cn(
        'absolute overflow-hidden rounded-lg border bg-card shadow-[0_8px_24px_-8px_rgb(0_0_0/0.6)] transition-[border-color,box-shadow] duration-150',
        !isSelected && !isRelated && 'hover:border-input',
      )}
      style={{
        left: table.position.x,
        top: table.position.y,
        width: NODE_WIDTH,
        height: tableHeight(table),
        borderColor: isSelected ? color.hex : isRelated ? `${color.hex}99` : undefined,
        boxShadow: isSelected ? `0 0 0 3px ${color.hex}33, 0 12px 32px -8px rgb(0 0 0 / 0.7)` : undefined,
      }}
      onPointerDown={e => {
        // Clicking anywhere on a table selects it; only the header starts a drag
        if (e.button === 0 && !(e.target as HTMLElement).closest('[data-column-id]')) onSelect(table.id)
      }}
    >
      <div
        className="group/header flex cursor-grab touch-none items-start gap-2 border-b px-3 active:cursor-grabbing"
        style={{
          height: HEADER_HEIGHT + (table.comment ? COMMENT_HEIGHT : 0),
          boxShadow: `inset 0 3px 0 ${color.hex}`,
          backgroundImage: `linear-gradient(to bottom, ${color.hex}1a, ${color.hex}08)`,
        }}
        onPointerDown={e => {
          if ((e.target as HTMLElement).closest('button')) return
          onHeaderPointerDown(e, table)
        }}
        onDoubleClick={() => onOpen(table.id)}
      >
        <div className="min-w-0 flex-1 pt-[11px]">
          <h3 className="flex items-center gap-2 font-mono text-[13px] font-semibold leading-5 text-foreground" title={table.name}>
            <span className="size-2 shrink-0 rounded-[3px]" style={{ backgroundColor: color.hex }} />
            <span className="truncate">{table.name}</span>
          </h3>
          {table.comment && (
            <p className="truncate pl-4 text-[11px] leading-[16px] text-muted-foreground" title={table.comment}>
              {table.comment}
            </p>
          )}
        </div>
        <div
          className={cn(
            'mt-[9px] flex gap-0.5 opacity-0 transition-opacity group-hover/header:opacity-100 focus-within:opacity-100',
            isSelected && 'opacity-100',
          )}
        >
          <button
            type="button"
            onClick={() => onDuplicate(table.id)}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Duplicate table (Ctrl+D)"
            aria-label={`Duplicate ${table.name}`}
          >
            <Copy className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(table.id)}
            className="rounded p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
            title="Delete table (Del)"
            aria-label={`Delete ${table.name}`}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <div style={{ paddingTop: BODY_PADDING, paddingBottom: BODY_PADDING }}>
        {table.columns.length === 0 ? (
          <p className="px-3 text-xs italic leading-[26px] text-muted-foreground">No columns</p>
        ) : (
          table.columns.map(column => (
            <div
              key={column.id}
              data-column-id={column.id}
              className={cn(
                'flex cursor-pointer items-center gap-2 px-3 font-mono text-xs hover:bg-accent/70',
                selectedColumnId === column.id && 'bg-accent',
              )}
              style={{ height: ROW_HEIGHT }}
              title={column.comment || undefined}
              onPointerDown={e => e.button === 0 && onSelect(table.id, column.id)}
            >
              <span className="flex w-4 shrink-0 justify-center">
                {column.isPrimaryKey ? (
                  <Key className="size-3 text-amber-300" aria-label="Primary key" />
                ) : column.isForeignKey ? (
                  <Link2 className="size-3 text-sky-300" aria-label="Foreign key" />
                ) : column.isUnique ? (
                  <span className="size-1.5 rounded-full bg-violet-300" aria-label="Unique" />
                ) : null}
              </span>
              <span className={cn("min-w-0 flex-1 truncate", column.isPrimaryKey ? "font-medium text-foreground" : "text-foreground/90")}>
                {column.name}
                {!column.isNullable && !column.isPrimaryKey && <span className="text-amber-400/80">*</span>}
              </span>
              <span className="max-w-[45%] truncate text-[11px] text-muted-foreground/80">
                {formatType(column.type, column.length)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
})
