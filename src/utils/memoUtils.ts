import type { Memo } from '@/types/project'

/** 關鍵字（title/content/tags 小寫包含 OR）＋標籤（任觸一）；排序 pinned↓→date↓→created_at↓ */
export function filterMemos(memos: Memo[], keyword: string, tags: string[]): Memo[] {
  const kw = keyword.trim().toLowerCase()
  return memos
    .filter(x => {
      if (tags.length > 0 && !tags.some(t => x.tags.includes(t))) return false
      if (!kw) return true
      return x.title.toLowerCase().includes(kw)
        || x.content.toLowerCase().includes(kw)
        || x.tags.some(t => t.toLowerCase().includes(kw))
    })
    .sort((a, b) =>
      (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)
      || b.date.localeCompare(a.date)
      || b.created_at.localeCompare(a.created_at))
}
