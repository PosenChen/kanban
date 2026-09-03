import { describe, it, expect, beforeAll } from 'vitest'

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
  ;(globalThis as any).confirm = () => true
}

let projectStore: typeof import('@/data/localStorageStore')['projectStore']

beforeAll(async () => {
  installShim()
  localStorage.setItem('kanban_memos', JSON.stringify([]))
  projectStore = (await import('@/data/localStorageStore')).projectStore
})

describe('memo store flow', () => {
  it('add → get → update(pin) → remove, localStorage persisted', () => {
    const a = projectStore.addMemo({ title: '買咖啡機', content: '手沖壺', tags: ['購物'], date: '2026-09-02' })
    expect(projectStore.getMemos().map(x => x.id)).toEqual([a.id])
    projectStore.updateMemo(a.id, { pinned: true })
    expect(projectStore.getMemos()[0].pinned).toBe(true)
    expect(JSON.parse(localStorage.getItem('kanban_memos')!)[0].pinned).toBe(true)
    expect(projectStore.removeMemo(a.id)).toBe(true)
    expect(projectStore.getMemos()).toEqual([])
    expect(JSON.parse(localStorage.getItem('kanban_memos')!)).toEqual([])
  })

  it('kanban:memo-change fired with full list on add', () => {
    const seen: unknown[] = []
    window.addEventListener('kanban:memo-change', ((e: any) => seen.push(e.detail)) as EventListener)
    projectStore.addMemo({ title: 'T', content: '', tags: [], date: '2026-09-02' })
    expect(seen.length).toBe(1)
    expect((seen[0] as any[])[0].title).toBe('T')
  })
})
