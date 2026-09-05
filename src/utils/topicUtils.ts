import type { Topic } from '@/types/project'

/** 今日題：writing 黏住順延；否則 sort_order 最小的 pool；池空 null */
export function todayTopic(pool: Topic[]): Topic | null {
  const w = pool.find(t => t.status === 'writing')
  if (w) return w
  return pool.filter(t => t.status === 'pool').sort((a, b) => a.sort_order - b.sort_order)[0] ?? null
}

/** 領題：pool → writing */
export function claimTopic(t: Topic): Topic {
  return { ...t, status: 'writing', updated_at: new Date().toISOString() }
}

/** 交卷：status done + done_date */
export function completeTopic(t: Topic, date: string): Topic {
  return { ...t, status: 'done', done_date: date, updated_at: new Date().toISOString() }
}

/** 放回池：writing → pool（不改 sort_order，維持原輪次） */
export function releaseTopic(t: Topic): Topic {
  return { ...t, status: 'pool', updated_at: new Date().toISOString() }
}

export function monthlyDoneCount(pool: Topic[], ym: string): number {
  return pool.filter(t => t.status === 'done' && t.done_date?.startsWith(ym)).length
}

/** 池內相鄰交換（onMove 回傳新陣列，sort_order 重排連續） */
export function swapPoolOrder(pool: Topic[], id: string, dir: -1 | 1): Topic[] {
  const sorted = pool.filter(t => t.status === 'pool').sort((a, b) => a.sort_order - b.sort_order)
  const i = sorted.findIndex(t => t.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= sorted.length) return pool
  const moved = [...sorted]
  ;[moved[i], moved[j]] = [moved[j], moved[i]]
  const rel = moved.map((t, k) => ({ ...t, sort_order: k, updated_at: new Date().toISOString() }))
  const relIds = new Set(rel.map(t => t.id))
  return [...pool.filter(t => !relIds.has(t.id)), ...rel]
}

/** 刪池內一題後，其餘 pool 重排連續 sort_order；writing/done 原樣保留（傳回整池新陣列） */
export function reorderPoolAfterRemove(pool: Topic[], removedId: string): Topic[] {
  const keptPool = pool.filter(t => t.id !== removedId && t.status === 'pool')
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((t, i) => ({ ...t, sort_order: i }))
  const keptOthers = pool.filter(t => t.id !== removedId && t.status !== 'pool')
  return [...keptOthers, ...keptPool]
}
