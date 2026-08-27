import type { Project, Milestone, Todo } from '@/types/project'
import { SAMPLE_PROJECTS_WITH_META } from './sampleData'

const STORAGE_KEY_DATA = 'kanban_projects'
const STORAGE_KEY_MILESTONES = 'kanban_milestones'
const STORAGE_KEY_TODOS = 'kanban_todos'
const STORAGE_KEY_TOKEN = 'kanban_github_token'
const STORAGE_KEY_SOURCE = 'kanban_storage_source'

const GITHUB_PROJECTS_PATH = 'data/projects.json'
const GITHUB_MILESTONES_PATH = 'data/milestones.json'
const GITHUB_TODOS_PATH = 'data/todos.json'

// ── Milestone local storage ──

export function loadMilestones(): Milestone[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MILESTONES)
    if (!raw) return []
    return JSON.parse(raw) as Milestone[]
  } catch {
    return []
  }
}

export function saveMilestones(milestones: Milestone[]): void {
  localStorage.setItem(STORAGE_KEY_MILESTONES, JSON.stringify(milestones))
}

// ── Todo local storage ──

function loadTodos(): Todo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TODOS)
    if (!raw) return []
    return JSON.parse(raw) as Todo[]
  } catch {
    return []
  }
}

function saveTodos(todos: Todo[]): void {
  localStorage.setItem(STORAGE_KEY_TODOS, JSON.stringify(todos))
}

// ── LocalStorage (always active) ──

export function loadLocal(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DATA)
    if (!raw) return []
    return JSON.parse(raw) as Project[]
  } catch {
    return []
  }
}

export function saveLocal(projects: Project[]): void {
  localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(projects))
}

// Debug: log loaded data in production
try {
  const raw = localStorage.getItem(STORAGE_KEY_DATA)
  if (raw) {
    const data = JSON.parse(raw)
    if (Array.isArray(data)) {
      const count = data.length
      const statuses = data.map((p: any) => p.status).filter(Boolean)
      console.log(`[localStorageStore] Loaded ${count} projects. Statuses: preparation=${statuses.filter(s => s === 'preparation').length}, in_progress=${statuses.filter(s => s === 'in_progress').length}, completed=${statuses.filter(s => s === 'completed').length}, waiting=${statuses.filter(s => s === 'waiting').length}`)
    }
  }
} catch {}

// ── GitHub API ──

async function readGitHubFile(token: string, filePath: string): Promise<unknown[]> {
  try {
    const res = await fetch(`https://api.github.com/repos/PosenChen/kanban-data/contents/${filePath}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`GitHub API error for ${filePath}: ${res.status}`)
    const data: { content: string; sha: string } = await res.json()
    const bin = Uint8Array.from(atob(data.content), c => c.charCodeAt(0))
    const text = new TextDecoder('utf-8').decode(bin)
    return JSON.parse(text)
  } catch {
    return []
  }
}

async function writeGitHubFile(token: string, filePath: string, data: unknown[], sha: string = ''): Promise<void> {
  const json = JSON.stringify(data, null, 2)
  const bytes = new TextEncoder().encode(json)
  const bin = String.fromCharCode(...bytes)
  const encoded = btoa(bin)

  try {
    const res = await fetch(`https://api.github.com/repos/PosenChen/kanban-data/contents/${filePath}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' },
      signal: AbortSignal.timeout(10000),
    })
    if (res.ok) {
      const d: { sha: string } = await res.json()
      sha = d.sha
    }
  } catch { /* no file yet */ }

  await fetch(`https://api.github.com/repos/PosenChen/kanban-data/contents/${filePath}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `Update ${filePath} via Kanban board`,
      content: encoded,
      sha,
      branch: 'main',
    }),
    signal: AbortSignal.timeout(15000),
  })
}

export async function readGitHub(token: string): Promise<Project[]> {
  return readGitHubFile(token, GITHUB_PROJECTS_PATH) as Promise<Project[]>
}

export async function writeGitHub(token: string, projects: Project[], milestones: Milestone[], todos: Todo[]): Promise<void> {
  // Write projects
  await writeGitHubFile(token, GITHUB_PROJECTS_PATH, projects)
  // Write milestones
  await writeGitHubFile(token, GITHUB_MILESTONES_PATH, milestones)
  // Write todos
  await writeGitHubFile(token, GITHUB_TODOS_PATH, todos)
}

export async function readMilestonesGitHub(token: string): Promise<Milestone[]> {
  return readGitHubFile(token, GITHUB_MILESTONES_PATH) as Promise<Milestone[]>
}

export async function readTodosGitHub(token: string): Promise<Todo[]> {
  return readGitHubFile(token, GITHUB_TODOS_PATH) as Promise<Todo[]>
}

// ── Unified store ──

let cached: Project[] = []
let milestones: Milestone[] = []
let todos: Todo[] = []

// Load milestones
milestones = loadMilestones()
// Load todos
todos = loadTodos()

// Start with LocalStorage only — no auto GitHub load
cached = loadLocal()
if (cached.length === 0) {
  cached = SAMPLE_PROJECTS_WITH_META
  saveLocal(cached)
}

// Migrate: convert any project with status='milestone' to milestone objects
// Note: use string comparison since 'milestone' is no longer a ProjectStatus value
cached.forEach(p => {
  if ((p as any).status === 'milestone') {
    milestones.push({
      id: p.id,
      name: p.name,
      date: p.start_date,
      tags: p.tags,
      created_at: p.created_at,
      updated_at: p.updated_at,
    })
    // Remove milestone project from cached projects
    cached = cached.filter(c => c.id !== p.id)
  }
})

// Clean up any remaining milestone-status projects (second pass)
cached = cached.filter(p => (p as any).status !== 'milestone')

// ── Migration: ensure sort_order is sequential per sibling group ──
// Group by parent_id and assign sequential sort_order 0..N-1 so there are
// no missing or DUPLICATE values (duplicates break reorder swaps).

// Helper: rebuild sequential sort_order for a list of items, only writing
// back when the current values are non-sequential (missing/null/duplicate).
function resequence<T extends { id: string; sort_order?: number | null; updated_at: string }>(
  items: T[],
  write: (list: T[]) => void,
): T[] {
  const sorted = [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  // Check if current sequence is already a strict 0..N-1
  let clean = true
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].sort_order !== i) { clean = false; break }
  }
  if (clean) return items
  const updated: T[] = sorted.map((it, i) => ({
    ...it,
    sort_order: i,
    updated_at: new Date().toISOString(),
  }))
  write(updated)
  return updated
}

// Re-sequence projects per sibling group (parent_id)
const projectsByParent = new Map<string | null, Project[]>()
cached.forEach(p => {
  const key = p.parent_id ?? '__ROOT__'
  const arr = projectsByParent.get(key) || []
  arr.push(p)
  projectsByParent.set(key, arr)
})
projectsByParent.forEach((arr, key) => {
  const fixed = resequence(arr, (list) => {
    cached = [...cached]
    for (const item of list) {
      const idx = cached.findIndex(c => c.id === item.id)
      if (idx !== -1) cached[idx] = item as unknown as Project
    }
    saveLocal(cached)
  })
  // push back into cached by reference
  for (const item of fixed) {
    const idx = cached.findIndex(c => c.id === item.id)
    if (idx !== -1) cached[idx] = item as unknown as Project
  }
})

// Re-sequence todos globally (todos have no parent)
{
  const fixed = resequence(todos, (list) => {
    todos = [...list]
    saveTodos(todos)
  })
  todos = [...fixed]
  saveTodos(todos)
}

saveLocal(cached)
saveTodos(todos)

function emitProjectChange() {
  window.dispatchEvent(new CustomEvent('kanban:data-change', { detail: cached }))
}

function emitProjectCopied(projectId: string) {
  window.dispatchEvent(new CustomEvent('kanban:project-copied', { detail: projectId }))
}

function emitMilestoneChange() {
  window.dispatchEvent(new CustomEvent('kanban:milestone-change', { detail: milestones }))
}

function emitTodoChange() {
  window.dispatchEvent(new CustomEvent('kanban:todo-change', { detail: todos }))
}

export const projectStore = {
  getAll(): Project[] {
    return cached
  },

  getById(id: string): Project | undefined {
    return cached.find(p => p.id === id)
  },

  getByParent(parentId: string | null): Project[] {
    return cached.filter(p => p.parent_id === parentId)
  },

  getByDate(date: string): Project[] {
    return cached.filter(p => p.start_date <= date && p.end_date >= date)
  },

  getByTag(tag: string): Project[] {
    return cached.filter(p => p.tags.includes(tag))
  },

  search(query: string): Project[] {
    const q = query.toLowerCase()
    return cached.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q)),
    )
  },

  filter(status?: string, priority?: string): Project[] {
    return cached.filter(p => {
      if (status && p.status !== status) return false
      if (priority && p.priority !== priority) return false
      return true
    })
  },

  add(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Project {
    const now = new Date().toISOString()
    const sortOrder = cached.filter(p => p.parent_id === project.parent_id).length
    const newProject: Project = {
      ...project,
      sort_order: sortOrder,
      id: `p${Date.now().toString(36)}`,
      created_at: now,
      updated_at: now,
      actual_start_date: undefined,
      actual_end_date: undefined,
    }
    cached = [...cached, newProject]
    saveLocal(cached)
    emitProjectChange()
    return newProject
  },

  update(id: string, updates: Partial<Project>): Project | undefined {
    const idx = cached.findIndex(p => p.id === id)
    if (idx === -1) return undefined
    const updated = { ...cached[idx], ...updates, updated_at: new Date().toISOString() }
    cached[idx] = updated
    saveLocal(cached)
    emitProjectChange()
    return updated
  },

  remove(id: string): boolean {
    // Check milestones first
    const mIdx = milestones.findIndex(m => m.id === id)
    if (mIdx !== -1) {
      milestones = milestones.filter(m => m.id !== id)
      saveMilestones(milestones)
      emitMilestoneChange()
      return true
    }
    // Then projects
    const idx = cached.findIndex(p => p.id === id)
    if (idx === -1) return false
    cached = cached.filter(p => p.id !== id)
    saveLocal(cached)
    emitProjectChange()
    return true
  },

  getChildren(projectId: string): Project[] {
    return cached.filter(p => p.parent_id === projectId)
  },

  /** Deep copy a project and all its children recursively, appending 'Q' to names */
  copyProject(parentId: string): { project: Project; childCount: number } | null {
    const source = cached.find(p => p.id === parentId)
    if (!source) return null
    const now = new Date().toISOString()

    // Determine new sort_order: append after all root projects (or children of same parent)
    const sameParent = cached.filter(p => p.parent_id === source.parent_id)
    const newSortOrder = sameParent.length

    // Create new project with Q suffix
    const newProject: Project = {
      ...source,
      sort_order: newSortOrder,
      id: `p${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`,
      name: source.name + 'Q',
      created_at: now,
      updated_at: now,
      actual_start_date: undefined,
      actual_end_date: undefined,
    }
    cached = [...cached, newProject]

    // Recursively copy children with sequential sort_order
    let childCount = 0
    let childOrder = 0
    const copyChildren = (childParentId: string, newParentId: string) => {
      const children = cached.filter(p => p.parent_id === childParentId)
      for (const child of children) {
        childCount++
        const newChild: Project = {
          ...child,
          sort_order: childOrder++,
          id: `p${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`,
          name: child.name + 'Q',
          parent_id: newParentId,
          created_at: now,
          updated_at: now,
          actual_start_date: undefined,
          actual_end_date: undefined,
        }
        cached = [...cached, newChild]
        copyChildren(child.id, newChild.id)
      }
    }
    copyChildren(parentId, newProject.id)

    saveLocal(cached)
    emitProjectChange()
    emitProjectCopied(newProject.id)
    return { project: newProject, childCount }
  },

  // ── Project reordering (sort_order) ──
  // Move the given project up one slot within its sibling group (same parent_id).
  // This works even if sort_order values are duplicated/missing: we re-sort the
  // sibling list to the target order, then reassign sequential sort_orders 0..N-1.
  moveProjectUp(parentId: string | null, projectId: string): Project | undefined {
    const siblings = cached.filter(p => p.parent_id === parentId)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    if (siblings.length <= 1) return undefined
    const idx = siblings.findIndex(p => p.id === projectId)
    if (idx <= 0) return undefined
    // Swap positions in the sibling list
    ;[siblings[idx - 1], siblings[idx]] = [siblings[idx], siblings[idx - 1]]
    // Reassign sequential sort_orders and write back to cached
    const updated: Project[] = []
    siblings.forEach((sib, i) => {
      const sIdx = cached.findIndex(p => p.id === sib.id)
      if (sIdx !== -1) {
        const obj = { ...cached[sIdx], sort_order: i, updated_at: new Date().toISOString() }
        cached[sIdx] = obj
        updated.push(obj)
      }
    })
    if (updated.length === 0) return undefined
    saveLocal(cached)
    emitProjectChange()
    return updated[0]
  },

  // Move the given project down one slot within its sibling group.
  moveProjectDown(parentId: string | null, projectId: string): Project | undefined {
    const siblings = cached.filter(p => p.parent_id === parentId)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    if (siblings.length <= 1) return undefined
    const idx = siblings.findIndex(p => p.id === projectId)
    if (idx >= siblings.length - 1) return undefined
    // Swap positions in the sibling list
    ;[siblings[idx], siblings[idx + 1]] = [siblings[idx + 1], siblings[idx]]
    // Reassign sequential sort_orders and write back to cached
    const updated: Project[] = []
    siblings.forEach((sib, i) => {
      const sIdx = cached.findIndex(p => p.id === sib.id)
      if (sIdx !== -1) {
        const obj = { ...cached[sIdx], sort_order: i, updated_at: new Date().toISOString() }
        cached[sIdx] = obj
        updated.push(obj)
      }
    })
    if (updated.length === 0) return undefined
    saveLocal(cached)
    emitProjectChange()
    return updated[0]
  },

  // Move a todo up one slot. Reorders the array and reassigns sequential sort_orders.
  moveTodoUp(todoId: string): Todo | undefined {
    const sorted = [...todos].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    if (sorted.length <= 1) return undefined
    const idx = sorted.findIndex(t => t.id === todoId)
    if (idx <= 0) return undefined
    // Swap positions
    ;[sorted[idx - 1], sorted[idx]] = [sorted[idx], sorted[idx - 1]]
    // Reassign sequential sort_orders
    const updated: Todo[] = sorted.map((t, i) => {
      const tIdx = todos.findIndex(x => x.id === t.id)
      if (tIdx === -1) return t
      const obj = { ...t, sort_order: i, updated_at: new Date().toISOString() }
      todos[tIdx] = obj
      return obj
    })
    saveTodos(todos)
    emitTodoChange()
    return updated[idx]
  },

  // Move a todo down one slot. Reorders the array and reassigns sequential sort_orders.
  moveTodoDown(todoId: string): Todo | undefined {
    const sorted = [...todos].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    if (sorted.length <= 1) return undefined
    const idx = sorted.findIndex(t => t.id === todoId)
    if (idx >= sorted.length - 1) return undefined
    // Swap positions
    ;[sorted[idx], sorted[idx + 1]] = [sorted[idx + 1], sorted[idx]]
    // Reassign sequential sort_orders
    const updated: Todo[] = sorted.map((t, i) => {
      const tIdx = todos.findIndex(x => x.id === t.id)
      if (tIdx === -1) return t
      const obj = { ...t, sort_order: i, updated_at: new Date().toISOString() }
      todos[tIdx] = obj
      return obj
    })
    saveTodos(todos)
    emitTodoChange()
    return updated[idx]
  },

  getRootProjects(): Project[] {
    return cached.filter(p => p.parent_id === null)
  },

  // ── Milestone CRUD ──

  addMilestone(data: Omit<Milestone, 'id' | 'created_at' | 'updated_at'>): Milestone {
    const now = new Date().toISOString()
    const newMilestone: Milestone = {
      ...data,
      id: `m${Date.now().toString(36)}`,
      created_at: now,
      updated_at: now,
    }
    milestones = [...milestones, newMilestone]
    saveMilestones(milestones)
    emitMilestoneChange()
    return newMilestone
  },

  getMilestones(): Milestone[] {
    return milestones
  },

  getMilestoneById(id: string): Milestone | undefined {
    return milestones.find(m => m.id === id)
  },

  updateMilestone(id: string, updates: Partial<Milestone>): Milestone | undefined {
    const idx = milestones.findIndex(m => m.id === id)
    if (idx === -1) return undefined
    const updated = { ...milestones[idx], ...updates, updated_at: new Date().toISOString() }
    milestones[idx] = updated
    saveMilestones(milestones)
    emitMilestoneChange()
    return updated
  },

  removeMilestone(id: string): boolean {
    const idx = milestones.findIndex(m => m.id === id)
    if (idx === -1) return false
    milestones = milestones.filter(m => m.id !== id)
    saveMilestones(milestones)
    emitMilestoneChange()
    return true
  },

  // ── Todo CRUD ──

  addTodo(data: Omit<Todo, 'id' | 'created_at' | 'updated_at' | 'sort_order'>): Todo {
    const now = new Date().toISOString()
    const sortOrder = todos.length
    const newTodo: Todo = {
      ...data,
      sort_order: sortOrder,
      id: `t${Date.now().toString(36)}`,
      created_at: now,
      updated_at: now,
    }
    todos = [...todos, newTodo]
    saveTodos(todos)
    emitTodoChange()
    return newTodo
  },

  getTodos(): Todo[] {
    return todos
  },

  updateTodo(id: string, updates: Partial<Todo>): Todo | undefined {
    const idx = todos.findIndex(t => t.id === id)
    if (idx === -1) return undefined
    const updated = { ...todos[idx], ...updates, updated_at: new Date().toISOString() }
    todos[idx] = updated
    saveTodos(todos)
    emitTodoChange()
    return updated
  },

  removeTodo(id: string): boolean {
    const idx = todos.findIndex(t => t.id === id)
    if (idx === -1) return false
    todos = todos.filter(t => t.id !== id)
    saveTodos(todos)
    emitTodoChange()
    return true
  },

  // 📥 手動從 GitHub 讀取資料
  async loadFromGitHub(token: string): Promise<Project[]> {
    const projects = await readGitHub(token)
    const loadedMilestones = await readMilestonesGitHub(token)

    if (projects.length > 0 || loadedMilestones.length > 0) {
      // Migrate milestone-status projects to activities
      const newProjects: Project[] = []
      for (const p of projects) {
        if ((p as any).status === 'milestone') {
          milestones.push({
            id: p.id,
            name: p.name,
            date: p.start_date,
            tags: p.tags,
            created_at: p.created_at,
            updated_at: p.updated_at,
          })
          saveMilestones(milestones)
        } else {
          const proj: Project = { ...p }
          // Remove 'milestone' status if present (legacy migration) — keep original status
          if ((proj as any).status === 'milestone') {
            proj.status = 'preparation' as any
          }
          newProjects.push(proj)
        }
      }
      cached = newProjects
      // Merge loaded milestones (don't duplicate IDs)
      const existingIds = new Set(milestones.map(m => m.id))
      for (const m of loadedMilestones) {
        if (!existingIds.has(m.id)) {
          milestones.push(m)
        }
      }
      saveMilestones(milestones)
      emitMilestoneChange()

      // Load todos from GitHub
      const loadedTodos = await readTodosGitHub(token)
      const existingTodoIds = new Set(todos.map(t => t.id))
      for (const t of loadedTodos) {
        if (!existingTodoIds.has(t.id)) {
          todos.push(t)
        }
      }
      saveTodos(todos)
      emitTodoChange()

      emitProjectChange()
      setStorageSource('github')
      return cached
    }
    // Also try loading todos even if no projects
    const loadedTodos2 = await readTodosGitHub(token)
    if (loadedTodos2.length > 0) {
      const existingTodoIds2 = new Set(todos.map(t => t.id))
      for (const t of loadedTodos2) {
        if (!existingTodoIds2.has(t.id)) {
          todos.push(t)
        }
      }
      saveTodos(todos)
      emitTodoChange()
      setStorageSource('github')
    }
    return []
  },

  sync() {
    cached = loadLocal()
    milestones = loadMilestones()
    todos = loadTodos()
    emitProjectChange()
    emitMilestoneChange()
    emitTodoChange()
  },
}

// Cross-tab sync
window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY_DATA) {
    projectStore.sync()
  }
  if (e.key === STORAGE_KEY_MILESTONES) {
    milestones = loadMilestones()
    emitMilestoneChange()
  }
  if (e.key === STORAGE_KEY_TODOS) {
    todos = loadTodos()
    emitTodoChange()
  }
})

// ── GitHub sync (debounced 3s) ──

let syncTimer: ReturnType<typeof setTimeout> | null = null

export function scheduleGitHubSync(token: string | null, force: boolean = false) {
  if (!token || token.trim() === '') return
  if (syncTimer && !force) clearTimeout(syncTimer)

  syncTimer = setTimeout(async () => {
    try {
      await writeGitHub(token.trim(), cached, milestones, todos)
      console.log('✅ Synced to GitHub')
    } catch (err: unknown) {
      console.warn('GitHub sync failed:', err)
    }
  }, force ? 0 : 3000)
}

export function getStorageSource(): 'local' | 'github' {
  return (localStorage.getItem(STORAGE_KEY_SOURCE) as 'local' | 'github') || 'local'
}

export function setStorageSource(source: 'local' | 'github'): void {
  localStorage.setItem(STORAGE_KEY_SOURCE, source)
}

export function getSyncStatus(): { hasToken: boolean } {
  const token = localStorage.getItem(STORAGE_KEY_TOKEN) || ''
  return { hasToken: token.trim().length >= 10 }
}
