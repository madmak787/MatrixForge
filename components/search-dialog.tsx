'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Table } from '@/lib/types'
import { cn } from '@/lib/utils'

interface SearchDialogProps {
  isOpen: boolean
  onClose: () => void
  tables: Table[]
  onSelect: (tableId: string, columnId?: string) => void
}

interface Hit {
  table: Table
  columnId?: string
  label: string
  detail: string
}

export function SearchDialog({ isOpen, onClose, tables, onSelect }: SearchDialogProps) {
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Matches table names first, then column names
  const hits = useMemo<Hit[]>(() => {
    const q = search.trim().toLowerCase()
    const tableHits = tables
      .filter(t => t.name.toLowerCase().includes(q))
      .map(t => ({ table: t, label: t.name, detail: `${t.columns.length} column${t.columns.length === 1 ? '' : 's'}` }))
    if (!q) return tableHits
    const columnHits = tables.flatMap(t =>
      t.columns
        .filter(c => c.name.toLowerCase().includes(q))
        .map(c => ({ table: t, columnId: c.id, label: `${t.name}.${c.name}`, detail: c.type.toLowerCase() })),
    )
    return [...tableHits, ...columnHits].slice(0, 50)
  }, [tables, search])

  const close = () => {
    setSearch('')
    setSelectedIndex(0)
    onClose()
  }

  const choose = (hit: Hit | undefined) => {
    if (!hit) return
    onSelect(hit.table.id, hit.columnId)
    close()
  }

  return (
    <Dialog open={isOpen} onOpenChange={o => !o && close()}>
      <DialogContent showCloseButton={false} className="top-24 translate-y-0 gap-0 overflow-hidden bg-card p-0 sm:max-w-md">
        <DialogTitle className="sr-only">Search tables and columns</DialogTitle>
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            autoFocus
            value={search}
            onChange={e => {
              setSearch(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown' && hits.length) {
                e.preventDefault()
                setSelectedIndex(i => (i + 1) % hits.length)
              } else if (e.key === 'ArrowUp' && hits.length) {
                e.preventDefault()
                setSelectedIndex(i => (i - 1 + hits.length) % hits.length)
              } else if (e.key === 'Enter') {
                e.preventDefault()
                choose(hits[selectedIndex])
              }
            }}
            placeholder="Search tables and columns…"
            className="flex-1 bg-transparent text-sm text-foreground outline-none"
            aria-label="Search tables and columns"
          />
        </div>

        <div className="max-h-72 overflow-y-auto py-1" role="listbox">
          {hits.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">{tables.length ? 'No matches' : 'No tables yet'}</div>
          ) : (
            hits.map((hit, idx) => (
              <button
                key={`${hit.table.id}-${hit.columnId || ''}`}
                type="button"
                role="option"
                aria-selected={idx === selectedIndex}
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => choose(hit)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm',
                  idx === selectedIndex ? 'bg-accent text-foreground' : 'text-foreground/85',
                )}
              >
                <span className="truncate font-mono">{hit.label}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{hit.detail}</span>
              </button>
            ))
          )}
        </div>

        <div className="border-t px-4 py-2 text-[11px] text-muted-foreground">↑↓ to move · Enter to open · Esc to close</div>
      </DialogContent>
    </Dialog>
  )
}
