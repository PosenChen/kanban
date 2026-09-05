import { describe, it, expect, beforeAll } from 'vitest'
import { shouldSkipEmptyUpload, buildSyncPlan } from '@/utils/syncGuardUtils'

// Store 層整合驗證：先裝 localStorage/window shim，再動態 import store
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
    dispatchEvent: (e: any) => {
      (listeners.get(e.type) ?? []).forEach(f => f(e))
    },
  }
  ;(globalThis as any).CustomEvent = class {
    detail: unknown
    constructor(public type: string, init?: { detail?: unknown }) { this.detail = init?.detail }
  }
  return store
}

let writeGitHub: typeof import('@/data/localStorageStore')['writeGitHub']

beforeAll(async () => {
  installShim()
  writeGitHub = (await import('@/data/localStorageStore')).writeGitHub
})

function makeRes(status: number, body: unknown = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

describe('writeGitHub empty-overwrite guard (mocked fetch)', () => {
  it('local empty + cloud non-empty → cloud untouched (PUT never called for that file)', async () => {
    const calls: { method: string; path: string }[] = []
    const origFetch = global.fetch
    global.fetch = (async (url: any, opts: any = {}) => {
      const path = String(url).split('/contents/')[1]?.split('?')[0] ?? ''
      calls.push({ method: opts.method ?? 'GET', path })
      if ((opts.method ?? 'GET') === 'GET') {
        // cloud has items for every file
        return makeRes(200, { content: btoa(JSON.stringify([{ id: 'x', name: 'keep' }])), sha: 'sha-cloud' })
      }
      return makeRes(200, { content: { sha: 'sha-new' } })
    }) as typeof fetch

    try {
      const { uploaded, skipped } = await writeGitHub('tok', [], [], [], [], [], [])
      // every file locally empty, cloud non-empty → all skipped, zero PUT
      expect(uploaded).toHaveLength(0)
      expect(skipped).toHaveLength(7) // 七檔（含 topics）本地全空、雲端非空 → 全跳過
      expect(calls.filter(c => c.method === 'PUT')).toHaveLength(0)
    } finally {
      global.fetch = origFetch
    }
  })

  it('local non-empty → PUT called even if cloud non-empty (normal update)', async () => {
    const calls: { method: string; path: string }[] = []
    const origFetch = global.fetch
    global.fetch = (async (url: any, opts: any = {}) => {
      const path = String(url).split('/contents/')[1]?.split('?')[0] ?? ''
      calls.push({ method: opts.method ?? 'GET', path })
      if ((opts.method ?? 'GET') === 'GET') {
        return makeRes(200, { content: btoa(JSON.stringify([{ id: 'r', name: 'remote' }])), sha: 'sha-cloud' })
      }
      return makeRes(200, { content: { sha: 'sha-new' } })
    }) as typeof fetch

    try {
      const proj = [{ id: 'p1', name: 'local', parent_id: null, sort_order: 0, start_date: '2026-09-01', end_date: '2026-09-02', status: 'preparation', priority: 'high', tags: [], progress: 0, created_at: '', updated_at: '' }] as any[]
      const { uploaded } = await writeGitHub('tok', proj, [], [], [], [], [])
      expect(uploaded).toContain('data/projects.json')
      expect(calls.filter(c => c.method === 'PUT' && c.path === 'data/projects.json')).toHaveLength(1)
    } finally {
      global.fetch = origFetch
    }
  })

  it('409 conflict → SyncConflictError thrown, no silent overwrite', async () => {
    const origFetch = global.fetch
    global.fetch = (async (url: any, opts: any = {}) => {
      if ((opts.method ?? 'GET') === 'GET') {
        return makeRes(200, { content: btoa(JSON.stringify([{ id: 'r' }])), sha: 'sha-cloud' })
      }
      return makeRes(409, { message: 'conflict' })
    }) as typeof fetch

    try {
      const proj = [{ id: 'p1', name: 'local', parent_id: null, sort_order: 0, start_date: '2026-09-01', end_date: '2026-09-02', status: 'preparation', priority: 'high', tags: [], progress: 0, created_at: '', updated_at: '' }] as any[]
      await expect(writeGitHub('tok', proj, [], [], [], [], [])).rejects.toThrow(/conflict/i)
    } finally {
      global.fetch = origFetch
    }
  })
})

describe('guard sanity via plan helper', () => {
  it('force upload scenario: caller passes force → guard bypass decided by caller', () => {
    // shouldSkipEmptyUpload stays conservative: unknown remote (-1) with empty local = skip
    expect(buildSyncPlan([{ path: 'data/memos.json', localCount: 0, remoteCount: -1 }]).skip).toEqual(['data/memos.json'])
  })
})
