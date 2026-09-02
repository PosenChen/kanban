import { describe, it, expect, beforeAll } from 'vitest'

// Store 層整合驗證：以最小 shim 提供 localStorage/window（vitest node env）
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
  ;(globalThis as any).confirm = () => true
  return store
}

describe('store archive flow', () => {
  let store: ReturnType<typeof installShim>

  beforeAll(async () => {
    store = installShim()
  })

  it('autoArchive retires done groups, keeps mixed/in-progress; getters filter archived', async () => {
    const now = new Date().toISOString()
    const mk = (id: string, parent: string | null, status: string, s: string, e: string) =>
      ({ id, name: id, description: '', parent_id: parent, sort_order: 0, start_date: s, end_date: e,
         status, priority: 'medium', tags: [], progress: status === 'completed' ? 100 : 0,
         created_at: now, updated_at: now })

    localStorage.setItem('kanban_projects', JSON.stringify([
      mk('grp', null, 'completed', '2026-08-01', '2026-08-10'),
      mk('sub1', 'grp', 'completed', '2026-08-02', '2026-08-09'),
      mk('keep', null, 'in_progress', '2026-08-25', '2026-09-20'),
      mk('mixed', null, 'completed', '2026-08-01', '2026-08-05'),
      mk('mixed-child', 'mixed', 'in_progress', '2026-08-01', '2026-09-30'),
    ]))
    localStorage.setItem('kanban_todos', JSON.stringify([
      { id: 't_old', name: '舊待辦', priority: 'medium', sort_order: 0, completed: true,
        created_at: now, updated_at: '2026-08-10T00:00:00.000Z' },
      { id: 't_open', name: '新待辦', priority: 'medium', sort_order: 1, completed: false,
        created_at: now, updated_at: now },
    ]))
    localStorage.setItem('kanban_milestones', JSON.stringify([]))

    const { projectStore } = await import('@/data/localStorageStore')
    projectStore.autoArchive()

    const activeIds = projectStore.getAll().map(p => p.id)
    // 群組 grp+sub1 已退；mixed 因子未完成保留；keep 進行中保留
    expect(activeIds).toEqual(expect.arrayContaining(['keep', 'mixed', 'mixed-child']))
    expect(activeIds).not.toContain('grp')
    expect(activeIds).not.toContain('sub1')

    const archived = projectStore.getArchived()
    expect(archived.projects.map(p => p.id).sort()).toEqual(['grp', 'sub1'])
    expect(archived.projects[0].archived_at).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(archived.todos.map(t => t.id)).toEqual(['t_old'])
    // 總覽待辦不含退場項
    expect(projectStore.getTodos().map(t => t.id)).toEqual(['t_open'])

    // localStorage 落盤：archived_at 寫入且未刪除任何資料
    const persisted = JSON.parse(localStorage.getItem('kanban_projects')!)
    expect(persisted.length).toBe(5)
    expect(persisted.find((p: { id: string; archived_at?: string }) => p.id === 'grp').archived_at).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    // 還原子孫：祖先鏈 grp 與整棵子樹一起回總覽，不含兄弟 mixed
    projectStore.unarchiveAncestry('sub1')
    const back = projectStore.getAll().map(p => p.id)
    expect(back).toContain('grp')
    expect(back).toContain('sub1')
    // 再退場並驗證 purge 路径可呼叫
    projectStore.archive('milestone', 'x') // 不存在 → no-op 不拋錯
    projectStore.autoArchive()
    expect(projectStore.getArchived().projects.map(p => p.id).sort()).toEqual(['grp', 'sub1'])
  })
})
