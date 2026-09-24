'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'

interface HelpModalProps {
  isOpen: boolean
  onClose: () => void
}

const SHORTCUTS: [string, string[]][] = [
  ['New table', ['N']],
  ['Search tables', ['Ctrl', 'K']],
  ['Undo / redo', ['Ctrl', 'Z', '/', 'Ctrl', 'Shift', 'Z']],
  ['Duplicate table', ['Ctrl', 'D']],
  ['Delete table', ['Del']],
  ['Move table', ['←', '↑', '→', '↓']],
  ['Fit diagram', ['F']],
  ['Zoom', ['+', '/', '−']],
  ['Export', ['Ctrl', 'E']],
  ['Deselect', ['Esc']],
]

const STEPS = [
  ['Add tables', 'Click New table, press N, or double-click the canvas. Start from a template or import existing SQL from the menu.'],
  ['Edit', 'Select a table to edit its name, color, comment and columns in the panel. Click a column on the canvas to jump straight to it.'],
  ['Relate', 'Use “Link to…” in the panel, or tick Foreign key on a column. Lines show one (bar) and many (crow’s foot) ends.'],
  ['Move around', 'Drag headers to move tables (Alt skips grid snapping). Drag the background to pan, and Ctrl + scroll or pinch to zoom.'],
  ['Export', 'Get SQL for MySQL, PostgreSQL or SQLite, a PNG or SVG image, or a JSON backup you can import later.'],
]

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto bg-card sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>How MatrixForge works</DialogTitle>
          <DialogDescription>Design database schemas visually. Everything is saved in this browser; nothing is uploaded.</DialogDescription>
        </DialogHeader>

        <ol className="space-y-3 text-sm">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border bg-background/60 font-mono text-[11px] text-primary">{i + 1}</span>
              <div>
                <p className="font-medium">{title}</p>
                <p className="text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Keyboard shortcuts</h4>
          <dl className="grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
            {SHORTCUTS.map(([label, keys]) => (
              <div key={label} className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="flex items-center gap-1">
                  {keys.map((k, i) => (k === '/' ? <span key={i} className="text-muted-foreground">/</span> : <Kbd key={i}>{k}</Kbd>))}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-[11px] text-muted-foreground">On a Mac, use ⌘ instead of Ctrl.</p>
        </div>

        <p className="border-t pt-3 text-xs text-muted-foreground">
          Made by{' '}
          <a href="https://khanamir.me" target="_blank" rel="noopener" className="text-primary underline-offset-2 hover:underline">
            Mohd Amir Khan
          </a>{' '}
          · More free tools at{' '}
          <a href="https://tools.khanamir.me" target="_blank" rel="noopener" className="text-primary underline-offset-2 hover:underline">
            tools.khanamir.me
          </a>
        </p>
      </DialogContent>
    </Dialog>
  )
}
