import { describe, it, expect } from 'vitest'
import { filterMemos } from '@/utils/memoUtils'
import type { Memo } from '@/types/project'

const now = '2026-09-02T00:00:00.000Z'
const m = (id: string, title: string, date: string, tags: string[] = [], pinned = false): Memo =>
  ({ id, title, content: `${title} body`, tags, date, pinned, created_at: now, updated_at: now })

const memos = [
  m('a', '買咖啡機', '2026-09-01', ['購物']),
  m('b', '回kim電話', '2026-09-02', ['電話', '工作']),
  m('c', '靈感：導出PDF', '2026-08-30', ['靈感'], true),
]

describe('filterMemos', () => {
  it('pinned first, then date desc', () => {
    expect(filterMemos(memos, '', []).map(x => x.id)).toEqual(['c', 'b', 'a'])
  })
  it('keyword matches title, case-insensitive', () => {
    expect(filterMemos(memos, 'KIM', []).map(x => x.id)).toEqual(['b'])
  })
  it('keyword matches content', () => {
    expect(filterMemos(memos, 'BODY', []).length).toBe(3)
  })
  it('tag OR within dimension', () => {
    expect(filterMemos(memos, '', ['靈感', '購物']).map(x => x.id)).toEqual(['c', 'a'])
  })
  it('keyword AND tags across dimensions', () => {
    expect(filterMemos(memos, '電話', ['工作']).map(x => x.id)).toEqual(['b'])
    expect(filterMemos(memos, '電話', ['靈感'])).toEqual([])
  })
})
