import { describe, it, expect } from 'vitest'
import { matchesToday, getActiveRoutines, isDoneToday, todayStr } from './routineUtils'
import type { Routine } from '@/types/project'

const base = (o: Partial<Routine>): Routine => ({
  id: 'r1', name: 'x', weekdays: [], monthDays: [], tags: [],
  sort_order: 0, created_at: '', updated_at: '', ...o,
})

// 2026-08-31 = 星期一 (weekday=1), date=31
const mon31 = new Date(2026, 7, 31)

describe('matchesToday — 跨維度 OR（使用者確認）', () => {
  it('全空條件 → 不出現（使用者確認）', () => {
    expect(matchesToday(base({}), mon31, new Set())).toBe(false)
  })
  it('weekdays 維度內 OR', () => {
    expect(matchesToday(base({ weekdays: [1, 2] }), mon31, new Set())).toBe(true)
    expect(matchesToday(base({ weekdays: [2, 3] }), mon31, new Set())).toBe(false)
  })
  it('跨維度 OR：星期不符但 monthDays 符合 → 出現', () => {
    const r = base({ weekdays: [1], monthDays: [31] }) // 星期一或31號
    expect(matchesToday(r, mon31, new Set())).toBe(true)
  })
  it('跨維度 OR：星期不符但標籤符合 → 出現', () => {
    const r = base({ weekdays: [5], tags: ['開會'] }) // 星期五或有開會活動
    expect(matchesToday(r, mon31, new Set(['開會']))).toBe(true)
    expect(matchesToday(r, mon31, new Set(['工作']))).toBe(false)
  })
  it('monthDays 維度', () => {
    const first = new Date(2026, 8, 1)
    expect(matchesToday(base({ monthDays: [1] }), first, new Set())).toBe(true)
    expect(matchesToday(base({ monthDays: [1] }), mon31, new Set())).toBe(false)
  })
})

describe('getActiveRoutines', () => {
  // 需求 #4：2026-09-01 是「1 號」也是「星期二」→ 兩組內容都要出現
  const tueFirst = new Date(2026, 8, 1)
  const rDay1 = base({ id: 'd1', monthDays: [1], sort_order: 0 })
  const rTue = base({ id: 't2', weekdays: [2], sort_order: 1 })
  const rWed = base({ id: 'w3', weekdays: [3], sort_order: 2 })
  it('滿足不同條件的項目都出現，依 sort_order 排序', () => {
    const out = getActiveRoutines([rWed, rTue, rDay1], tueFirst, new Set())
    expect(out.map(r => r.id)).toEqual(['d1', 't2'])
  })
  it('無項目符合 → 空陣列', () => {
    expect(getActiveRoutines([rWed], tueFirst, new Set())).toEqual([])
  })
})

describe('isDoneToday', () => {
  it('completed_date === 今日 → 已勾；隔天自動未勾', () => {
    const d = '2026-08-31'
    expect(isDoneToday(base({ completed_date: d }), d)).toBe(true)
    expect(isDoneToday(base({ completed_date: '2026-08-30' }), d)).toBe(false)
    expect(isDoneToday(base({}), d)).toBe(false)
  })
})

describe('todayStr', () => {
  it('回傳 YYYY-MM-DD', () => {
    expect(todayStr(new Date(2026, 7, 31))).toBe('2026-08-31')
  })
})
