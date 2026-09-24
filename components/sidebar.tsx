'use client'

import { useEffect, useRef } from 'react'
import { ArrowDown, ArrowUp, ChevronRight, Copy, Key, Link2, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Column, ReferentialAction, Table } from '@/lib/types'
import { TABLE_COLORS, getColorByName } from '@/lib/colors'
import { DATA_TYPES, DEFAULT_LENGTH, REFERENTIAL_ACTIONS, sanitizeIdentifier } from '@/lib/schema'
import { cn } from '@/lib/utils'

export interface InspectorActions {
  onRenameTable: (tableId: string, name: string) => void
  onUpdateTable: (tableId: string, updates: Partial<Table>, mergeKey?: string) => void
  onAddColumn: (tableId: string) => void
  onUpdateColumn: (tableId: string, columnId: string, updates: Partial<Column>, mergeKey?: string) => void
  onRenameColumn: (tableId: string, columnId: string, name: string) => void
  onDeleteColumn: (tableId: string, columnId: string) => void
  onMoveColumn: (tableId: string, columnId: string, direction: -1 | 1) => void
  onAddRelation: (tableId: string, targetTableId: string) => void
  onDuplicateTable: (tableId: string) => void
  onDeleteTable: (tableId: string) => void
  onSelectColumn: (columnId: string | null) => void
  onSelectTable: (tableId: string) => void
}

interface SidebarProps extends InspectorActions {
  tables: Table[]
  table: Table | undefined
  selectedColumnId: string | null
  onClose?: () => void
  className?: string
}

const SIZED_TYPES = new Set(['VARCHAR', 'CHAR', 'DECIMAL', 'ENUM'])

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      <span className="text-primary">{'> '}</span>
      {children}
    </h3>
  )
}

function Flag({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-2 text-muted-foreground hover:text-foreground', disabled && 'pointer-events-none opacity-50')}>
      <Checkbox checked={checked} disabled={disabled} onCheckedChange={v => onChange(v === true)} className="border-primary/50" />
      {label}
    </label>
  )
}

function ColumnEditor({
  table,
  column,
  tables,
  actions,
}: {
  table: Table
  column: Column
  tables: Table[]
  actions: InspectorActions
}) {
  const update = (updates: Partial<Column>, mergeKey?: string) => actions.onUpdateColumn(table.id, column.id, updates, mergeKey)
  const target = tables.find(t => t.name === column.references?.table)
  const typeOptions = DATA_TYPES.includes(column.type) ? DATA_TYPES : [...DATA_TYPES, column.type]
  const nameTaken = table.columns.some(c => c.id !== column.id && c.name.toLowerCase() === column.name.toLowerCase())

  return (
    <div className="space-y-3 border-t border-primary/20 px-3 pb-3 pt-3 text-xs">
      <div>
        <Label htmlFor={`col-name-${column.id}`} className="mb-1 text-xs text-muted-foreground">Name</Label>
        <Input
          id={`col-name-${column.id}`}
          value={column.name}
          onChange={e => actions.onRenameColumn(table.id, column.id, sanitizeIdentifier(e.target.value))}
          className="h-8 border-primary/30 bg-background font-mono text-xs"
          aria-invalid={!column.name || nameTaken}
        />
        {(!column.name || nameTaken) && (
          <p className="mt-1 text-[11px] text-destructive">{column.name ? 'Another column already uses this name' : 'Name is required'}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className={cn(!SIZED_TYPES.has(column.type) && 'col-span-2')}>
          <Label className="mb-1 text-xs text-muted-foreground">Type</Label>
          <Select value={column.type} onValueChange={type => update({ type, length: SIZED_TYPES.has(type) ? column.length : undefined })}>
            <SelectTrigger size="sm" className="h-8 w-full border-primary/30 bg-background text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72 border-primary/30 bg-card">
              {typeOptions.map(type => (
                <SelectItem key={type} value={type} className="text-xs">{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {SIZED_TYPES.has(column.type) && (
          <div>
            <Label htmlFor={`col-len-${column.id}`} className="mb-1 text-xs text-muted-foreground">
              {column.type === 'ENUM' ? 'Values' : column.type === 'DECIMAL' ? 'Precision' : 'Length'}
            </Label>
            <Input
              id={`col-len-${column.id}`}
              value={column.length || ''}
              onChange={e => update({ length: e.target.value || undefined }, `len-${column.id}`)}
              placeholder={column.type === 'ENUM' ? 'a,b,c' : DEFAULT_LENGTH[column.type]}
              className="h-8 border-primary/30 bg-background font-mono text-xs"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-2 gap-y-2.5">
        <Flag
          label="Primary key"
          checked={column.isPrimaryKey}
          onChange={isPrimaryKey => update(isPrimaryKey ? { isPrimaryKey, isNullable: false } : { isPrimaryKey, isAutoIncrement: undefined })}
        />
        <Flag label="Not null" checked={!column.isNullable} disabled={column.isPrimaryKey} onChange={v => update({ isNullable: !v })} />
        <Flag label="Unique" checked={!!column.isUnique} disabled={column.isPrimaryKey} onChange={v => update({ isUnique: v || undefined })} />
        <Flag label="Index" checked={!!column.isIndexed} disabled={column.isPrimaryKey || !!column.isUnique} onChange={v => update({ isIndexed: v || undefined })} />
        <Flag
          label="Auto increment"
          checked={!!column.isAutoIncrement}
          disabled={!/INT/.test(column.type)}
          onChange={v => update({ isAutoIncrement: v || undefined })}
        />
      </div>

      <div className="rounded-md border border-primary/20 bg-background/40 p-2.5">
        <Flag
          label="Foreign key"
          checked={!!column.isForeignKey}
          onChange={v => update(v ? { isForeignKey: true } : { isForeignKey: undefined, references: undefined, onDelete: undefined })}
        />
        {column.isForeignKey && (
          <div className="mt-2.5 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="mb-1 text-xs text-muted-foreground">Table</Label>
                <Select
                  value={column.references?.table || ''}
                  onValueChange={name => {
                    const t = tables.find(x => x.name === name)
                    const pk = t?.columns.find(c => c.isPrimaryKey) || t?.columns[0]
                    // Match the referenced column's type so the constraint is valid
                    update({
                      references: { table: name, column: pk?.name || 'id' },
                      ...(pk ? { type: pk.type, length: pk.length, isAutoIncrement: undefined } : {}),
                    })
                  }}
                >
                  <SelectTrigger size="sm" className="h-8 w-full border-primary/30 bg-background text-xs">
                    <SelectValue placeholder="Choose…" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 border-primary/30 bg-card">
                    {tables.map(t => (
                      <SelectItem key={t.id} value={t.name} className="text-xs">{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 text-xs text-muted-foreground">Column</Label>
                <Select
                  value={column.references?.column || ''}
                  disabled={!target}
                  onValueChange={name => {
                    const c = target?.columns.find(x => x.name === name)
                    update({
                      references: { table: column.references!.table, column: name },
                      ...(c ? { type: c.type, length: c.length } : {}),
                    })
                  }}
                >
                  <SelectTrigger size="sm" className="h-8 w-full border-primary/30 bg-background text-xs">
                    <SelectValue placeholder="Choose…" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 border-primary/30 bg-card">
                    {target?.columns.map(c => (
                      <SelectItem key={c.id} value={c.name} className="text-xs">{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="mb-1 text-xs text-muted-foreground">On delete</Label>
              <Select value={column.onDelete || 'NO ACTION'} onValueChange={v => update({ onDelete: v === 'NO ACTION' ? undefined : (v as ReferentialAction) })}>
                <SelectTrigger size="sm" className="h-8 w-full border-primary/30 bg-background text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-primary/30 bg-card">
                  {REFERENTIAL_ACTIONS.map(a => (
                    <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {column.references && !target?.columns.some(c => c.name === column.references!.column) && (
              <p className="text-[11px] text-destructive">The referenced column no longer exists</p>
            )}
          </div>
        )}
      </div>

      <div>
        <Label htmlFor={`col-def-${column.id}`} className="mb-1 text-xs text-muted-foreground">Default value</Label>
        <Input
          id={`col-def-${column.id}`}
          value={column.defaultValue || ''}
          onChange={e => update({ defaultValue: e.target.value || undefined }, `def-${column.id}`)}
          placeholder="e.g. 0, active, CURRENT_TIMESTAMP"
          disabled={!!column.isAutoIncrement}
          className="h-8 border-primary/30 bg-background font-mono text-xs"
        />
      </div>

      <div>
        <Label htmlFor={`col-cmt-${column.id}`} className="mb-1 text-xs text-muted-foreground">Comment</Label>
        <Input
          id={`col-cmt-${column.id}`}
          value={column.comment || ''}
          onChange={e => update({ comment: e.target.value || undefined }, `cmt-${column.id}`)}
          placeholder="What this column holds"
          className="h-8 border-primary/30 bg-background text-xs"
        />
      </div>
    </div>
  )
}

export function Sidebar({ tables, table, selectedColumnId, onClose, className, ...actions }: SidebarProps) {
  const expandedRef = useRef<HTMLDivElement>(null)

  // Bring the column picked on the canvas into view
  useEffect(() => {
    expandedRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedColumnId])

  if (!table) {
    return (
      <aside className={cn('flex flex-col items-center justify-center gap-3 p-6 text-center', className)}>
        <div className="text-4xl text-primary/40">◈</div>
        <p className="text-sm text-muted-foreground">
          <span className="text-primary">{'> '}</span>
          Select a table to edit it
        </p>
        <p className="text-xs text-muted-foreground/70">Double-click the canvas to add one.</p>
      </aside>
    )
  }

  const color = getColorByName(table.color || '')
  const nameTaken = tables.some(t => t.id !== table.id && t.name.toLowerCase() === table.name.toLowerCase())
  const outgoing = table.columns.filter(c => c.isForeignKey && c.references)
  const incoming = tables.flatMap(t =>
    t.columns.filter(c => c.references?.table === table.name).map(c => ({ table: t, column: c })),
  )
  const others = tables.filter(t => t.id !== table.id)

  return (
    <aside className={cn('flex min-h-0 flex-col', className)}>
      <div className="flex items-center justify-between gap-2 border-b border-primary/30 px-4 py-3">
        <SectionTitle>Table</SectionTitle>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-7 text-muted-foreground" title="Duplicate table" onClick={() => actions.onDuplicateTable(table.id)}>
            <Copy className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" title="Delete table" onClick={() => actions.onDeleteTable(table.id)}>
            <Trash2 className="size-3.5" />
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" className="size-7 text-muted-foreground" title="Close" onClick={onClose}>
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-4 border-b border-primary/20 p-4">
          <div>
            <Label htmlFor="table-name" className="mb-1.5 text-xs text-muted-foreground">Name</Label>
            <Input
              id="table-name"
              value={table.name}
              onChange={e => actions.onRenameTable(table.id, sanitizeIdentifier(e.target.value))}
              placeholder="table_name"
              className="border-primary/30 bg-background font-mono text-sm"
              style={{ color: color.hex }}
              aria-invalid={!table.name || nameTaken}
            />
            {(!table.name || nameTaken) && (
              <p className="mt-1 text-[11px] text-destructive">{table.name ? 'Another table already uses this name' : 'Name is required'}</p>
            )}
          </div>

          <div>
            <Label className="mb-1.5 text-xs text-muted-foreground">Color</Label>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Table color">
              {TABLE_COLORS.map(c => (
                <button
                  key={c.name}
                  type="button"
                  role="radio"
                  aria-checked={c.name === color.name}
                  title={c.name}
                  onClick={() => actions.onUpdateTable(table.id, { color: c.name })}
                  className={cn(
                    'size-6 rounded-full border-2 transition-transform hover:scale-110',
                    c.name === color.name ? 'border-foreground' : 'border-transparent',
                  )}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="table-comment" className="mb-1.5 text-xs text-muted-foreground">Comment</Label>
            <textarea
              id="table-comment"
              value={table.comment || ''}
              onChange={e => actions.onUpdateTable(table.id, { comment: e.target.value || undefined }, `tcmt-${table.id}`)}
              placeholder="What this table stores"
              rows={2}
              className="w-full resize-none rounded-md border border-primary/30 bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
        </div>

        <div className="space-y-2 p-4">
          <div className="flex items-center justify-between">
            <SectionTitle>Columns ({table.columns.length})</SectionTitle>
            <Button
              onClick={() => actions.onAddColumn(table.id)}
              size="sm"
              variant="outline"
              className="h-7 gap-1 border-primary/50 px-2 text-xs text-primary hover:bg-primary/20"
            >
              <Plus className="size-3.5" />
              Add
            </Button>
          </div>

          {table.columns.length === 0 && (
            <p className="rounded bg-background/30 py-8 text-center text-xs text-muted-foreground">No columns yet</p>
          )}

          {table.columns.map((column, index) => {
            const expanded = selectedColumnId === column.id
            return (
              <div
                key={column.id}
                ref={expanded ? expandedRef : undefined}
                className={cn('rounded-md border bg-background/40 transition-colors', expanded ? 'border-primary/50' : 'border-primary/15 hover:border-primary/35')}
              >
                <div className="flex items-center gap-1 pr-1">
                  <button
                    type="button"
                    onClick={() => actions.onSelectColumn(expanded ? null : column.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left"
                    aria-expanded={expanded}
                  >
                    <ChevronRight className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-90')} />
                    {column.isPrimaryKey && <Key className="size-3 shrink-0 text-yellow-400" />}
                    {column.isForeignKey && <Link2 className="size-3 shrink-0 text-sky-400" />}
                    <span className="truncate font-mono text-xs font-semibold text-primary">{column.name || '(unnamed)'}</span>
                    <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground">
                      {column.type.toLowerCase()}
                      {column.length && column.type !== 'ENUM' ? `(${column.length})` : ''}
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground"
                    disabled={index === 0}
                    title="Move up"
                    onClick={() => actions.onMoveColumn(table.id, column.id, -1)}
                  >
                    <ArrowUp className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground"
                    disabled={index === table.columns.length - 1}
                    title="Move down"
                    onClick={() => actions.onMoveColumn(table.id, column.id, 1)}
                  >
                    <ArrowDown className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground hover:text-destructive"
                    title="Delete column"
                    onClick={() => actions.onDeleteColumn(table.id, column.id)}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
                {expanded && <ColumnEditor table={table} column={column} tables={tables} actions={actions} />}
              </div>
            )
          })}
        </div>

        <div className="space-y-2 border-t border-primary/20 p-4 text-xs">
          <div className="flex items-center justify-between gap-2">
            <SectionTitle>Relations</SectionTitle>
            {others.length > 0 && (
              <Select value="" onValueChange={targetId => actions.onAddRelation(table.id, targetId)}>
                <SelectTrigger size="sm" className="h-7 w-auto gap-1 border-primary/50 px-2 text-xs text-primary">
                  <Plus className="size-3.5" />
                  <span>Link to…</span>
                </SelectTrigger>
                <SelectContent align="end" className="max-h-72 border-primary/30 bg-card">
                  {others.map(t => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {outgoing.length === 0 && incoming.length === 0 && (
            <p className="text-muted-foreground">No relations. Use “Link to…” to add a foreign key column.</p>
          )}
          {outgoing.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => actions.onSelectColumn(c.id)}
              className="block w-full truncate rounded bg-background/40 px-2 py-1.5 text-left font-mono hover:bg-primary/10"
            >
              <span className="text-primary">{c.name}</span>
              <span className="text-muted-foreground"> → {c.references!.table}.{c.references!.column}</span>
            </button>
          ))}
          {incoming.map(({ table: t, column: c }) => (
            <button
              key={`${t.id}-${c.id}`}
              type="button"
              onClick={() => actions.onSelectTable(t.id)}
              className="block w-full truncate rounded bg-background/40 px-2 py-1.5 text-left font-mono hover:bg-primary/10"
            >
              <span className="text-muted-foreground">{t.name}.{c.name} → </span>
              <span className="text-primary">{c.references!.column}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
