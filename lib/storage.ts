import { Project } from './types'
import { normalizeTables } from './schema'

const PROJECTS_KEY = 'matrixforge-projects'
const CURRENT_PROJECT_KEY = 'matrixforge-current-project'
// Earlier versions kept undo history in localStorage; it is session-only now
const LEGACY_HISTORY_PREFIX = 'matrixforge-history-'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null): boolean {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
    return true
  } catch {
    // Private mode or quota exceeded: keep working in memory
    return false
  }
}

function normalizeProject(raw: any): Project | null {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string') return null
  return {
    id: raw.id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : 'Untitled',
    description: typeof raw.description === 'string' ? raw.description : undefined,
    createdAt: Number(raw.createdAt) || Date.now(),
    updatedAt: Number(raw.updatedAt) || Date.now(),
    tables: normalizeTables(raw.tables),
    relationships: [],
  }
}

function saveAll(projects: Project[]) {
  return write(PROJECTS_KEY, JSON.stringify(projects))
}

export const ProjectStorage = {
  getAllProjects: (): Project[] => {
    const stored = read(PROJECTS_KEY)
    if (!stored) return []
    try {
      const parsed = JSON.parse(stored)
      return Array.isArray(parsed) ? parsed.map(normalizeProject).filter((p): p is Project => p !== null) : []
    } catch {
      return []
    }
  },

  createProject: (name: string, description?: string, tables: Project['tables'] = []): Project => {
    const now = Date.now()
    const project: Project = {
      id: `project-${now}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      description,
      createdAt: now,
      updatedAt: now,
      tables,
      relationships: [],
    }
    saveAll([...ProjectStorage.getAllProjects(), project])
    ProjectStorage.setCurrentProject(project.id)
    return project
  },

  getProject: (projectId: string): Project | null => {
    return ProjectStorage.getAllProjects().find(p => p.id === projectId) || null
  },

  /** Returns false when the browser refused to store the change */
  updateProject: (projectId: string, updates: Partial<Project>): boolean => {
    const projects = ProjectStorage.getAllProjects()
    const index = projects.findIndex(p => p.id === projectId)
    if (index === -1) return true
    projects[index] = { ...projects[index], ...updates, updatedAt: Date.now() }
    return saveAll(projects)
  },

  renameProject: (projectId: string, newName: string) => {
    ProjectStorage.updateProject(projectId, { name: newName })
  },

  deleteProject: (projectId: string) => {
    const remaining = ProjectStorage.getAllProjects().filter(p => p.id !== projectId)
    saveAll(remaining)
    if (ProjectStorage.getCurrentProject() === projectId) {
      ProjectStorage.setCurrentProject(remaining[0]?.id || null)
    }
    write(`${LEGACY_HISTORY_PREFIX}${projectId}`, null)
  },

  getCurrentProject: (): string | null => read(CURRENT_PROJECT_KEY),

  setCurrentProject: (projectId: string | null) => {
    write(CURRENT_PROJECT_KEY, projectId)
  },

  /** All projects, most recently edited first */
  getRecentProjects: (): Project[] => {
    return ProjectStorage.getAllProjects().sort((a, b) => b.updatedAt - a.updatedAt)
  },
}
