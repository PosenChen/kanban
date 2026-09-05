import type { Project, Milestone, Todo, Routine, LedgerEntry, Memo, Topic, TopicStatus } from '@/types/project'
import { SAMPLE_PROJECTS_WITH_META } from './sampleData'
import { dateToStr, formatDate } from '@/utils/dateUtils'
import { remapAndShift, type ProjectTemplate } from '@/utils/exportUtils'
import { isItemArchivable, selectArchivableGroups, type GroupNode } from '@/utils/archiveUtils'
import { reorderToSlot } from '@/utils/reorderUtils'
import { shouldSkipEmptyUpload } from '@/utils/syncGuardUtils'
import { todayTopic, claimTopic, releaseTopic, completeTopic, swapPoolOrder, reorderPoolAfterRemove } from '@/utils/topicUtils'

const STORAGE_KEY_DATA = 'kanban_projects'
const STORAGE_KEY_MILESTONES = 'kanban_milestones'
const STORAGE_KEY_TODOS = 'kanban_todos'
const STORAGE_KEY_TOKEN = 'kanban_github_token'
const STORAGE_KEY_SOURCE = 'kanban_storage_source'
const STORAGE_KEY_ROUTINES = 'kanban_routines'
const STORAGE_KEY_LEDGER = 'kanban_ledger'
const STORAGE_KEY_MEMOS = 'kanban_memos'
const STORAGE_KEY_TOPICS = 'kanban_topics'
const STORAGE_KEY_ARCHIVE_DAYS = 'kanban_archive_days'

/** 退場門檻天數：完成且逾期達此天數才自動退場（預設 14，使用者確認 20260901）。 */
export function getArchiveDays(): number {
  const n = parseInt(localStorage.getItem(STORAGE_KEY_ARCHIVE_DAYS) ?? '14', 10)
  return Number.isFinite(n) && n >= 0 ? n : 14
}

const GITHUB_PROJECTS_PATH = 'data/projects.json'
const GITHUB_MILESTONES_PATH = 'data/milestones.json'
const GITHUB_TODOS_PATH = 'data/todos.json'
const GITHUB_ROUTINES_PATH = 'data/routines.json'
const GITHUB_LEDGER_PATH = 'data/ledger.json'
const GITHUB_MEMOS_PATH = 'data/memos.json'
const GITHUB_TOPICS_PATH = 'data/topics.json'

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

// ── Routine local storage ──

function loadRoutines(): Routine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ROUTINES)
    if (!raw) return []
    return JSON.parse(raw) as Routine[]
  } catch {
    return []
  }
}

function saveRoutines(routines: Routine[]): void {
  localStorage.setItem(STORAGE_KEY_ROUTINES, JSON.stringify(routines))
}

// ── Ledger（記帳）local storage ──

function loadLedger(): LedgerEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LEDGER)
    if (!raw) return []
    return JSON.parse(raw) as LedgerEntry[]
  } catch {
    return []
  }
}

function saveLedger(ledger: LedgerEntry[]): void {
  localStorage.setItem(STORAGE_KEY_LEDGER, JSON.stringify(ledger))
}

// ── Memo（備忘錄）local storage ──

function loadMemos(): Memo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MEMOS)
    if (!raw) return []
    return JSON.parse(raw) as Memo[]
  } catch {
    return []
  }
}

function saveMemos(memos: Memo[]): void {
  localStorage.setItem(STORAGE_KEY_MEMOS, JSON.stringify(memos))
}

// ── Topic（選題庫）local storage ──

function loadTopics(): Topic[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TOPICS)
    if (!raw) return []
    const arr = JSON.parse(raw) as Topic[]
    // migration: 補缺失/重複 sort_order → 依 added_date 稳定排序重排連續
    let next = 0
    const seen = new Set<number>()
    return arr.map((t, i) => {
      const so = typeof t.sort_order === 'number' && !seen.has(t.sort_order) ? t.sort_order : next
      seen.add(so)
      next = Math.max(next, so) + 1
      return { ...t, sort_order: so, _i: i } as any
    }).sort((a: any, b: any) => a.sort_order - b.sort_order || a._i - b._i)
      .map((t: any) => { const { _i, ...rest } = t; return rest as Topic })
  } catch {
    return []
  }
}

function saveTopics(topics: Topic[]): void {
  localStorage.setItem(STORAGE_KEY_TOPICS, JSON.stringify(topics))
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

/** 下載時記錄各檔 sha（供上傳時衝突偵測：雲端被別台裝置改過 → 409） */
const remoteShas = new Map<string, string>()

async function readGitHubFileFull(token: string, filePath: string): Promise<{ data: unknown[]; sha: string; ok: boolean }> {
  try {
    const res = await fetch(`https://api.github.com/repos/PosenChen/kanban-data/contents/${filePath}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`GitHub API error for ${filePath}: ${res.status}`)
    const d: { content: string; sha: string } = await res.json()
    const bin = Uint8Array.from(atob(d.content), c => c.charCodeAt(0))
    const text = new TextDecoder('utf-8').decode(bin)
    const data = JSON.parse(text) as unknown[]
    remoteShas.set(filePath, d.sha) // 記 sha：此後的上傳以此驗證中間未被人改
    return { data, sha: d.sha, ok: true }
  } catch {
    return { data: [], sha: '', ok: false }
  }
}

async function readGitHubFile(token: string, filePath: string): Promise<unknown[]> {
  return (await readGitHubFileFull(token, filePath)).data
}

/** 409 衝突：雲端檔案已被其他裝置更新 */
export class SyncConflictError extends Error {
  constructor(public readonly path: string) {
    super(`Sync conflict: ${path} was modified on GitHub by another device. Please download & merge first.`)
    this.name = 'SyncConflictError'
  }
}

async function writeGitHubFile(token: string, filePath: string, data: unknown[]): Promise<void> {
  const json = JSON.stringify(data, null, 2)
  const bytes = new TextEncoder().encode(json)
  const bin = String.fromCharCode(...bytes)
  const encoded = btoa(bin)

  // 用下載時記的 sha（若从未下載過，先讀一次取得 sha 再寫，避免盲蓋）
  let sha = remoteShas.get(filePath) ?? ''
  if (!sha) {
    const cur = await readGitHubFileFull(token, filePath)
    sha = cur.sha
  }

  const res = await fetch(`https://api.github.com/repos/PosenChen/kanban-data/contents/${filePath}`, {
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

  if (res.status === 409 || res.status === 412) {
    // 中間有人改過：不強推，記新 sha 後拋衝突（UI 提示先下載合併）
    const cur = await readGitHubFileFull(token, filePath)
    if (cur.sha) remoteShas.set(filePath, cur.sha)
    throw new SyncConflictError(filePath)
  }
  if (!res.ok) {
    throw new Error(`GitHub upload failed for ${filePath}: HTTP ${res.status}`)
  }
  const d: { content?: { sha?: string } } = await res.json().catch(() => ({}) as { content?: { sha?: string } })
  if (d.content?.sha) remoteShas.set(filePath, d.content.sha)
}

export async function readGitHub(token: string): Promise<Project[]> {
  return readGitHubFile(token, GITHUB_PROJECTS_PATH) as Promise<Project[]>
}

export async function writeGitHub(token: string, projects: Project[], milestones: Milestone[], todos: Todo[], routines: Routine[], ledger: LedgerEntry[] = [], memos: Memo[] = [], topics: Topic[] = [], opts: { force?: boolean } = {}): Promise<{ uploaded: string[]; skipped: string[] }> {
  const files: [string, unknown[]][] = [
    [GITHUB_PROJECTS_PATH, projects],
    [GITHUB_MILESTONES_PATH, milestones],
    [GITHUB_TODOS_PATH, todos],
    [GITHUB_ROUTINES_PATH, routines],
    [GITHUB_LEDGER_PATH, ledger],
    [GITHUB_MEMOS_PATH, memos],
    [GITHUB_TOPICS_PATH, topics],
  ]
  const uploaded: string[] = []
  const skipped: string[] = []

  for (const [path, local] of files) {
    if (local.length === 0 && !opts.force) {
      // 空覆蓋防護：本地空 → 查雲端；雲端非空/讀取失敗 → 跳過，絕不把雲端清空
      const remote = await readGitHubFileFull(token, path)
      const skip = shouldSkipEmptyUpload(0, remote.ok ? remote.data.length : -1)
      if (skip) {
        skipped.push(path)
        console.warn(`[sync] skipped ${path}: local empty but cloud has ${remote.data.length} items (empty-overwrite guard)`)
        continue
      }
    }
    await writeGitHubFile(token, path, local)
    uploaded.push(path)
  }
  return { uploaded, skipped }
}

export async function readMilestonesGitHub(token: string): Promise<Milestone[]> {
  return readGitHubFile(token, GITHUB_MILESTONES_PATH) as Promise<Milestone[]>
}

export async function readTodosGitHub(token: string): Promise<Todo[]> {
  return readGitHubFile(token, GITHUB_TODOS_PATH) as Promise<Todo[]>
}

export async function readRoutinesGitHub(token: string): Promise<Routine[]> {
  return readGitHubFile(token, GITHUB_ROUTINES_PATH) as Promise<Routine[]>
}

export async function readLedgerGitHub(token: string): Promise<LedgerEntry[]> {
  return readGitHubFile(token, GITHUB_LEDGER_PATH) as Promise<LedgerEntry[]>
}

export async function readMemosGitHub(token: string): Promise<Memo[]> {
  return readGitHubFile(token, GITHUB_MEMOS_PATH) as Promise<Memo[]>
}

export async function readTopicsGitHub(token: string): Promise<Topic[]> {
  return readGitHubFile(token, GITHUB_TOPICS_PATH) as Promise<Topic[]>
}

// ── Unified store ──

let cached: Project[] = []
let milestones: Milestone[] = []
let todos: Todo[] = []
let routines: Routine[] = loadRoutines()
let ledger: LedgerEntry[] = loadLedger()
let memos: Memo[] = loadMemos()
let topics: Topic[] = loadTopics()

// Load milestones
milestones = loadMilestones()
// Migrate old milestones: convert 'date' to 'start_date'/'end_date', merge adjacent same-name ones
const migratedMilestones: Milestone[] = milestones.map(m => {
  const old = m as any
  const startDate = old.start_date || old.date || dateToStr(new Date())
  const endDate = old.end_date || startDate
  return { ...m, start_date: startDate, end_date: endDate }
})
// Merge consecutive same-name milestones
migratedMilestones.sort((a, b) => a.name.localeCompare(b.name) || a.start_date.localeCompare(b.start_date))
const merged: Milestone[] = []
for (let i = 0; i < migratedMilestones.length; i++) {
  const cur = { ...migratedMilestones[i] }
  while (i + 1 < migratedMilestones.length) {
    const next = migratedMilestones[i + 1]
    if (cur.name !== next.name) break
    const curEnd = new Date(cur.end_date)
    const nextStart = new Date(next.start_date)
    const diffDays = Math.round((nextStart.getTime() - curEnd.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays <= 1) {
      cur.end_date = next.end_date
      cur.tags = [...new Set([...cur.tags, ...next.tags])]
      if (next.description && !cur.description?.includes(next.description)) {
        cur.description = cur.description ? `${cur.description}; ${next.description}` : next.description
      }
      cur.updated_at = new Date().toISOString()
      milestones = milestones.filter(m => m.id !== next.id)
      i++
    } else break
  }
  merged.push(cur)
}
milestones = merged
saveMilestones(milestones)
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
      start_date: p.start_date,
      end_date: p.start_date,
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
  window.dispatchEvent(new CustomEvent('kanban:data-change', { detail: cached.filter(p => !p.archived_at) }))
}

function emitProjectCopied(projectId: string) {
  window.dispatchEvent(new CustomEvent('kanban:project-copied', { detail: projectId }))
}

function emitMilestoneChange() {
  window.dispatchEvent(new CustomEvent('kanban:milestone-change', { detail: milestones.filter(m => !m.archived_at) }))
}

function emitTodoChange() {
  window.dispatchEvent(new CustomEvent('kanban:todo-change', { detail: todos.filter(t => !t.archived_at) }))
}

function emitRoutineChange() {
  window.dispatchEvent(new CustomEvent('kanban:routine-change', { detail: routines }))
}

function emitLedgerChange() {
  window.dispatchEvent(new CustomEvent('kanban:ledger-change', { detail: ledger }))
}

function emitMemoChange() {
  window.dispatchEvent(new CustomEvent('kanban:memo-change', { detail: memos }))
}

function emitTopicChange() {
  window.dispatchEvent(new CustomEvent('kanban:topic-change', { detail: topics }))
}

export const projectStore = {
  getAll(): Project[] {
    return cached.filter(p => !p.archived_at)
  },

  getAllRaw(): Project[] {
    return cached
  },

  getById(id: string): Project | undefined {
    return cached.find(p => p.id === id)
  },

  getByParent(parentId: string | null): Project[] {
    return cached.filter(p => p.parent_id === parentId && !p.archived_at)
  },

  getByDate(date: string): Project[] {
    return cached.filter(p => !p.archived_at && p.start_date <= date && p.end_date >= date)
  },

  getByTag(tag: string): Project[] {
    return cached.filter(p => !p.archived_at && p.tags.includes(tag))
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
    return cached.filter(p => p.parent_id === projectId && !p.archived_at)
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

  // ── Slot reorder（拖曳用）：插入到同層 beforeId 之前；beforeId=null → 置末 ──
  moveProjectToSlot(parentId: string | null, draggedId: string, beforeId: string | null): void {
    const siblings = cached.filter(p => p.parent_id === parentId)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const ordered = reorderToSlot(siblings, draggedId, beforeId)
    if (ordered === siblings) return // draggedId 不在該群組 → no-op
    ordered.forEach((sib, i) => {
      const sIdx = cached.findIndex(p => p.id === sib.id)
      if (sIdx !== -1) cached[sIdx] = { ...cached[sIdx], sort_order: i, updated_at: new Date().toISOString() }
    })
    saveLocal(cached)
    emitProjectChange()
  },

  moveTodoToSlot(draggedId: string, beforeId: string | null): void {
    const sorted = [...todos].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const ordered = reorderToSlot(sorted, draggedId, beforeId)
    if (ordered === sorted) return
    ordered.forEach((t, i) => {
      const tIdx = todos.findIndex(x => x.id === t.id)
      if (tIdx !== -1) todos[tIdx] = { ...todos[tIdx], sort_order: i, updated_at: new Date().toISOString() }
    })
    saveTodos(todos)
    emitTodoChange()
  },

  getRootProjects(): Project[] {
    return cached.filter(p => p.parent_id === null)
  },

  // ── Milestone CRUD ──

  addMilestone(data: Omit<Milestone, 'id' | 'created_at' | 'updated_at'>): Milestone {
    const now = new Date().toISOString()
    const start = data.start_date || dateToStr(new Date())
    const end = data.end_date || start
    const newMilestone: Milestone = {
      ...data,
      start_date: start,
      end_date: end,
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
    return milestones.filter(m => !m.archived_at)
  },

  getMilestoneById(id: string): Milestone | undefined {
    return milestones.find(m => m.id === id)
  },

  updateMilestone(id: string, updates: Partial<Milestone>): Milestone | undefined {
    const idx = milestones.findIndex(m => m.id === id)
    if (idx === -1) return undefined
    const updated = { ...milestones[idx], ...updates, updated_at: new Date().toISOString() }
    // Default end_date to start_date if not provided
    if (!updates.end_date && updates.start_date) {
      updated.end_date = updates.start_date
    }
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
    return todos.filter(t => !t.archived_at)
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

  /** 匯入專案模板：新 ID、日期重錨定今日、附加到現有資料尾端 */
  importTemplate(t: ProjectTemplate): Project[] {
    const newProjects = remapAndShift(t)
    const maxSort = cached.reduce((m, p) => Math.max(m, p.sort_order ?? 0), -1)
    let rootIdx = 0
    newProjects.forEach(p => {
      if (p.parent_id === null) { p.sort_order = maxSort + 1 + (rootIdx++) }
    })
    cached = [...cached, ...newProjects]
    saveLocal(cached)
    emitProjectChange()
    return newProjects
  },

  // ── Routine (流水帳) CRUD ──

  addRoutine(data: Omit<Routine, 'id' | 'created_at' | 'updated_at' | 'sort_order'>): Routine {
    const now = new Date().toISOString()
    const newRoutine: Routine = {
      ...data,
      sort_order: routines.length,
      id: `ro${Date.now().toString(36)}`,
      created_at: now,
      updated_at: now,
    }
    routines = [...routines, newRoutine]
    saveRoutines(routines)
    emitRoutineChange()
    return newRoutine
  },

  getRoutines(): Routine[] {
    return routines
  },

  updateRoutine(id: string, updates: Partial<Routine>): Routine | undefined {
    const idx = routines.findIndex(r => r.id === id)
    if (idx === -1) return undefined
    const updated = { ...routines[idx], ...updates, updated_at: new Date().toISOString() }
    routines[idx] = updated
    saveRoutines(routines)
    emitRoutineChange()
    return updated
  },

  removeRoutine(id: string): boolean {
    const idx = routines.findIndex(r => r.id === id)
    if (idx === -1) return false
    routines = routines.filter(r => r.id !== id)
    saveRoutines(routines)
    emitRoutineChange()
    return true
  },

  // ── Ledger（記帳）CRUD ──
  addLedgerEntry(data: Omit<LedgerEntry, 'id' | 'created_at' | 'updated_at'>): LedgerEntry {
    const nowIso = new Date().toISOString()
    const entry: LedgerEntry = { ...data, id: `le${Date.now().toString(36)}`, created_at: nowIso, updated_at: nowIso }
    ledger = [...ledger, entry]
    saveLedger(ledger)
    emitLedgerChange()
    return entry
  },

  getLedger(): LedgerEntry[] {
    return ledger
  },

  updateLedgerEntry(id: string, updates: Partial<LedgerEntry>): LedgerEntry | undefined {
    const idx = ledger.findIndex(x => x.id === id)
    if (idx === -1) return undefined
    const updated = { ...ledger[idx], ...updates, updated_at: new Date().toISOString() }
    ledger[idx] = updated
    saveLedger(ledger)
    emitLedgerChange()
    return updated
  },

  removeLedgerEntry(id: string): boolean {
    const idx = ledger.findIndex(x => x.id === id)
    if (idx === -1) return false
    ledger = ledger.filter(x => x.id !== id)
    saveLedger(ledger)
    emitLedgerChange()
    return true
  },

  // ── Memo（備忘錄）CRUD ──
  addMemo(data: Omit<Memo, 'id' | 'created_at' | 'updated_at'>): Memo {
    const nowIso = new Date().toISOString()
    const memo: Memo = { ...data, id: `me${Date.now().toString(36)}`, created_at: nowIso, updated_at: nowIso }
    memos = [...memos, memo]
    saveMemos(memos)
    emitMemoChange()
    return memo
  },

  getMemos(): Memo[] {
    return memos
  },

  updateMemo(id: string, updates: Partial<Memo>): Memo | undefined {
    const idx = memos.findIndex(x => x.id === id)
    if (idx === -1) return undefined
    const updated = { ...memos[idx], ...updates, updated_at: new Date().toISOString() }
    memos[idx] = updated
    saveMemos(memos)
    emitMemoChange()
    return updated
  },

  removeMemo(id: string): boolean {
    const idx = memos.findIndex(x => x.id === id)
    if (idx === -1) return false
    memos = memos.filter(x => x.id !== id)
    saveMemos(memos)
    emitMemoChange()
    return true
  },

  // ── Topic（選題庫）CRUD ──
  addTopic(data: Omit<Topic, 'id' | 'created_at' | 'updated_at' | 'status'> & { status?: TopicStatus }): Topic {
    const nowIso = new Date().toISOString()
    const topic: Topic = { ...data, status: data.status ?? 'pool', id: `tp${Date.now().toString(36)}`, created_at: nowIso, updated_at: nowIso }
    topics = [...topics, topic]
    saveTopics(topics)
    emitTopicChange()
    return topic
  },

  getTopics(): Topic[] {
    return topics
  },

  todayTopic(): Topic | null {
    return todayTopic(topics)
  },

  claimTopic(id: string): Topic | undefined {
    const t = topics.find(x => x.id === id)
    if (!t) return undefined
    return this.updateTopic(id, claimTopic(t))
  },

  releaseTopic(id: string): Topic | undefined {
    const t = topics.find(x => x.id === id)
    if (!t) return undefined
    return this.updateTopic(id, releaseTopic(t))
  },

  completeTopic(id: string, date: string): Topic | undefined {
    const t = topics.find(x => x.id === id)
    if (!t) return undefined
    return this.updateTopic(id, completeTopic(t, date))
  },

  /** 池內調序（dir=-1 上移 / 1 下移），整池 sort_order 重排連續 */
  moveTopic(id: string, dir: -1 | 1): void {
    topics = swapPoolOrder(topics, id, dir)
    saveTopics(topics)
    emitTopicChange()
  },

  removeTopic(id: string): boolean {
    const idx = topics.findIndex(x => x.id === id)
    if (idx === -1) return false
    topics = reorderPoolAfterRemove(topics, id)
    saveTopics(topics)
    emitTopicChange()
    return true
  },

  updateTopic(id: string, patch: Partial<Topic>): Topic | undefined {
    const idx = topics.findIndex(x => x.id === id)
    if (idx === -1) return undefined
    const updated = { ...topics[idx], ...patch, id, updated_at: new Date().toISOString() }
    topics[idx] = updated
    saveTopics(topics)
    emitTopicChange()
    return updated
  },

  /** 勾選/取消勾選（today=YYYY-MM-DD；隔天 completed_date 比對自然失效） */
  toggleRoutineDone(id: string, today: string): void {
    const r = routines.find(x => x.id === id)
    if (!r) return
    this.updateRoutine(id, { completed_date: r.completed_date === today ? undefined : today })
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
            start_date: p.start_date,
            end_date: p.start_date,
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

      // Load routines from GitHub
      const loadedRoutines = await readRoutinesGitHub(token)
      const existingRoutineIds = new Set(routines.map(r => r.id))
      for (const r of loadedRoutines) {
        if (!existingRoutineIds.has(r.id)) {
          routines.push(r)
        }
      }
      saveRoutines(routines)
      emitRoutineChange()

      // Load ledger from GitHub
      const loadedLedger = await readLedgerGitHub(token)
      const existingLedgerIds = new Set(ledger.map(x => x.id))
      for (const x of loadedLedger) {
        if (!existingLedgerIds.has(x.id)) {
          ledger.push(x)
        }
      }
      saveLedger(ledger)
      emitLedgerChange()

      // Load memos from GitHub
      const loadedMemos = await readMemosGitHub(token)
      const existingMemoIds = new Set(memos.map(x => x.id))
      for (const x of loadedMemos) {
        if (!existingMemoIds.has(x.id)) {
          memos.push(x)
        }
      }
      saveMemos(memos)
      emitMemoChange()

      // Load topics from GitHub
      const loadedTopics = await readTopicsGitHub(token)
      const existingTopicIds = new Set(topics.map(x => x.id))
      for (const x of loadedTopics) {
        if (!existingTopicIds.has(x.id)) {
          topics.push(x)
        }
      }
      saveTopics(topics)
      emitTopicChange()

      emitProjectChange()
      setStorageSource('github')
      projectStore.autoArchive()
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

  // ── Archive（退場/檔案庫）：archived_at 標記，絕不自動刪除 ──
  autoArchive(): void {
    const today = new Date()
    const days = getArchiveDays()
    const todayS = dateToStr(today)

    // Projects: parent-group rule — 父與全部子孫皆完成且最晚結束日過期，整群退場
    const byParent = new Map<string | null, Project[]>()
    for (const p of cached) {
      const k = p.parent_id ?? null
      if (!byParent.has(k)) byParent.set(k, [])
      byParent.get(k)!.push(p)
    }
    const buildNode = (p: Project): GroupNode => ({
      id: p.id,
      doneDate: p.status === 'completed' ? p.end_date : null,
      children: (byParent.get(p.id) ?? []).map(buildNode),
      archived: !!p.archived_at,
    })
    const roots = cached.filter(p => !p.parent_id)
    const groupIds = new Set(selectArchivableGroups(roots.map(buildNode), today, days))
    // 已退場項目的未退場子孫也要跟著退場（保持群組一致）
    const ensureSubtree = (ids: Set<string>) => {
      let grew = true
      while (grew) {
        grew = false
        for (const p of cached) {
          if (p.parent_id && ids.has(p.parent_id) && !ids.has(p.id)) {
            ids.add(p.id)
            grew = true
          }
        }
      }
    }
    ensureSubtree(groupIds)

    let changed = false
    cached = cached.map(p => {
      if (p.archived_at || !groupIds.has(p.id)) return p
      changed = true
      return { ...p, archived_at: todayS }
    })

    const markTodos = todos.map(t => {
      if (isItemArchivable({ id: t.id, doneDate: t.completed ? t.updated_at.slice(0, 10) : null, archived: !!t.archived_at }, today, days)) {
        changed = true
        return { ...t, archived_at: todayS }
      }
      return t
    })
    const markMs = milestones.map(m => {
      if (isItemArchivable({ id: m.id, doneDate: m.end_date, archived: !!m.archived_at }, today, days)) {
        changed = true
        return { ...m, archived_at: todayS }
      }
      return m
    })

    if (!changed) return
    todos = markTodos
    milestones = markMs
    saveLocal(cached)
    saveTodos(todos)
    saveMilestones(milestones)
    emitProjectChange()
    emitTodoChange()
    emitMilestoneChange()
  },

  archive(kind: 'project' | 'todo' | 'milestone', id: string): void {
    const todayS = dateToStr(new Date())
    if (kind === 'project') {
      cached = cached.map(p => p.id === id ? { ...p, archived_at: todayS } : p)
      saveLocal(cached)
      emitProjectChange()
    } else if (kind === 'milestone') {
      milestones = milestones.map(m => m.id === id ? { ...m, archived_at: todayS } : m)
      saveMilestones(milestones)
      emitMilestoneChange()
    } else {
      todos = todos.map(t => t.id === id ? { ...t, archived_at: todayS } : t)
      saveTodos(todos)
      emitTodoChange()
    }
  },

  unarchiveAncestry(id: string): void {
    // 沿 parent 鏈向上還原整條挂靠鏈，並補齊本項目的整棵子樹
    // （群組回到總覽時必須結構完整，但不含兄弟群組）
    const byId = new Map(cached.map(p => [p.id, p]))
    const ids = new Set<string>()
    // 1) 祖先鏈：自己 → 父 → …… → 根
    let cur = byId.get(id)
    while (cur) {
      ids.add(cur.id)
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined
    }
    // 2) 自己的後代（僅自己這棵子樹）
    const collectKids = (pid: string) => {
      for (const p of cached) {
        if (p.parent_id === pid && !ids.has(p.id)) {
          ids.add(p.id)
          collectKids(p.id)
        }
      }
    }
    collectKids(id)
    cached = cached.map(p => ids.has(p.id) ? { ...p, archived_at: undefined } : p)
    saveLocal(cached)
    emitProjectChange()
  },

  unarchive(kind: 'project' | 'todo' | 'milestone', id: string): void {
    if (kind === 'project') {
      cached = cached.map(p => p.id === id ? { ...p, archived_at: undefined } : p)
      saveLocal(cached)
      emitProjectChange()
    } else if (kind === 'milestone') {
      milestones = milestones.map(m => m.id === id ? { ...m, archived_at: undefined } : m)
      saveMilestones(milestones)
      emitMilestoneChange()
    } else {
      todos = todos.map(t => t.id === id ? { ...t, archived_at: undefined } : t)
      saveTodos(todos)
      emitTodoChange()
    }
  },

  getArchived(): { projects: Project[]; milestones: Milestone[]; todos: Todo[] } {
    const byArchivedDesc = <T extends { archived_at?: string }>(a: T, b: T) => (b.archived_at ?? '').localeCompare(a.archived_at ?? '')
    return {
      projects: cached.filter(p => p.archived_at).sort(byArchivedDesc),
      milestones: milestones.filter(m => m.archived_at).sort(byArchivedDesc),
      todos: todos.filter(t => t.archived_at).sort(byArchivedDesc),
    }
  },

  sync() {
    cached = loadLocal()
    milestones = loadMilestones()
    todos = loadTodos()
    routines = loadRoutines()
    topics = loadTopics()
    emitProjectChange()
    emitMilestoneChange()
    emitTodoChange()
    emitRoutineChange()
    emitTopicChange()
  },
}

// 模組載入（migration 之後）與跨分頁 sync 時執行自動退場
projectStore.autoArchive()

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
  if (e.key === STORAGE_KEY_ROUTINES) {
    routines = loadRoutines()
    emitRoutineChange()
  }
  if (e.key === STORAGE_KEY_TOPICS) {
    topics = loadTopics()
    emitTopicChange()
  }
})

// ── GitHub sync (debounced 3s) ──

let syncTimer: ReturnType<typeof setTimeout> | null = null

/** 同步狀態事件：ok / skipped / conflict / error（設定頁訂閱顯示） */
export type SyncEventDetail =
  | { state: 'ok'; uploaded: string[]; skipped: string[] }
  | { state: 'conflict'; path: string }
  | { state: 'error'; message: string }

function emitSyncStatus(detail: SyncEventDetail) {
  window.dispatchEvent(new CustomEvent<SyncEventDetail>('kanban:sync-status', { detail }))
}

export function getLocalCounts() {
  return { projects: cached.length, milestones: milestones.length, todos: todos.length, routines: routines.length, ledger: ledger.length, memos: memos.length, topics: topics.length }
}

export async function pushToGitHub(token: string, force = false): Promise<SyncEventDetail> {
  try {
    const { uploaded, skipped } = await writeGitHub(token, cached, milestones, todos, routines, ledger, memos, topics, { force })
    if (skipped.length > 0) {
      console.warn(`[sync] skipped (empty-overwrite guard): ${skipped.join(', ')}`)
    }
    return { state: 'ok', uploaded, skipped }
  } catch (err: unknown) {
    if (err instanceof SyncConflictError) return { state: 'conflict', path: err.path }
    return { state: 'error', message: (err as Error).message }
  }
}

/** 取得雲端六檔筆數（供上傳前確認比對；讀取失敗以 -1 表示未知） */
export async function fetchRemoteCounts(token: string): Promise<Record<keyof ReturnType<typeof getLocalCounts>, number>> {
  const paths: [keyof ReturnType<typeof getLocalCounts>, string][] = [
    ['projects', GITHUB_PROJECTS_PATH], ['milestones', GITHUB_MILESTONES_PATH], ['todos', GITHUB_TODOS_PATH],
    ['routines', GITHUB_ROUTINES_PATH], ['ledger', GITHUB_LEDGER_PATH], ['memos', GITHUB_MEMOS_PATH], ['topics', GITHUB_TOPICS_PATH],
  ]
  const out = {} as Record<keyof ReturnType<typeof getLocalCounts>, number>
  await Promise.all(paths.map(async ([key, path]) => {
    const r = await readGitHubFileFull(token, path)
    out[key] = r.ok ? r.data.length : -1
  }))
  return out
}

export function scheduleGitHubSync(token: string | null, force: boolean = false) {
  if (!token || token.trim() === '') return
  if (syncTimer && !force) clearTimeout(syncTimer)

  syncTimer = setTimeout(async () => {
    const result = await pushToGitHub(token.trim(), force)
    if (result.state === 'ok') {
      console.log(`✅ Synced to GitHub (${result.uploaded.length} files${result.skipped.length ? `, skipped ${result.skipped.length}` : ''})`)
    } else {
      console.warn('GitHub sync issue:', result)
    }
    emitSyncStatus(result)
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
