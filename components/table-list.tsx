'use client'

import { useMemo, useState } from 'react'
import { Plus, Search, Table2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table } from '@/lib/types'
import { getColorByName } from '@/lib/colors'
import { cn } from '@/lib/utils'

interface TableListProps {
  tables: Table[]
  selectedTable: string | null
  onSelect: (tableId: string) => void
  onAddTable: () => void
}

/** Left-hand explorer: every table in the project, filterable */
export function TableList({ tables, selectedTable, onSelect, onAddTable }: TableListProps) {
  const [filter, setFilter] = useState('')
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const sorted = [...tables].sort((a, b) => a.name.localeCompare(b.name))
    return q ? sorted.filter(t => t.name.toLowerCase().includes(q) || t.columns.some(c => c.name.toLowerCase().includes(q))) : sorted
  }, [tables, filter])
  const relationCount = useMemo(() => tables.reduce((n, t) => n + t.columns.filter(c => c.isForeignKey && c.references).length, 0), [tables])

  return (
    <aside className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pb-2 pt-3.5">
        <h2 className="panel-heading">Tables</h2>
        <Button variant="ghost" size="icon" className="size-6 text-muted-foreground" onClick={onAddTable} title="New table (N)" aria-label="New table">
          <Plus className="size-3.5" />
        </Button>
      </div>
      <div className="px-3 pb-2">
        <label className="flex h-8 items-center gap-2 rounded-md border bg-background/50 px-2.5 text-sm focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter"
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
            aria-label="Filter tables"
          />
        </label>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2" aria-label="Tables">
        {visible.map(t => {
          const color = getColorByName(t.color || '')
          const active = t.id === selectedTable
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              aria-current={active || undefined}
              className={cn(
                'group flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
              )}
            >
              <span className="size-2 shrink-0 rounded-[3px]" style={{ backgroundColor: color.hex }} />
              <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{t.name || '(unnamed)'}</span>
              <span className="text-[11px] tabular-nums text-muted-foreground/70">{t.columns.length}</span>
            </button>
          )
        })}
        {tables.length > 0 && visible.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted-foreground">No tables match “{filter}”</p>}
        {tables.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-3 py-10 text-center text-xs text-muted-foreground">
            <Table2 className="size-5 opacity-60" />
            No tables yet
          </div>
        )}
      </nav>

      <div className="grid grid-cols-2 border-t text-center">
        <div className="border-r py-2.5">
          <div className="text-base font-semibold tabular-nums">{tables.length}</div>
          <div className="text-[11px] text-muted-foreground">tables</div>
        </div>
        <div className="py-2.5">
          <div className="text-base font-semibold tabular-nums">{relationCount}</div>
          <div className="text-[11px] text-muted-foreground">relations</div>
        </div>
      </div>
    </aside>
  )
}
