import { describe, it, expect, beforeAll } from 'vitest'

// 雙裝置勾選狀態同步回歸測試：
// A 裝置勾選待辦/流水帳 → 上傳雲端；B 裝置（本地舊狀態）下載後必須刷新為已勾選。
// 舊 bug：loadFromGitHub 只補新 ID、同 ID 一律跳過 → B 永遠看不到 A 的勾選。

// 時間戳／日期一律相對「現在」生成：避免固定日期（2026-09-10）隨時間推進跨過
// kanban_archive_days（預設 14）退場門檻，被 autoArchive() 標記 archived_at 後
// 從 getTodos() 過濾掉（原本 09-10 跑過、09-27 跑就失敗的 flaky 時間炸彈）。
const iso = (hour = 0): string => { const d = new Date(); d.setHours(hour); return d.toISOString() }
const todayStr = new Date().toISOString().slice(0, 10)

function installShim() {
  const store = new Map<string, string>()
  ;(globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
  }
  const listeners = new Map<string, Function[]>()
  ;(globalThis as any).window = {
    addEventListener: (t: string, f: Function) => {
      if (!listeners.has(t)) listeners.set(t, [])
      listeners.get(t)!.push(f)
    },
    removeEventListener: () => { /* noop */ },
    dispatchEvent: (e: any) => { (listeners.get(e.type) ?? []).forEach(f => f(e)) },
  }
  ;(globalThis as any).CustomEvent = class {
    detail: unknown
    constructor(public type: string, init?: { detail?: unknown }) { this.detail = init?.detail }
  }
  return store
}

function b64(obj: unknown): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
}

let projectStore: typeof import('@/data/localStorageStore')['projectStore']

beforeAll(async () => {
  installShim()
  localStorage.setItem('kanban_github_token', 'ghp_testtoken_long_enough')
  localStorage.setItem('kanban_storage_source', 'github')
  projectStore = (await import('@/data/localStorageStore')).projectStore
})

describe('跨裝置同步：下載合併刷新同 ID 狀態（B 裝置視角）', () => {
  it('待辦 completed 由雲端較新值刷新（舊 bug 會保留 false）', async () => {
    // B 本地：舊的未勾選（今日凌晨 01:00）
    const localTodo = { id: 'tA', name: '交報告', completed: false, priority: 'high', sort_order: 0, created_at: iso(0), updated_at: iso(1) }
    localStorage.setItem('kanban_todos', JSON.stringify([localTodo]))
    projectStore.sync()

    // 雲端：A 裝置已勾選（今日 03:00，updated_at 較新）
    const cloudTodo = { ...localTodo, completed: true, updated_at: iso(3) }
    const origFetch = global.fetch
    global.fetch = (async (url: any, opts: any = {}) => {
      const path = String(url).split('/contents/')[1]?.split('?')[0] ?? ''
      if ((opts.method ?? 'GET') === 'GET') {
        if (path === 'data/todos.json') return { ok: true, status: 200, json: async () => ({ content: b64([cloudTodo]), sha: 'sha1' }) }
        if (path === 'data/projects.json') return { ok: true, status: 200, json: async () => ({ content: b64([{ id: 'pZ', name: 'stub', parent_id: null, sort_order: 0, start_date: iso(0).slice(0, 10), end_date: iso(0).slice(0, 10), status: 'preparation', priority: 'low', tags: [], progress: 0, created_at: iso(0), updated_at: iso(0) }]), sha: 'shap' }) }
        return { ok: true, status: 200, json: async () => ({ content: b64([]), sha: 'sha0' }) }
      }
      return { ok: true, status: 200, json: async () => ({ content: { sha: 'sha2' } }) }
    }) as typeof fetch

    try {
      await projectStore.loadFromGitHub('ghp_testtoken_long_enough')
      const merged = projectStore.getTodos()
      expect(merged.find(t => t.id === 'tA')?.completed).toBe(true) // 核心斷言
    } finally {
      global.fetch = origFetch
    }
  })

  it('流水帳 completed_date 由雲端較新值刷新', async () => {
    const localR = { id: 'rA', name: '晨跑', weekdays: [1, 2, 3], monthDays: [], tags: [], sort_order: 0, created_at: iso(0), updated_at: iso(1) }
    localStorage.setItem('kanban_routines', JSON.stringify([localR]))
    projectStore.sync()

    const cloudR = { ...localR, completed_date: todayStr, updated_at: iso(5) }
    const origFetch = global.fetch
    global.fetch = (async (url: any, opts: any = {}) => {
      const path = String(url).split('/contents/')[1]?.split('?')[0] ?? ''
      if ((opts.method ?? 'GET') === 'GET') {
        if (path === 'data/routines.json') return { ok: true, status: 200, json: async () => ({ content: b64([cloudR]), sha: 'sha1' }) }
        if (path === 'data/projects.json') return { ok: true, status: 200, json: async () => ({ content: b64([{ id: 'pZ', name: 'stub', parent_id: null, sort_order: 0, start_date: iso(0).slice(0, 10), end_date: iso(0).slice(0, 10), status: 'preparation', priority: 'low', tags: [], progress: 0, created_at: iso(0), updated_at: iso(0) }]), sha: 'shap' }) }
        return { ok: true, status: 200, json: async () => ({ content: b64([]), sha: 'sha0' }) }
      }
      return { ok: true, status: 200, json: async () => ({ content: { sha: 'sha2' } }) }
    }) as typeof fetch

    try {
      await projectStore.loadFromGitHub('ghp_testtoken_long_enough')
      const merged = projectStore.getRoutines()
      expect(merged.find(r => r.id === 'rA')?.completed_date).toBe(todayStr) // 核心斷言
    } finally {
      global.fetch = origFetch
    }
  })

  it('本地較新不被雲端舊值倒退（雙向都正確）', async () => {
    // B 本地 今日 08:00 剛勾完；雲端今日 02:00 的舊值 → 合併後須保留本地
    const localT = { id: 'tB', name: 'X', completed: true, priority: 'low', sort_order: 0, created_at: iso(0), updated_at: iso(8) }
    localStorage.setItem('kanban_todos', JSON.stringify([localT]))
    projectStore.sync()

    const cloudT = { ...localT, completed: false, updated_at: iso(2) }
    const origFetch = global.fetch
    global.fetch = (async (url: any, opts: any = {}) => {
      const path = String(url).split('/contents/')[1]?.split('?')[0] ?? ''
      if ((opts.method ?? 'GET') === 'GET') {
        if (path === 'data/todos.json') return { ok: true, status: 200, json: async () => ({ content: b64([cloudT]), sha: 'sha1' }) }
        return { ok: true, status: 200, json: async () => ({ content: b64([]), sha: 'sha0' }) }
      }
      return { ok: true, status: 200, json: async () => ({ content: { sha: 'sha2' } }) }
    }) as typeof fetch

    try {
      await projectStore.loadFromGitHub('ghp_testtoken_long_enough')
      expect(projectStore.getTodos().find(t => t.id === 'tB')?.completed).toBe(true)
    } finally {
      global.fetch = origFetch
    }
  })
})
