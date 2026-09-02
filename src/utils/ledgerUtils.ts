import type { LedgerEntry } from '@/types/project'

/** YYYY-MM-DD → YYYY-MM */
export function monthKeyOf(dateStr: string): string {
  return dateStr.slice(0, 7)
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export interface MonthTotals { income: number; expense: number; net: number }

export function sumMonth(entries: LedgerEntry[], monthKey: string): MonthTotals {
  let income = 0, expense = 0
  for (const it of entries) {
    if (monthKeyOf(it.date) !== monthKey) continue
    if (it.kind === 'income') income += it.amount
    else expense += it.amount
  }
  return { income: round2(income), expense: round2(expense), net: round2(income - expense) }
}

export interface CategoryTotal { category: string; total: number }

/** 指定月份的支出依類別統計，金額由大到小 */
export function categoryBreakdown(entries: LedgerEntry[], monthKey: string): CategoryTotal[] {
  const map = new Map<string, number>()
  for (const it of entries) {
    if (it.kind !== 'expense' || monthKeyOf(it.date) !== monthKey) continue
    map.set(it.category, round2((map.get(it.category) ?? 0) + it.amount))
  }
  return [...map.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)
}
