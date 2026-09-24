'use client'

import { useState } from 'react'
import { Check, ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Project } from '@/lib/types'
import { cn } from '@/lib/utils'

interface ProjectSwitcherProps {
  currentProject: Project | null
  projects: Project[]
  onProjectChange: (projectId: string) => void
  onProjectCreate: () => void
  onProjectDelete: (projectId: string) => void
  onProjectRename: (projectId: string) => void
}

export function ProjectSwitcher({
  currentProject,
  projects,
  onProjectChange,
  onProjectCreate,
  onProjectDelete,
  onProjectRename,
}: ProjectSwitcherProps) {
  const [open, setOpen] = useState(false)
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 min-w-0 max-w-[46vw] gap-1.5 px-2 font-medium sm:max-w-64">
          <span className="truncate">{currentProject?.name || 'No project'}</span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Projects in this browser</DropdownMenuLabel>
        <div className="max-h-72 overflow-y-auto">
          {projects.map(project => {
            const current = currentProject?.id === project.id
            return (
              <div key={project.id} className="group flex items-center gap-0.5 pr-1">
                <DropdownMenuItem onSelect={() => onProjectChange(project.id)} className="min-w-0 flex-1 cursor-pointer text-xs">
                  <Check className={cn('size-3.5 text-primary', !current && 'invisible')} />
                  <span className="truncate">{project.name}</span>
                  <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">{project.tables.length} tables</span>
                </DropdownMenuItem>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    onProjectRename(project.id)
                  }}
                  className="rounded p-1.5 text-muted-foreground transition-opacity hover:bg-accent hover:text-foreground [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                  title="Rename project"
                  aria-label={`Rename ${project.name}`}
                >
                  <Pencil className="size-3" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    onProjectDelete(project.id)
                  }}
                  className="rounded p-1.5 text-muted-foreground transition-opacity hover:bg-destructive/15 hover:text-destructive [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                  title="Delete project"
                  aria-label={`Delete ${project.name}`}
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            )
          })}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onProjectCreate} className="cursor-pointer">
          <Plus />
          New project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
