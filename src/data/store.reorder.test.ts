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

const now = '2026-09-02T00:00:00.000Z'
const mk = (id: string, parent: string | null, sort: number) =>
  ({ id, name: id, description: '', parent_id: parent, sort_order: sort,
    start_date: '2026-09-01', end_date: '2026-09-30',
    status: 'in_progress', priority: 'medium', tags: [], progress: 0,
    created_at: now, updated_at: now })

const sortedIds = <T extends { sort_order?: number; id: string }>(l: T[]) =>
  [...l].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map(x => x.id)

let projectStore: typeof import('@/data/localStorageStore')['projectStore']

beforeAll(async () => {
  installShim()
  localStorage.setItem('kanban_projects', JSON.stringify([
    mk('r1', null, 0), mk('r2', null, 1), mk('r3', null, 2),
    mk('c1', 'r1', 0), mk('c2', 'r1', 1),
  ]))
  localStorage.setItem('kanban_todos', JSON.stringify(['t1', 't2', 't3'].map((id, i) => ({
    id, name: id, priority: 'medium', sort_order: i, completed: false,
    created_at: now, updated_at: now,
  }))))
  localStorage.setItem('kanban_milestones', JSON.stringify([]))
  projectStore = (await import('@/data/localStorageStore')).projectStore
})

describe('moveProjectToSlot', () => {
  it('root: r3 before r1 → [r3,r1,r2] contiguous, persisted', () => {
    projectStore.moveProjectToSlot(null, 'r3', 'r1')
    const roots = projectStore.getAllRaw().filter(p => p.parent_id === null)
    expect(sortedIds(roots)).toEqual(['r3', 'r1', 'r2'])
    const persisted = JSON.parse(localStorage.getItem('kanban_projects')!)
    expect(persisted.find((p: { id: string }) => p.id === 'r3').sort_order).toBe(0)
  })

  it('child: c2 before c1 within r1', () => {
    projectStore.moveProjectToSlot('r1', 'c2', 'c1')
    expect(sortedIds(projectStore.getAllRaw().filter(p => p.parent_id === 'r1'))).toEqual(['c2', 'c1'])
  })

  it('beforeId=null appends to end', () => {
    // 現序（前項之後）：r3,r1,r2 → 移除 r1 置末 → r3,r2,r1
    projectStore.moveProjectToSlot(null, 'r1', null)
    expect(sortedIds(projectStore.getAllRaw().filter(p => p.parent_id === null))).toEqual(['r3', 'r2', 'r1'])
  })

  it('cross-group drag is a no-op', () => {
    const before = sortedIds(projectStore.getAllRaw().filter(p => p.parent_id === null))
    projectStore.moveProjectToSlot(null, 'c1', 'r1') // c1 is not a root
    expect(sortedIds(projectStore.getAllRaw().filter(p => p.parent_id === null))).toEqual(before)
  })
})

describe('moveTodoToSlot', () => {
  it('t3 before t1 → [t3,t1,t2]', () => {
    projectStore.moveTodoToSlot('t3', 't1')
    expect(sortedIds(projectStore.getTodos())).toEqual(['t3', 't1', 't2'])
  })

  it('beforeId=null appends', () => {
    projectStore.moveTodoToSlot('t1', null)
    expect(sortedIds(projectStore.getTodos())).toEqual(['t3', 't2', 't1'])
  })
})
