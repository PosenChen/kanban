import { describe, it, expect } from 'vitest'
import { todayTopic, completeTopic, claimTopic, monthlyDoneCount, reorderPoolAfterRemove } from './topicUtils'
import type { Topic } from '@/types/project'

const T = (o: Partial<Topic>): Topic => ({
  id: 't', title: '題', outline: '', tags: [], status: 'pool', sort_order: 0,
  added_date: '2026-09-01', created_at: '', updated_at: '', ...o,
})

describe('todayTopic（取今日題）', () => {
  it('有 writing 中的題 → 黏住同一題（順延優先）', () => {
    const pool = [T({ id: 'a', sort_order: 0 }), T({ id: 'b', status: 'writing', sort_order: 1 })]
    expect(todayTopic(pool)?.id).toBe('b')
  })
  it('無 writing → 舉隊首（sort_order 最小的 pool）', () => {
    const pool = [T({ id: 'b', sort_order: 5 }), T({ id: 'a', sort_order: 1 })]
    expect(todayTopic(pool)?.id).toBe('a')
  })
  it('全寫完了 → null', () => {
    expect(todayTopic([T({ status: 'done', done_date: '2026-09-01' })])).toBeNull()
  })
})

describe('claimTopic / completeTopic', () => {
  it('領題：pool → writing', () => {
    const r = claimTopic(T({ id: 'x', status: 'pool' }))
    expect(r.status).toBe('writing')
  })
  it('交卷：done + done_date', () => {
    const r = completeTopic(T({ id: 'x', status: 'writing' }), '2026-09-05')
    expect(r.status).toBe('done')
    expect(r.done_date).toBe('2026-09-05')
  })
})

describe('monthlyDoneCount / reorderPoolAfterRemove', () => {
  it('月統計只數當月 done', () => {
    const pool = [T({ status: 'done', done_date: '2026-09-01' }), T({ status: 'done', done_date: '2026-08-31' })]
    expect(monthlyDoneCount(pool, '2026-09')).toBe(1)
  })
  it('刪隊首後池 sort_order 重排連續', () => {
    const pool = [T({ id: 'a', sort_order: 0 }), T({ id: 'b', sort_order: 7 })]
    const r = reorderPoolAfterRemove(pool, 'a')
    expect(r.map(t => t.sort_order)).toEqual([0])
    expect(r[0].id).toBe('b')
  })
})
