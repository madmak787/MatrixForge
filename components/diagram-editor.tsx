'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Database, FileUp, PanelRightOpen, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Header } from './header'
import { Sidebar, InspectorActions } from './sidebar'
import { Canvas, CanvasHandle } from './canvas'
import { MatrixBackground } from './matrix-background'
import { ExportDialog, ExportTab } from './export-dialog'
import { ImportDialog } from './import-dialog'
import { HelpModal } from './help-modal'
import { ProjectSwitcher } from './project-switcher'
import { SearchDialog } from './search-dialog'
import { NameDialog, NameRequest } from './name-dialog'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Toaster } from '@/components/ui/sonner'
import { useIsMobile } from '@/hooks/use-mobile'
import { useSchemaHistory } from '@/hooks/use-schema-history'
import { Column, Project, Table } from '@/lib/types'
import { ProjectStorage } from '@/lib/storage'
import { TEMPLATES, buildTemplate } from '@/lib/templates'
import { TABLE_COLORS } from '@/lib/colors'
import {
  NODE_WIDTH,
  autoLayout,
  deleteColumn as removeColumn,
  deleteTable as removeTable,
  diagramBounds,
  renameColumn as cascadeRenameColumn,
  renameTable as cascadeRenameTable,
  uid,
  uniqueName,
} from '@/lib/schema'

const SAVE_DELAY_MS = 300

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
}

function updateTableIn(tables: Table[], tableId: string, fn: (t: Table) => Table) {
  return tables.map(t => (t.id === tableId ? fn(t) : t))
}

export function DiagramEditor() {
  const [projects, setProjects] = useState<Project[]>([])
  const [project, setProject] = useState<Project | null>(null)
  const { tables, version, canUndo, canRedo, reset, commit, begin, preview, end, undo, redo } = useSchemaHistory()

  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [exportTab, setExportTab] = useState<ExportTab | null>(null)
  const [lastExportTab, setLastExportTab] = useState<ExportTab>('sql')
  const [showImport, setShowImport] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [nameRequest, setNameRequest] = useState<NameRequest | null>(null)

  const canvasRef = useRef<CanvasHandle>(null)
  const isMobile = useIsMobile()
  const tablesRef = useRef(tables)
  tablesRef.current = tables

  const refreshProjects = useCallback(() => setProjects(ProjectStorage.getRecentProjects()), [])

  const projectRef = useRef(project)
  projectRef.current = project
  const dirty = useRef(false)

  // Write pending edits right away, e.g. before switching to another project
  const flush = useCallback(() => {
    if (dirty.current && projectRef.current) ProjectStorage.updateProject(projectRef.current.id, { tables: tablesRef.current })
    dirty.current = false
  }, [])

  const openProject = useCallback(
    (p: Project, fit = true) => {
      flush()
      ProjectStorage.setCurrentProject(p.id)
      setProject(p)
      reset(p.tables)
      setSelectedTable(null)
      setSelectedColumn(null)
      refreshProjects()
      if (fit) requestAnimationFrame(() => canvasRef.current?.fitView())
    },
    [flush, reset, refreshProjects],
  )

  // Load the last project, falling back to the most recent one or a new one
  useEffect(() => {
    const all = ProjectStorage.getRecentProjects()
    const currentId = ProjectStorage.getCurrentProject()
    const current = all.find(p => p.id === currentId) || all[0]
    if (current) {
      openProject(current)
    } else {
      const ecommerce = TEMPLATES[0]
      openProject(ProjectStorage.createProject('My first schema', ecommerce.description, buildTemplate(ecommerce)))
      setShowHelp(true)
    }
  }, [openProject])

  // Save edits (not loads) shortly after they happen
  const loadedVersion = useRef(version)
  const saveWarned = useRef(false)
  useEffect(() => {
    if (!project) return
    if (loadedVersion.current !== version) {
      loadedVersion.current = version
      return
    }
    dirty.current = true
    const timer = setTimeout(() => {
      dirty.current = false
      const ok = ProjectStorage.updateProject(project.id, { tables })
      if (!ok && !saveWarned.current) {
        saveWarned.current = true
        toast.error('This browser is not letting MatrixForge save. Export JSON to keep a copy of your work.')
      }
      refreshProjects()
    }, SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [tables, version, project, refreshProjects])

  useEffect(() => {
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [flush])

  // Keep the selection valid after undo, redo and deletes
  useEffect(() => {
    if (selectedTable && !tables.some(t => t.id === selectedTable)) {
      setSelectedTable(null)
      setSelectedColumn(null)
    }
  }, [tables, selectedTable])

  // ---------------------------------------------------------------------------
  // Table and column edits
  // ---------------------------------------------------------------------------

  const selectedTableRef = useRef(selectedTable)
  selectedTableRef.current = selectedTable
  // Clicking a table keeps its open column; clicking another table or a column changes it
  const select = useCallback((tableId: string | null, columnId?: string) => {
    if (columnId !== undefined || tableId !== selectedTableRef.current) setSelectedColumn(columnId ?? null)
    setSelectedTable(tableId)
  }, [])

  const selectTableFresh = useCallback((tableId: string | null, columnId?: string) => {
    setSelectedTable(tableId)
    setSelectedColumn(columnId ?? null)
  }, [])

  const addTable = useCallback(
    (position?: { x: number; y: number }) => {
      const current = tablesRef.current
      const center = canvasRef.current?.viewportCenter() || { x: 200, y: 200 }
      const pos = position || { x: Math.round(center.x - NODE_WIDTH / 2), y: Math.round(center.y - 80) }
      // Nudge new tables so repeated clicks do not stack exactly on top of each other
      while (!position && current.some(t => Math.abs(t.position.x - pos.x) < 20 && Math.abs(t.position.y - pos.y) < 20)) {
        pos.x += 30
        pos.y += 30
      }
      const table: Table = {
        id: uid('table'),
        name: uniqueName('new_table', current.map(t => t.name)),
        columns: [{ id: uid('col'), name: 'id', type: 'INT', isPrimaryKey: true, isNullable: false, isAutoIncrement: true }],
        position: pos,
        color: TABLE_COLORS[current.length % TABLE_COLORS.length].name,
      }
      commit(ts => [...ts, table])
      setSelectedTable(table.id)
      setSelectedColumn(null)
      if (isMobile) setInspectorOpen(true)
      else requestAnimationFrame(() => document.getElementById('table-name')?.focus())
    },
    [commit, isMobile],
  )

  const deleteTable = useCallback(
    (tableId: string) => {
      const table = tablesRef.current.find(t => t.id === tableId)
      if (!table) return
      commit(ts => removeTable(ts, tableId))
      toast(`Deleted ${table.name}`, { action: { label: 'Undo', onClick: undo } })
    },
    [commit, undo],
  )

  const duplicateTable = useCallback(
    (tableId: string) => {
      const table = tablesRef.current.find(t => t.id === tableId)
      if (!table) return
      const copy: Table = {
        ...structuredClone(table),
        id: uid('table'),
        name: uniqueName(`${table.name}_copy`, tablesRef.current.map(t => t.name)),
        position: { x: table.position.x + 40, y: table.position.y + 40 },
      }
      copy.columns = copy.columns.map(c => ({ ...c, id: uid('col') }))
      commit(ts => [...ts, copy])
      setSelectedTable(copy.id)
      setSelectedColumn(null)
    },
    [commit],
  )

  const actions: InspectorActions = useMemo(
    () => ({
      onRenameTable: (tableId, name) => commit(ts => cascadeRenameTable(ts, tableId, name), `tname-${tableId}`),
      onUpdateTable: (tableId, updates, mergeKey) => commit(ts => updateTableIn(ts, tableId, t => ({ ...t, ...updates })), mergeKey),
      onAddColumn: tableId => {
        const table = tablesRef.current.find(t => t.id === tableId)
        if (!table) return
        const column: Column = {
          id: uid('col'),
          name: uniqueName('column', table.columns.map(c => c.name)),
          type: 'VARCHAR',
          isPrimaryKey: false,
          isNullable: true,
        }
        commit(ts => updateTableIn(ts, tableId, t => ({ ...t, columns: [...t.columns, column] })))
        setSelectedColumn(column.id)
        requestAnimationFrame(() => {
          const input = document.getElementById(`col-name-${column.id}`) as HTMLInputElement | null
          input?.focus()
          input?.select()
        })
      },
      onUpdateColumn: (tableId, columnId, updates, mergeKey) =>
        commit(
          ts => updateTableIn(ts, tableId, t => ({ ...t, columns: t.columns.map(c => (c.id === columnId ? { ...c, ...updates } : c)) })),
          mergeKey,
        ),
      onRenameColumn: (tableId, columnId, name) => commit(ts => cascadeRenameColumn(ts, tableId, columnId, name), `cname-${columnId}`),
      onDeleteColumn: (tableId, columnId) => commit(ts => removeColumn(ts, tableId, columnId)),
      onMoveColumn: (tableId, columnId, direction) =>
        commit(ts =>
          updateTableIn(ts, tableId, t => {
            const i = t.columns.findIndex(c => c.id === columnId)
            const j = i + direction
            if (i === -1 || j < 0 || j >= t.columns.length) return t
            const columns = [...t.columns]
            ;[columns[i], columns[j]] = [columns[j], columns[i]]
            return { ...t, columns }
          }),
        ),
      onAddRelation: (tableId, targetId) => {
        const table = tablesRef.current.find(t => t.id === tableId)
        const target = tablesRef.current.find(t => t.id === targetId)
        if (!table || !target) return
        const pk = target.columns.find(c => c.isPrimaryKey) || target.columns[0]
        if (!pk) {
          toast.error(`${target.name} has no columns to reference`)
          return
        }
        const singular = target.name.replace(/ies$/, 'y').replace(/(?<!s)s$/, '')
        const column: Column = {
          id: uid('col'),
          name: uniqueName(`${singular}_${pk.name}`, table.columns.map(c => c.name)),
          type: pk.type,
          length: pk.length,
          isPrimaryKey: false,
          isNullable: false,
          isForeignKey: true,
          isIndexed: true,
          references: { table: target.name, column: pk.name },
        }
        commit(ts => updateTableIn(ts, tableId, t => ({ ...t, columns: [...t.columns, column] })))
        setSelectedColumn(column.id)
      },
      onDuplicateTable: duplicateTable,
      onDeleteTable: deleteTable,
      onSelectColumn: columnId => setSelectedColumn(columnId),
      onSelectTable: tableId => {
        selectTableFresh(tableId)
        canvasRef.current?.focusTable(tableId)
      },
    }),
    [commit, deleteTable, duplicateTable, selectTableFresh],
  )

  const moveTable = useCallback(
    (tableId: string, position: { x: number; y: number }) =>
      preview(ts => updateTableIn(ts, tableId, t => (t.position.x === position.x && t.position.y === position.y ? t : { ...t, position }))),
    [preview],
  )

  // ---------------------------------------------------------------------------
  // Projects
  // ---------------------------------------------------------------------------

  const createProject = (name: string, projectTables: Table[] = []) => {
    openProject(ProjectStorage.createProject(name, undefined, projectTables))
  }

  const loadTemplate = (templateId: string) => {
    const template = TEMPLATES.find(t => t.id === templateId)
    if (!template) return
    createProject(`${template.name} schema`, buildTemplate(template))
    toast.success(`Opened the ${template.name} template as a new project`)
  }

  const importTables = (imported: Table[], mode: 'new' | 'merge', name: string, warnings: string[]) => {
    if (mode === 'new') {
      createProject(uniqueName(name, projects.map(p => p.name)), imported)
    } else {
      const taken = tablesRef.current.map(t => t.name)
      // Rename clashing tables and place the import below the existing diagram
      const renames = new Map<string, string>()
      for (const t of imported) {
        const name = uniqueName(t.name, [...taken, ...renames.values()])
        if (name !== t.name) renames.set(t.name, name)
        taken.push(name)
      }
      const bottom = diagramBounds(tablesRef.current)
      const placed = autoLayout(imported, { x: bottom?.x ?? 80, y: bottom ? bottom.y + bottom.height + 120 : 80 }).map(t => ({
        ...t,
        name: renames.get(t.name) || t.name,
        columns: t.columns.map(c =>
          c.references && renames.has(c.references.table) ? { ...c, references: { ...c.references, table: renames.get(c.references.table)! } } : c,
        ),
      }))
      commit(ts => [...ts, ...placed])
      requestAnimationFrame(() => canvasRef.current?.fitView())
    }
    toast.success(`Imported ${imported.length} table${imported.length === 1 ? '' : 's'}`)
    if (warnings.length) toast.warning(warnings.slice(0, 3).join('\n') + (warnings.length > 3 ? `\n…and ${warnings.length - 3} more` : ''))
  }

  const deleteProject = (projectId: string) => {
    const target = projects.find(p => p.id === projectId)
    if (!target || !confirm(`Delete the project “${target.name}”? This cannot be undone.`)) return
    ProjectStorage.deleteProject(projectId)
    if (project?.id === projectId) {
      const next = ProjectStorage.getRecentProjects()[0]
      if (next) openProject(next)
      else createProject('Untitled schema')
    } else {
      refreshProjects()
    }
  }

  const renameProject = (projectId: string) => {
    const target = projects.find(p => p.id === projectId)
    if (!target) return
    setNameRequest({
      title: 'Rename project',
      initial: target.name,
      confirmLabel: 'Rename',
      onConfirm: name => {
        ProjectStorage.renameProject(projectId, name)
        if (project?.id === projectId) setProject({ ...project, name })
        refreshProjects()
      },
    })
  }

  const switchProject = (projectId: string) => {
    const next = ProjectStorage.getProject(projectId)
    if (next) openProject(next)
  }

  const openExport = useCallback((tab: ExportTab) => {
    setLastExportTab(tab)
    setExportTab(tab)
  }, [])

  const clearAll = () => {
    if (!confirm('Remove every table from this project? You can undo this.')) return
    commit(() => [])
  }

  const arrange = () => {
    commit(ts => autoLayout(ts))
    requestAnimationFrame(() => canvasRef.current?.fitView())
  }

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------------

  const dialogOpen = !!exportTab || showImport || showHelp || showSearch || !!nameRequest
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (dialogOpen) return
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()

      if (mod && key === 'k') {
        e.preventDefault()
        setShowSearch(true)
        return
      }
      if (mod && key === 'e') {
        e.preventDefault()
        if (tablesRef.current.length) openExport(lastExportTab)
        return
      }
      // Leave text editing shortcuts to the focused field
      if (isTyping(e.target)) {
        if (e.key === 'Escape') (e.target as HTMLElement).blur()
        return
      }
      if (mod && key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && key === 'y') {
        e.preventDefault()
        redo()
        return
      }
      if (mod && key === 'd' && selectedTable) {
        e.preventDefault()
        duplicateTable(selectedTable)
        return
      }
      if (mod || e.altKey) return

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedTable) {
        e.preventDefault()
        deleteTable(selectedTable)
      } else if (key === 'n') {
        e.preventDefault()
        addTable()
      } else if (key === 'f') {
        canvasRef.current?.fitView()
      } else if (e.key === '+' || e.key === '=') {
        canvasRef.current?.zoomBy(1.2)
      } else if (e.key === '-') {
        canvasRef.current?.zoomBy(1 / 1.2)
      } else if (e.key === '?') {
        setShowHelp(true)
      } else if (e.key === 'Escape') {
        selectTableFresh(null)
      } else if (e.key.startsWith('Arrow') && selectedTable) {
        e.preventDefault()
        const step = e.shiftKey ? 50 : 10
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        commit(
          ts => updateTableIn(ts, selectedTable, t => ({ ...t, position: { x: t.position.x + dx, y: t.position.y + dy } })),
          `nudge-${selectedTable}`,
        )
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dialogOpen, selectedTable, lastExportTab, undo, redo, addTable, deleteTable, duplicateTable, openExport, selectTableFresh, commit])

  if (!project) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>
  }

  const current = tables.find(t => t.id === selectedTable)
  const inspector = (
    <Sidebar
      tables={tables}
      table={current}
      selectedColumnId={selectedColumn}
      onClose={isMobile ? () => setInspectorOpen(false) : undefined}
      className="h-full"
      {...actions}
    />
  )

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      <MatrixBackground />
      <Header
        projectSwitcher={
          <ProjectSwitcher
            currentProject={project}
            projects={projects}
            onProjectChange={switchProject}
            onProjectCreate={() =>
              setNameRequest({
                title: 'New project',
                description: 'Projects are saved in this browser.',
                initial: uniqueName('Untitled schema', projects.map(p => p.name)),
                confirmLabel: 'Create',
                onConfirm: name => createProject(name),
              })
            }
            onProjectDelete={deleteProject}
            onProjectRename={renameProject}
          />
        }
        tableCount={tables.length}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onOpenSearch={() => setShowSearch(true)}
        onAddTable={() => addTable()}
        onExport={openExport}
        onImport={() => setShowImport(true)}
        onLoadTemplate={loadTemplate}
        onAutoLayout={arrange}
        onFitView={() => canvasRef.current?.fitView()}
        onClearAll={clearAll}
        onShowHelp={() => setShowHelp(true)}
      />

      <div className="relative z-10 flex min-h-0 flex-1">
        <Canvas
          ref={canvasRef}
          tables={tables}
          selectedTable={selectedTable}
          selectedColumn={selectedColumn}
          onSelect={select}
          onOpenTable={tableId => {
            selectTableFresh(tableId)
            if (isMobile) setInspectorOpen(true)
            else requestAnimationFrame(() => document.getElementById('table-name')?.focus())
          }}
          onMoveStart={begin}
          onMove={moveTable}
          onMoveEnd={end}
          onDeleteTable={deleteTable}
          onDuplicateTable={duplicateTable}
          onAddTableAt={addTable}
        >
          {tables.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div data-canvas-ui className="pointer-events-auto max-w-sm rounded-lg border border-primary/30 bg-card/90 p-6 text-center backdrop-blur-sm cyber-border">
                <p className="glow-text mb-2 text-3xl text-primary">◈</p>
                <h2 className="text-base font-semibold text-primary">Start your schema</h2>
                <p className="mb-4 mt-1 text-xs text-muted-foreground">Add a table, start from a template, or import existing SQL.</p>
                <div className="flex flex-col gap-2">
                  <Button onClick={() => addTable()}>
                    <Plus className="size-4" /> New table
                  </Button>
                  <Button variant="outline" className="border-primary/50 text-primary hover:bg-primary/20" onClick={() => loadTemplate('ecommerce')}>
                    <Database className="size-4" /> E-commerce template
                  </Button>
                  <Button variant="outline" className="border-primary/50 text-primary hover:bg-primary/20" onClick={() => setShowImport(true)}>
                    <FileUp className="size-4" /> Import SQL
                  </Button>
                </div>
              </div>
            </div>
          )}

          {isMobile && current && !inspectorOpen && (
            <Button data-canvas-ui className="absolute bottom-4 left-4 z-10 shadow-lg" onClick={() => setInspectorOpen(true)}>
              <PanelRightOpen className="size-4" /> Edit {current.name}
            </Button>
          )}
        </Canvas>

        {!isMobile && (
          <div className="w-80 shrink-0 border-l border-primary/30 bg-card/95 backdrop-blur-sm cyber-border xl:w-96">{inspector}</div>
        )}
      </div>

      {isMobile && (
        <Sheet open={inspectorOpen && !!current} onOpenChange={setInspectorOpen}>
          <SheetContent side="bottom" className="h-[75dvh] gap-0 border-primary/30 bg-card p-0 [&>button]:hidden">
            <SheetTitle className="sr-only">Edit table</SheetTitle>
            {inspector}
          </SheetContent>
        </Sheet>
      )}

      <SearchDialog
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        tables={tables}
        onSelect={(tableId, columnId) => {
          selectTableFresh(tableId, columnId)
          canvasRef.current?.focusTable(tableId)
          if (isMobile) setInspectorOpen(true)
        }}
      />
      <ExportDialog
        open={!!exportTab}
        onOpenChange={o => !o && setExportTab(null)}
        tab={exportTab || lastExportTab}
        onTabChange={openExport}
        tables={tables}
        projectName={project.name}
      />
      <ImportDialog open={showImport} onOpenChange={setShowImport} onImport={importTables} hasTables={tables.length > 0} />
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
      <NameDialog request={nameRequest} onClose={() => setNameRequest(null)} />
      <Toaster theme="dark" position="bottom-center" closeButton />
    </div>
  )
}
