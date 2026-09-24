'use client'

import {
  Braces,
  Database,
  Download,
  FileCode2,
  FileUp,
  HelpCircle,
  Image as ImageIcon,
  LayoutGrid,
  Maximize,
  MoreVertical,
  Plus,
  Redo2,
  Search,
  Trash2,
  Undo2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TEMPLATES } from '@/lib/templates'
import type { ExportTab } from './export-dialog'

interface HeaderProps {
  projectSwitcher: React.ReactNode
  tableCount: number
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onOpenSearch: () => void
  onAddTable: () => void
  onExport: (tab: ExportTab) => void
  onImport: () => void
  onLoadTemplate: (templateId: string) => void
  onAutoLayout: () => void
  onFitView: () => void
  onClearAll: () => void
  onShowHelp: () => void
}

const iconButton = 'size-8 border-primary/40 text-primary hover:border-primary hover:bg-primary/20 disabled:opacity-40'

export function Header({
  projectSwitcher,
  tableCount,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenSearch,
  onAddTable,
  onExport,
  onImport,
  onLoadTemplate,
  onAutoLayout,
  onFitView,
  onClearAll,
  onShowHelp,
}: HeaderProps) {
  const empty = tableCount === 0

  return (
    <header className="relative z-20 border-b border-primary/30 bg-card/95 backdrop-blur-sm cyber-border">
      <div className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4">
        <a href="./" className="flex shrink-0 items-center gap-2.5" aria-label="MatrixForge home">
          <span className="flex size-9 items-center justify-center rounded border border-primary bg-primary/20 cyber-border">
            <span className="glow-text text-lg font-bold text-primary">◈</span>
          </span>
          <span className="hidden leading-tight md:block">
            <span className="glow-text block text-base font-bold text-primary">MatrixForge</span>
            <span className="block text-[10px] text-muted-foreground">{'// DATABASE ARCHITECT'}</span>
          </span>
        </a>

        <div className="flex min-w-0 items-center gap-2">
          {projectSwitcher}
          {!empty && (
            <span className="hidden shrink-0 rounded border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] text-primary lg:inline">
              {tableCount} table{tableCount === 1 ? '' : 's'}
            </span>
          )}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <Button variant="outline" size="icon" onClick={onOpenSearch} title="Search (Ctrl+K)" aria-label="Search tables" className={`${iconButton} hidden sm:inline-flex`}>
            <Search className="size-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo" className={iconButton}>
            <Undo2 className="size-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo" className={`${iconButton} hidden sm:inline-flex`}>
            <Redo2 className="size-4" />
          </Button>

          <Button variant="outline" size="sm" onClick={onAddTable} title="New table (N)" className="h-8 gap-1.5 border-primary/50 text-primary hover:border-primary hover:bg-primary/20">
            <Plus className="size-4" />
            <span className="hidden sm:inline">New table</span>
          </Button>

          <Button
            size="sm"
            onClick={() => onExport('sql')}
            disabled={empty}
            title="Export (Ctrl+E)"
            className="hidden h-8 gap-1.5 sm:inline-flex"
          >
            <Download className="size-4" />
            Export
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" title="More" aria-label="More actions" className={iconButton}>
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-[80dvh] w-60 overflow-y-auto border-primary/30 bg-card">
              <DropdownMenuItem className="sm:hidden" onSelect={onOpenSearch}>
                <Search className="size-4" /> Search
              </DropdownMenuItem>
              <DropdownMenuItem className="sm:hidden" disabled={!canRedo} onSelect={onRedo}>
                <Redo2 className="size-4" /> Redo
              </DropdownMenuItem>

              <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">Templates (open as a new project)</DropdownMenuLabel>
              {TEMPLATES.map(t => (
                <DropdownMenuItem key={t.id} onSelect={() => onLoadTemplate(t.id)} title={t.description}>
                  <Database className="size-4" /> {t.name}
                  <span className="ml-auto truncate pl-2 text-[10px] text-muted-foreground">{t.tables.length} tables</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onSelect={onImport}>
                <FileUp className="size-4" /> Import SQL or JSON…
              </DropdownMenuItem>

              <DropdownMenuSeparator className="bg-primary/20" />
              <DropdownMenuItem disabled={empty} onSelect={() => onExport('sql')}>
                <FileCode2 className="size-4" /> Export SQL
                <DropdownMenuShortcut>Ctrl E</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem disabled={empty} onSelect={() => onExport('image')}>
                <ImageIcon className="size-4" /> Export image
              </DropdownMenuItem>
              <DropdownMenuItem disabled={empty} onSelect={() => onExport('json')}>
                <Braces className="size-4" /> Export JSON
              </DropdownMenuItem>

              <DropdownMenuSeparator className="bg-primary/20" />
              <DropdownMenuItem disabled={empty} onSelect={onAutoLayout}>
                <LayoutGrid className="size-4" /> Auto-arrange tables
              </DropdownMenuItem>
              <DropdownMenuItem disabled={empty} onSelect={onFitView}>
                <Maximize className="size-4" /> Fit to screen
                <DropdownMenuShortcut>F</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem disabled={empty} variant="destructive" onSelect={onClearAll}>
                <Trash2 className="size-4" /> Clear all tables
              </DropdownMenuItem>

              <DropdownMenuSeparator className="bg-primary/20" />
              <DropdownMenuItem onSelect={onShowHelp}>
                <HelpCircle className="size-4" /> Help &amp; shortcuts
                <DropdownMenuShortcut>?</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
