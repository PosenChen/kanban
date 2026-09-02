import { describe, it, expect } from 'vitest'
import { monthKeyOf, round2, sumMonth, categoryBreakdown } from '@/utils/ledgerUtils'
import type { LedgerEntry } from '@/types/project'

const now = '2026-09-02T00:00:00.000Z'
const e = (id: string, date: string, kind: 'income' | 'expense', amount: number, category: string): LedgerEntry =>
  ({ id, date, kind, amount, category, created_at: now, updated_at: now })

const entries = [
  e('1', '2026-09-01', 'income', 50000, '工資'),
  e('2', '2026-09-03', 'expense', 250.5, '餐飲'),
  e('3', '2026-09-03', 'expense', 100, '餐飲'),
  e('4', '2026-08-20', 'expense', 500, '訂閱'),
]

describe('monthKeyOf', () => {
  it('slices YYYY-MM', () => expect(monthKeyOf('2026-09-03')).toBe('2026-09'))
})

describe('round2', () => {
  it('0.1+0.2 → 0.3', () => expect(round2(0.1 + 0.2)).toBe(0.3))
})

describe('sumMonth', () => {
  it('totals income/expense/net for a month', () => {
    expect(sumMonth(entries, '2026-09')).toEqual({ income: 50000, expense: 350.5, net: 49649.5 })
  })
  it('empty month → zeros', () => {
    expect(sumMonth(entries, '2026-07')).toEqual({ income: 0, expense: 0, net: 0 })
  })
})

describe('categoryBreakdown', () => {
  it('expense-only, sorted desc by total', () => {
    expect(categoryBreakdown(entries, '2026-09')).toEqual([
      { category: '餐飲', total: 350.5 },
    ])
    expect(categoryBreakdown(entries, '2026-08')).toEqual([
      { category: '訂閱', total: 500 },
    ])
  })
})
