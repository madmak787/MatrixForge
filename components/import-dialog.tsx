'use client'

import { useRef, useState } from 'react'
import { FileUp, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table } from '@/lib/types'
import { ImportResult, parseJSON, parseSQL } from '@/lib/sql-import'

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** mode "new" opens a new project, "merge" adds the tables to the current one */
  onImport: (tables: Table[], mode: 'new' | 'merge', name: string, warnings: string[]) => void
  hasTables: boolean
}

const SAMPLE = `CREATE TABLE authors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL
);

CREATE TABLE books (
  id SERIAL PRIMARY KEY,
  author_id INT NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  published_on DATE
);`

function parse(text: string): ImportResult {
  const trimmed = text.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return parseJSON(trimmed)
  return parseSQL(trimmed)
}

export function ImportDialog({ open, onOpenChange, onImport, hasTables }: ImportDialogProps) {
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setText('')
    setFileName(null)
    setError(null)
  }

  const submit = (mode: 'new' | 'merge') => {
    try {
      const result = parse(text)
      if (result.tables.length === 0) {
        setError(result.warnings[0] || 'Nothing to import')
        return
      }
      let name = fileName?.replace(/\.(sql|json|txt)$/i, '').replace(/\.matrixforge$/i, '') || 'Imported schema'
      try {
        const data = JSON.parse(text)
        if (typeof data?.name === 'string' && data.name.trim()) name = data.name.trim()
      } catch {}
      onImport(result.tables, mode, name, result.warnings)
      reset()
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? `Could not read this input: ${e.message}` : 'Could not read this input')
    }
  }

  const loadFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setError('That file is larger than 5 MB')
      return
    }
    setText(await file.text())
    setFileName(file.name)
    setError(null)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={o => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="flex max-h-[90dvh] flex-col border-primary/30 bg-card sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="glow-text text-primary">Import</DialogTitle>
          <DialogDescription>
            Paste <b>CREATE TABLE</b> statements (MySQL, PostgreSQL or SQLite) or a MatrixForge JSON export. Nothing leaves your browser.
          </DialogDescription>
        </DialogHeader>

        <div
          className="flex min-h-0 flex-1 flex-col gap-2"
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            const file = e.dataTransfer.files[0]
            if (file) loadFile(file)
          }}
        >
          <textarea
            value={text}
            onChange={e => {
              setText(e.target.value)
              setError(null)
            }}
            placeholder={SAMPLE}
            spellCheck={false}
            className="min-h-56 flex-1 resize-none rounded-md border border-primary/30 bg-background/60 p-3 font-mono text-xs leading-relaxed outline-none placeholder:text-muted-foreground/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            aria-label="SQL or JSON to import"
          />
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <input
              ref={fileRef}
              type="file"
              accept=".sql,.json,.txt,application/json,application/sql,text/plain"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) loadFile(file)
                e.target.value = ''
              }}
            />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="border-primary/40 text-primary hover:bg-primary/15">
              <FileUp className="size-4" />
              Choose file
            </Button>
            <span className="truncate">{fileName ? fileName : 'or drop a .sql / .json file here'}</span>
          </div>
          {error && (
            <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          {hasTables && (
            <Button variant="outline" disabled={!text.trim()} onClick={() => submit('merge')} className="border-primary/50 text-primary hover:bg-primary/20">
              Add to this project
            </Button>
          )}
          <Button disabled={!text.trim()} onClick={() => submit('new')}>
            Open as new project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
