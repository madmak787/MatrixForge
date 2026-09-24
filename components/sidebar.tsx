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
    <h3 className="panel-heading">{children}</h3>
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
    <label className={cn('flex cursor-pointer items-center gap-2 text-foreground/85 hover:text-foreground', disabled && 'pointer-events-none opacity-50')}>
      <Checkbox checked={checked} disabled={disabled} onCheckedChange={v => onChange(v === true)}  />
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
    <div className="space-y-3 border-t px-3 pb-3.5 pt-3 text-xs">
      <div>
        <Label htmlFor={`col-name-${column.id}`} className="mb-1 text-xs text-muted-foreground">Name</Label>
        <Input
          id={`col-name-${column.id}`}
          value={column.name}
          onChange={e => actions.onRenameColumn(table.id, column.id, sanitizeIdentifier(e.target.value))}
          className="h-8 bg-background/60 font-mono text-xs"
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
            <SelectTrigger size="sm" className="h-8 w-full bg-background/60 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72 ">
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
              className="h-8 bg-background/60 font-mono text-xs"
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

      <div className="rounded-md border bg-background/40 p-2.5">
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
                  <SelectTrigger size="sm" className="h-8 w-full bg-background/60 text-xs">
                    <SelectValue placeholder="Choose…" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 ">
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
                  <SelectTrigger size="sm" className="h-8 w-full bg-background/60 text-xs">
                    <SelectValue placeholder="Choose…" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 ">
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
                <SelectTrigger size="sm" className="h-8 w-full bg-background/60 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="">
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
          className="h-8 bg-background/60 font-mono text-xs"
        />
      </div>

      <div>
        <Label htmlFor={`col-cmt-${column.id}`} className="mb-1 text-xs text-muted-foreground">Comment</Label>
        <Input
          id={`col-cmt-${column.id}`}
          value={column.comment || ''}
          onChange={e => update({ comment: e.target.value || undefined }, `cmt-${column.id}`)}
          placeholder="What this column holds"
          className="h-8 bg-background/60 text-xs"
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
        <div className="flex size-10 items-center justify-center rounded-lg border bg-background/50 font-mono text-lg text-primary/70">◈</div>
        <p className="text-sm font-medium">No table selected</p>
        <p className="max-w-52 text-xs leading-relaxed text-muted-foreground">Select a table on the canvas or in the list to edit it. Double-click empty canvas to add one.</p>
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
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b px-4">
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
        <div className="space-y-4 border-b p-4">
          <div>
            <Label htmlFor="table-name" className="mb-1.5 text-xs text-muted-foreground">Name</Label>
            <Input
              id="table-name"
              value={table.name}
              onChange={e => actions.onRenameTable(table.id, sanitizeIdentifier(e.target.value))}
              placeholder="table_name"
              className="bg-background/60 font-mono text-sm"
              aria-invalid={!table.name || nameTaken}
            />
            {(!table.name || nameTaken) && (
              <p className="mt-1 text-[11px] text-destructive">{table.name ? 'Another table already uses this name' : 'Name is required'}</p>
            )}
          </div>

          <div>
            <Label className="mb-1.5 text-xs text-muted-foreground">Color</Label>
            <div className="grid grid-cols-12 gap-1.5 py-0.5" role="radiogroup" aria-label="Table color">
              {TABLE_COLORS.map(c => (
                <button
                  key={c.name}
                  type="button"
                  role="radio"
                  aria-checked={c.name === color.name}
                  title={c.name}
                  onClick={() => actions.onUpdateTable(table.id, { color: c.name })}
                  className={cn(
                    'aspect-square w-full rounded-full ring-offset-2 ring-offset-card transition-transform hover:scale-110',
                    c.name === color.name && 'ring-2 ring-foreground/80',
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
              className="w-full resize-none rounded-md border bg-background/60 px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
              className="h-7 gap-1 bg-transparent px-2 text-xs"
            >
              <Plus className="size-3.5" />
              Add
            </Button>
          </div>

          {table.columns.length === 0 && (
            <p className="rounded-md border border-dashed py-8 text-center text-xs text-muted-foreground">No columns yet</p>
          )}

          {table.columns.map((column, index) => {
            const expanded = selectedColumnId === column.id
            return (
              <div
                key={column.id}
                ref={expanded ? expandedRef : undefined}
                className={cn('rounded-md border bg-background/40 transition-colors', expanded ? 'border-input bg-background/70' : 'hover:border-input')}
              >
                <div className="group/row flex items-center gap-0.5 pr-1">
                  <button
                    type="button"
                    onClick={() => actions.onSelectColumn(expanded ? null : column.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left"
                    aria-expanded={expanded}
                  >
                    <ChevronRight className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-90')} />
                    {column.isPrimaryKey && <Key className="size-3 shrink-0 text-amber-300" />}
                    {column.isForeignKey && <Link2 className="size-3 shrink-0 text-sky-300" />}
                    <span className="truncate font-mono text-xs font-medium text-foreground">{column.name || '(unnamed)'}</span>
                    <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground">
                      {column.type.toLowerCase()}
                      {column.length && column.type !== 'ENUM' ? `(${column.length})` : ''}
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground [@media(hover:hover)]:opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
                    disabled={index === 0}
                    title="Move up"
                    onClick={() => actions.onMoveColumn(table.id, column.id, -1)}
                  >
                    <ArrowUp className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground [@media(hover:hover)]:opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
                    disabled={index === table.columns.length - 1}
                    title="Move down"
                    onClick={() => actions.onMoveColumn(table.id, column.id, 1)}
                  >
                    <ArrowDown className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground hover:text-destructive [@media(hover:hover)]:opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
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

        <div className="space-y-2 border-t p-4 text-xs">
          <div className="flex items-center justify-between gap-2">
            <SectionTitle>Relations</SectionTitle>
            {others.length > 0 && (
              <Select value="" onValueChange={targetId => actions.onAddRelation(table.id, targetId)}>
                <SelectTrigger size="sm" className="h-7 w-auto gap-1 bg-transparent px-2 text-xs dark:bg-transparent">
                  <Plus className="size-3.5" />
                  <span>Link to…</span>
                </SelectTrigger>
                <SelectContent align="end" className="max-h-72 ">
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
              className="block w-full truncate rounded-md border bg-background/40 px-2.5 py-1.5 text-left font-mono hover:border-input hover:bg-accent/50"
            >
              <span className="text-foreground">{c.name}</span>
              <span className="text-muted-foreground"> → {c.references!.table}.{c.references!.column}</span>
            </button>
          ))}
          {incoming.map(({ table: t, column: c }) => (
            <button
              key={`${t.id}-${c.id}`}
              type="button"
              onClick={() => actions.onSelectTable(t.id)}
              className="block w-full truncate rounded-md border bg-background/40 px-2.5 py-1.5 text-left font-mono hover:border-input hover:bg-accent/50"
            >
              <span className="text-muted-foreground">{t.name}.{c.name} → </span>
              <span className="text-foreground">{c.references!.column}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
