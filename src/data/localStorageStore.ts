import type { Project, Milestone } from '@/types/project'
import { SAMPLE_PROJECTS_WITH_META } from './sampleData'

const STORAGE_KEY_DATA = 'kanban_projects'
const STORAGE_KEY_MILESTONES = 'kanban_milestones'
const STORAGE_KEY_TOKEN = 'kanban_github_token'
const STORAGE_KEY_SOURCE = 'kanban_storage_source'

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
    // Decode: base64 → UTF-8 bytes → string → JSON.parse
    const bin = Uint8Array.from(atob(data.content), c => c.charCodeAt(0))
    const text = new TextDecoder('utf-8').decode(bin)
    return JSON.parse(text)
  } catch {
    return []
  }
}

export async function writeGitHub(token: string, projects: Project[]): Promise<void> {
  const json = JSON.stringify(projects, null, 2)
  // Encode: string → UTF-8 bytes → base64 (proper for GitHub API)
  const bytes = new TextEncoder().encode(json)
  const bin = String.fromCharCode(...bytes)
  const encoded = btoa(bin)

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
let milestones: Milestone[] = []

// Load milestones
milestones = loadMilestones()

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

function emitProjectChange() {
  window.dispatchEvent(new CustomEvent('kanban:data-change', { detail: cached }))
}

function emitMilestoneChange() {
  window.dispatchEvent(new CustomEvent('kanban:milestone-change', { detail: milestones }))
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

  // 📥 手動從 GitHub 讀取資料
  async loadFromGitHub(token: string): Promise<Project[]> {
    const projects = await readGitHub(token)
    if (projects.length > 0) {
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
          // Remove milestone status if present (migration)
          const proj: Project = { ...p, status: 'preparation' as any }
          newProjects.push(proj)
        }
      }
      cached = newProjects
      emitMilestoneChange()
      emitProjectChange()
      setStorageSource('github')
      return cached
    }
    return []
  },

  sync() {
    cached = loadLocal()
    milestones = loadMilestones()
    emitProjectChange()
    emitMilestoneChange()
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

export function getSyncStatus(): { hasToken: boolean } {
  const token = localStorage.getItem(STORAGE_KEY_TOKEN) || ''
  return { hasToken: token.trim().length >= 10 }
}
