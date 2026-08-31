import { describe, it, expect } from 'vitest'
import { collectSubtree, buildTemplate, remapAndShift, isProjectTemplate } from './exportUtils'
import type { Project } from '@/types/project'

const P = (o: Partial<Project>): Project => ({
  id: 'p1', name: 'n', description: '', parent_id: null, sort_order: 0,
  start_date: '2026-01-01', end_date: '2026-01-31', status: 'preparation',
  priority: 'medium', tags: [], progress: 0, created_at: '', updated_at: '', ...o,
})
const tree: Project[] = [
  P({ id: 'root', name: '年度採購', start_date: '2026-03-01', end_date: '2026-03-31' }),
  P({ id: 'c1', parent_id: 'root', name: '發包', start_date: '2026-03-05', end_date: '2026-03-10' }),
  P({ id: 'c2', parent_id: 'c1', name: '核可', start_date: '2026-03-08', end_date: '2026-03-09' }),
  P({ id: 'other', name: '無關專案', start_date: '2026-05-01', end_date: '2026-05-05' }),
]

describe('collectSubtree', () => {
  it('收集根＋所有子孫，父在子前', () => {
    expect(collectSubtree(tree, 'root').map(p => p.id)).toEqual(['root', 'c1', 'c2'])
  })
  it('葉節點只回自己', () => {
    expect(collectSubtree(tree, 'other').map(p => p.id)).toEqual(['other'])
  })
})

describe('buildTemplate', () => {
  it('封裝 kind/version/anchor/projects', () => {
    const t = buildTemplate(tree, 'root', new Date(2026, 7, 31))
    expect(t.kind).toBe('kanban-project-template')
    expect(t.version).toBe(1)
    expect(t.anchor_start).toBe('2026-03-01') // 子樹最小 start_date
    expect(t.projects.map(p => p.id)).toEqual(['root', 'c1', 'c2'])
  })
})

describe('remapAndShift', () => {
  it('全部新 ID、parent 映射正確、日期重錨定、狀態重置', () => {
    const t = buildTemplate(tree, 'root', new Date(2026, 7, 31))
    const now = new Date(2027, 7, 31) // 偏移 = 2027-08-31 − 2026-03-01 = 548 天
    const out = remapAndShift(t, now)
    expect(out.length).toBe(3)
    const ids = new Set(out.map(p => p.id))
    expect(ids.has('root')).toBe(false)
    const root = out.find(p => p.name === '年度採購')!
    const c1 = out.find(p => p.name === '發包')!
    const c2 = out.find(p => p.name === '核可')!
    expect(root.parent_id).toBe(null)
    expect(c1.parent_id).toBe(root.id)
    expect(c2.parent_id).toBe(c1.id)
    expect(root.start_date).toBe('2027-08-31')
    expect(c1.end_date).toBe('2027-09-09') // 03-10 + 548
    expect(root.status).toBe('preparation')
    expect(root.progress).toBe(0)
    // ID 全不重複
    expect(ids.size).toBe(3)
  })
})

describe('isProjectTemplate', () => {
  it('正確辨識模板／拒絕其他格式', () => {
    expect(isProjectTemplate(buildTemplate(tree, 'root'))).toBe(true)
    expect(isProjectTemplate([{ id: 'x' }])).toBe(false)
    expect(isProjectTemplate({ kind: 'other', projects: [] })).toBe(false)
    expect(isProjectTemplate(null)).toBe(false)
  })
})
