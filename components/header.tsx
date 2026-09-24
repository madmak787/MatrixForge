'use client'

import {
  Braces,
  ChevronDown,
  Database,
  Download,
  FileCode2,
  FileUp,
  HelpCircle,
  Image as ImageIcon,
  LayoutGrid,
  Maximize,
  MoreHorizontal,
  PanelLeft,
  Plus,
  Redo2,
  Search,
  Trash2,
  Undo2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
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
import { cn } from '@/lib/utils'
import { Brand, BrandMark } from './brand'
import type { ExportTab } from './export-dialog'

interface HeaderProps {
  projectSwitcher: React.ReactNode
  tableCount: number
  canUndo: boolean
  canRedo: boolean
  explorerOpen: boolean
  onToggleExplorer: () => void
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

const toolButton = 'size-8 text-muted-foreground hover:text-foreground disabled:opacity-35'

function Divider({ className }: { className?: string }) {
  return <span className={cn('mx-1 h-5 w-px shrink-0 bg-border', className)} aria-hidden />
}

export function Header({
  projectSwitcher,
  tableCount,
  canUndo,
  canRedo,
  explorerOpen,
  onToggleExplorer,
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
    <header className="panel relative z-20 flex h-13 shrink-0 items-center gap-1 border-b px-2 sm:px-3">
      <a href="./" className="flex shrink-0 items-center rounded-md px-1.5 py-1 hover:bg-accent" aria-label="MatrixForge home">
        <Brand className="hidden md:flex" />
        <BrandMark className="md:hidden" />
      </a>

      <Divider className="hidden md:block" />

      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleExplorer}
        title={explorerOpen ? 'Hide table list' : 'Show table list'}
        aria-label="Toggle table list"
        aria-pressed={explorerOpen}
        className={cn(toolButton, 'hidden md:inline-flex', explorerOpen && 'text-foreground')}
      >
        <PanelLeft className="size-4" />
      </Button>

      <div className="min-w-0">{projectSwitcher}</div>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onOpenSearch}
          className="hidden h-8 w-56 items-center gap-2 rounded-md border bg-background/60 px-2.5 text-sm text-muted-foreground transition-colors hover:border-input hover:text-foreground lg:flex"
        >
          <Search className="size-3.5" />
          <span className="flex-1 text-left">Search schema…</span>
          <Kbd className="bg-accent">⌘K</Kbd>
        </button>
        <Button variant="ghost" size="icon" onClick={onOpenSearch} title="Search (Ctrl+K)" aria-label="Search" className={cn(toolButton, 'lg:hidden')}>
          <Search className="size-4" />
        </Button>

        <Divider className="hidden sm:block" />

        <Button variant="ghost" size="icon" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo" className={toolButton}>
          <Undo2 className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo" className={cn(toolButton, 'hidden sm:inline-flex')}>
          <Redo2 className="size-4" />
        </Button>

        <Divider className="hidden sm:block" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="hidden h-8 gap-1.5 text-muted-foreground hover:text-foreground md:inline-flex">
              <Database className="size-4" />
              Templates
              <ChevronDown className="size-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Opens as a new project</DropdownMenuLabel>
            {TEMPLATES.map(t => (
              <DropdownMenuItem key={t.id} onSelect={() => onLoadTemplate(t.id)} className="items-start gap-3 py-2">
                <Database className="mt-0.5 size-4 text-primary" />
                <span className="min-w-0">
                  <span className="block font-medium">{t.name}</span>
                  <span className="block text-xs text-muted-foreground">{t.description}</span>
                </span>
                <span className="ml-auto pt-0.5 text-[11px] tabular-nums text-muted-foreground">{t.tables.length}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" size="sm" onClick={onImport} className="hidden h-8 gap-1.5 text-muted-foreground hover:text-foreground md:inline-flex">
          <FileUp className="size-4" />
          Import
        </Button>

        <Button variant="outline" size="sm" onClick={onAddTable} title="New table (N)" className="h-8 gap-1.5 bg-transparent">
          <Plus className="size-4" />
          <span className="hidden sm:inline">Table</span>
        </Button>
        <Button size="sm" onClick={() => onExport('sql')} disabled={empty} title="Export (Ctrl+E)" className="hidden h-8 gap-1.5 font-medium sm:inline-flex">
          <Download className="size-4" />
          Export
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" title="More" aria-label="More actions" className={toolButton}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-[80dvh] w-60 overflow-y-auto">
            <div className="md:hidden">
              <DropdownMenuItem className="sm:hidden" disabled={!canRedo} onSelect={onRedo}>
                <Redo2 /> Redo
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onImport}>
                <FileUp /> Import SQL or JSON…
              </DropdownMenuItem>
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Templates</DropdownMenuLabel>
              {TEMPLATES.map(t => (
                <DropdownMenuItem key={t.id} onSelect={() => onLoadTemplate(t.id)}>
                  <Database /> {t.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </div>
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Export</DropdownMenuLabel>
            <DropdownMenuItem disabled={empty} onSelect={() => onExport('sql')}>
              <FileCode2 /> SQL script
              <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem disabled={empty} onSelect={() => onExport('image')}>
              <ImageIcon /> PNG or SVG image
            </DropdownMenuItem>
            <DropdownMenuItem disabled={empty} onSelect={() => onExport('json')}>
              <Braces /> JSON backup
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Diagram</DropdownMenuLabel>
            <DropdownMenuItem disabled={empty} onSelect={onAutoLayout}>
              <LayoutGrid /> Auto-arrange
            </DropdownMenuItem>
            <DropdownMenuItem disabled={empty} onSelect={onFitView}>
              <Maximize /> Fit to screen
              <DropdownMenuShortcut>F</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem disabled={empty} variant="destructive" onSelect={onClearAll}>
              <Trash2 /> Clear all tables
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onShowHelp}>
              <HelpCircle /> Help &amp; shortcuts
              <DropdownMenuShortcut>?</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
