import { describe, it, expect, beforeAll } from 'vitest'

// 與 store.archive.test.ts 相同的最小 shim（node env 無 DOM）
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
  localStorage.setItem('kanban_ledger', JSON.stringify([]))
  projectStore = (await import('@/data/localStorageStore')).projectStore
})

describe('ledger store flow', () => {
  it('add → get → update → remove, localStorage persisted', () => {
    const a = projectStore.addLedgerEntry({ date: '2026-09-01', kind: 'expense', amount: 100, category: '餐飲' })
    expect(projectStore.getLedger().map(x => x.id)).toEqual([a.id])

    projectStore.updateLedgerEntry(a.id, { amount: 200 })
    expect(projectStore.getLedger()[0].amount).toBe(200)
    expect(JSON.parse(localStorage.getItem('kanban_ledger')!)[0].amount).toBe(200)

    expect(projectStore.removeLedgerEntry(a.id)).toBe(true)
    expect(projectStore.getLedger()).toEqual([])
    expect(JSON.parse(localStorage.getItem('kanban_ledger')!)).toEqual([])
  })

  it('kanban:ledger-change fired with full list on add', () => {
    const seen: unknown[] = []
    window.addEventListener('kanban:ledger-change', ((e: any) => seen.push(e.detail)) as EventListener)
    projectStore.addLedgerEntry({ date: '2026-09-02', kind: 'income', amount: 50, category: '獎金' })
    expect(seen.length).toBe(1)
    expect((seen[0] as any[])[0].category).toBe('獎金')
  })
})
