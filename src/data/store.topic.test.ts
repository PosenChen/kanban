import { describe, it, expect, beforeAll } from 'vitest'
import type { Topic } from '@/types/project'

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
  localStorage.setItem('kanban_topics', JSON.stringify([]))
  projectStore = (await import('@/data/localStorageStore')).projectStore
})

describe('topic store flow', () => {
  it('add → get → today(FIFO 隊首) → claim黏住 → complete', () => {
    const a = projectStore.addTopic({ title: 'A 題', tags: ['散文'], sort_order: 0, added_date: '2026-09-01' })
    const b = projectStore.addTopic({ title: 'B 題', tags: [], sort_order: 1, added_date: '2026-09-01' })
    expect(projectStore.getTopics().map(t => t.id)).toEqual([a.id, b.id])
    expect(projectStore.todayTopic()?.id).toBe(a.id)
    projectStore.claimTopic(a.id)
    expect(projectStore.todayTopic()?.id).toBe(a.id) // 黏住 writing
    projectStore.completeTopic(a.id, '2026-09-05')
    expect(projectStore.todayTopic()?.id).toBe(b.id)  // 順輪到 B
    const done = projectStore.getTopics().find(t => t.id === a.id)!
    expect(done.status).toBe('done')
    expect(done.done_date).toBe('2026-09-05')
  })

  it('remove 後池 sort_order 重排連續 + localStorage 持久化', () => {
    const b = projectStore.getTopics().find(t => t.title === 'B 題')!
    projectStore.removeTopic(b.id)
    const c = projectStore.addTopic({ title: 'C 題', tags: [], sort_order: 9, added_date: '2026-09-02' })
    const d = projectStore.addTopic({ title: 'D 題', tags: [], sort_order: 12, added_date: '2026-09-02' })
    projectStore.removeTopic(c.id)
    const pool = projectStore.getTopics().filter((t: Topic) => t.status === 'pool')
    expect(pool.map(t => t.sort_order)).toEqual([0])
    expect(JSON.parse(localStorage.getItem('kanban_topics')!).find((t: Topic) => t.id === d.id).sort_order).toBe(0)
  })

  it('kanban:topic-change fired on add', () => {
    const seen: unknown[] = []
    window.addEventListener('kanban:topic-change', ((e: any) => seen.push(e.detail)) as EventListener)
    projectStore.addTopic({ title: 'E', tags: [], sort_order: 1, added_date: '2026-09-03' })
    expect(seen.length).toBe(1)
  })

  it('swapPoolOrder via store moveTopic', () => {
    const pool = projectStore.getTopics().filter(t => t.status === 'pool')
    const first = pool[0]
    const second = pool[1]
    projectStore.moveTopic(first.id, 1)
    const after = projectStore.getTopics().filter(t => t.status === 'pool').sort((x, y) => x.sort_order - y.sort_order)
    expect(after[0].id).toBe(second.id)
    expect(after.map(t => t.sort_order)).toEqual([0, 1])
  })
})
