'use client'

import { useMemo, useState } from 'react'
import { Check, Copy, Download, FileJson, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table } from '@/lib/types'
import { DIALECTS, Dialect, generateSQL } from '@/lib/sql'
import { buildDiagramSVG, downloadBlob, slugify, svgToPngBlob } from '@/lib/export'
import { cn } from '@/lib/utils'

export type ExportTab = 'sql' | 'image' | 'json'

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tab: ExportTab
  onTabChange: (tab: ExportTab) => void
  tables: Table[]
  projectName: string
}

const DIALECT_KEY = 'matrixforge-dialect'

export function ExportDialog({ open, onOpenChange, tab, onTabChange, tables, projectName }: ExportDialogProps) {
  const [dialect, setDialectState] = useState<Dialect>(() => {
    try {
      const saved = localStorage.getItem(DIALECT_KEY) as Dialect | null
      return saved && DIALECTS.some(d => d.value === saved) ? saved : 'mysql'
    } catch {
      return 'mysql'
    }
  })
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const slug = slugify(projectName)

  const setDialect = (d: Dialect) => {
    setDialectState(d)
    try {
      localStorage.setItem(DIALECT_KEY, d)
    } catch {}
  }

  const sql = useMemo(() => (open ? generateSQL(tables, dialect, projectName) : ''), [open, tables, dialect, projectName])
  const json = useMemo(
    () => (open ? JSON.stringify({ app: 'MatrixForge', version: 2, name: projectName, exportedAt: new Date().toISOString(), tables }, null, 2) : ''),
    [open, tables, projectName],
  )

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Copy failed. Select the text and copy it manually.')
    }
  }

  const exportImage = async (format: 'png' | 'svg') => {
    const { svg, width, height } = buildDiagramSVG(tables, projectName)
    if (format === 'svg') {
      downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${slug}.svg`)
      return
    }
    setBusy(true)
    try {
      downloadBlob(await svgToPngBlob(svg, width, height), `${slug}.png`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PNG export failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col border-primary/30 bg-card sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="glow-text text-primary">Export</DialogTitle>
          <DialogDescription>
            {tables.length} table{tables.length === 1 ? '' : 's'} from “{projectName}”
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={v => onTabChange(v as ExportTab)} className="min-h-0 flex-1">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sql">SQL</TabsTrigger>
            <TabsTrigger value="image">Image</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>

          <TabsContent value="sql" className="flex min-h-0 flex-col gap-3">
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="SQL dialect">
              {DIALECTS.map(d => (
                <button
                  key={d.value}
                  type="button"
                  role="radio"
                  aria-checked={dialect === d.value}
                  onClick={() => setDialect(d.value)}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-xs transition-colors',
                    dialect === d.value ? 'border-primary bg-primary/20 text-primary' : 'border-primary/25 text-muted-foreground hover:text-foreground',
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <pre className="max-h-[50dvh] min-h-40 overflow-auto rounded-md border border-primary/30 bg-background/60 p-4 text-xs leading-relaxed text-foreground select-text">
              {sql}
            </pre>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => copy(sql)} className="border-primary/50 text-primary hover:bg-primary/20">
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button onClick={() => downloadBlob(new Blob([sql], { type: 'application/sql' }), `${slug}-${dialect}.sql`)}>
                <Download className="size-4" />
                Download .sql
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="image" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Exports the whole diagram, whatever the current zoom, on the dark Matrix background.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button disabled={busy || tables.length === 0} onClick={() => exportImage('png')} className="h-auto flex-col gap-1 py-4">
                <ImageIcon className="size-5" />
                <span>PNG image</span>
                <span className="text-[11px] font-normal opacity-80">High resolution (2×)</span>
              </Button>
              <Button
                variant="outline"
                disabled={tables.length === 0}
                onClick={() => exportImage('svg')}
                className="h-auto flex-col gap-1 border-primary/50 py-4 text-primary hover:bg-primary/20"
              >
                <ImageIcon className="size-5" />
                <span>SVG vector</span>
                <span className="text-[11px] font-normal opacity-80">Sharp at any size, editable</span>
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="json" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A full copy of the project, including positions and colors. Import it later with <b>Import</b> to continue where you left off or share it with someone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => copy(json)} className="border-primary/50 text-primary hover:bg-primary/20">
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                Copy
              </Button>
              <Button onClick={() => downloadBlob(new Blob([json], { type: 'application/json' }), `${slug}.matrixforge.json`)}>
                <FileJson className="size-4" />
                Download .json
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
