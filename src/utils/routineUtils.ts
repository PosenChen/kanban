import type { Routine } from '@/types/project'

export function todayStr(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * 單個流水帳項目今日是否出現。
 * 語意（使用者確認 20260831）：
 * - 同一維度內 OR（weekdays=[1,2] → 週一或週二）
 * - 跨維度 OR（星期不符但今天 1 號 → 仍出現）
 * - 全空條件 = 永不出現（沒有「每天必做」基準）
 */
export function matchesToday(r: Routine, today: Date, todayTags: Set<string>): boolean {
  const wkOK = r.weekdays.includes(today.getDay())
  const mdOK = r.monthDays.includes(today.getDate())
  const tagOK = r.tags.some(t => todayTags.has(t))
  return wkOK || mdOK || tagOK
}

export function getActiveRoutines(routines: Routine[], today: Date, todayTags: Set<string>): Routine[] {
  return routines
    .filter(r => matchesToday(r, today, todayTags))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
}

export function isDoneToday(r: Routine, today: string): boolean {
  return r.completed_date === today
}
