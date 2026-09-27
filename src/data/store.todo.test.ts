import { describe, it, expect, beforeAll } from 'vitest'

// 新增待辦排序回歸測試：
// 舊行為 addTodo 取 sort_order = todos.length（最大）→ 新增落到列表最下面。
// 期望：新增預設置頂（最小 sort_order），其餘下移，維持 0..N-1 連續序列。

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
}

const now = '2026-09-02T00:00:00.000Z'
const mkTodo = (id: string, sort: number) => ({
  id, name: id, priority: 'medium' as const, sort_order: sort, completed: false,
  created_at: now, updated_at: now,
})
const sortedIds = <T extends { sort_order?: number; id: string }>(l: T[]) =>
  [...l].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map(x => x.id)

let projectStore: typeof import('@/data/localStorageStore')['projectStore']

beforeAll(async () => {
  installShim()
  localStorage.setItem('kanban_todos', JSON.stringify([
    mkTodo('t1', 0), mkTodo('t2', 1), mkTodo('t3', 2),
  ]))
  projectStore = (await import('@/data/localStorageStore')).projectStore
})

describe('addTodo 新增預設置頂', () => {
  it('新待辦排到最上面，其餘依序下移', () => {
    projectStore.addTodo({ name: 'newTop', priority: 'high', completed: false })
    const ids = sortedIds(projectStore.getTodos())
    // 新項在隊首，原 t1/t2/t3 維持相對順序下移
    expect(ids[0]).toMatch(/^t/)               // 新項 id 以 t 開頭
    expect(ids.slice(1)).toEqual(['t1', 't2', 't3'])
  })

  it('重編號後維持 0..N-1 連續無重複', () => {
    const sorts = projectStore.getTodos().map(t => t.sort_order ?? 0).sort((a, b) => a - b)
    const n = projectStore.getTodos().length
    expect(sorts).toEqual(Array.from({ length: n }, (_, i) => i))
  })

  it('連續新增每次都頂到最前（最新在最上）', () => {
    projectStore.addTodo({ name: 'n1', priority: 'low', completed: false })
    projectStore.addTodo({ name: 'n2', priority: 'low', completed: false })
    const names = [...projectStore.getTodos()]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map(t => t.name)
    // test1 已加 newTop（共 4），再加 n1、n2 → 6；n2 最新在隊首，n1 其次，newTop 再後
    expect(names.length).toBe(6)
    expect(names.slice(0, 3)).toEqual(['n2', 'n1', 'newTop'])
  })
})
