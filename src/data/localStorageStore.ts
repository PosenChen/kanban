import type { Project } from '@/types/project'
import { SAMPLE_PROJECTS_WITH_META } from './sampleData'

const STORAGE_KEY_DATA = 'kanban_projects'
const STORAGE_KEY_TOKEN = 'kanban_github_token'
const STORAGE_KEY_SOURCE = 'kanban_storage_source'

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

// ── GitHub API ──

export async function readGitHub(token: string): Promise<Project[]> {
  try {
    const res = await fetch('https://api.github.com/repos/PosenChen/kanban-data/contents/data/projects.json', {
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
    const data: { content: string; sha: string } = await res.json()
    return JSON.parse(atob(data.content))
  } catch {
    return []
  }
}

export async function writeGitHub(token: string, projects: Project[]): Promise<void> {
  const json = JSON.stringify(projects, null, 2)
  const encoded = btoa(unescape(encodeURIComponent(json)))

  // Get current SHA
  let sha = ''
  try {
    const res = await fetch('https://api.github.com/repos/PosenChen/kanban-data/contents/data/projects.json', {
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
      signal: AbortSignal.timeout(10000),
    })
    if (res.ok) {
      const data: { sha: string } = await res.json()
      sha = data.sha
    }
  } catch { /* no file yet */ }

  await fetch('https://api.github.com/repos/PosenChen/kanban-data/contents/data/projects.json', {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'Update projects via Kanban board',
      content: encoded,
      sha,
      branch: 'main',
    }),
    signal: AbortSignal.timeout(15000),
  })
}

// ── Unified store ──

let cached: Project[] = []
let useGitHub = false

// Start with LocalStorage only — no auto GitHub load
cached = loadLocal()
if (cached.length === 0) {
  cached = SAMPLE_PROJECTS_WITH_META
  saveLocal(cached)
}

function emitChange() {
  window.dispatchEvent(new CustomEvent('kanban:data-change', { detail: cached }))
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
    const newProject: Project = {
      ...project,
      id: `p${Date.now().toString(36)}`,
      created_at: now,
      updated_at: now,
      actual_start_date: undefined,
      actual_end_date: undefined,
    }
    cached = [...cached, newProject]
    saveLocal(cached)
    emitChange()
    return newProject
  },

  update(id: string, updates: Partial<Project>): Project | undefined {
    const idx = cached.findIndex(p => p.id === id)
    if (idx === -1) return undefined
    const updated = { ...cached[idx], ...updates, updated_at: new Date().toISOString() }
    cached[idx] = updated
    saveLocal(cached)
    emitChange()
    return updated
  },

  remove(id: string): boolean {
    const idx = cached.findIndex(p => p.id === id)
    if (idx === -1) return false
    cached = cached.filter(p => p.id !== id)
    saveLocal(cached)
    emitChange()
    return true
  },

  getChildren(projectId: string): Project[] {
    return cached.filter(p => p.parent_id === projectId)
  },

  getRootProjects(): Project[] {
    return cached.filter(p => p.parent_id === null)
  },

  // 📥 手動從 GitHub 讀取資料
  async loadFromGitHub(token: string): Promise<Project[]> {
    const projects = await readGitHub(token)
    if (projects.length > 0) {
      cached = projects
      useGitHub = true
      setStorageSource('github')
      emitChange()
      return projects
    }
    return []
  },

  sync() {
    cached = loadLocal()
    emitChange()
  },
}

// Cross-tab sync
window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY_DATA) {
    projectStore.sync()
  }
})

// ── GitHub sync (debounced 3s) ──

let syncTimer: ReturnType<typeof setTimeout> | null = null

export function scheduleGitHubSync(token: string | null, force: boolean = false) {
  if (!token || token.trim() === '') return
  if (syncTimer && !force) clearTimeout(syncTimer)

  syncTimer = setTimeout(async () => {
    try {
      await writeGitHub(token.trim(), cached)
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

export function getSyncStatus(): { useGitHub: boolean; hasToken: boolean } {
  const token = localStorage.getItem(STORAGE_KEY_TOKEN) || ''
  return { useGitHub, hasToken: token.trim().length >= 10 }
}
