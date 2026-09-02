import { describe, it, expect } from 'vitest'
import { reorderToSlot, nextIdAfter } from '@/utils/reorderUtils'

const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]
const ids = (r: { id: string }[]) => r.map(x => x.id)

describe('reorderToSlot', () => {
  it('inserts dragged before target', () => {
    expect(ids(reorderToSlot(list, 'd', 'b'))).toEqual(['a', 'd', 'b', 'c'])
  })
  it('beforeId=null appends to end', () => {
    expect(ids(reorderToSlot(list, 'a', null))).toEqual(['b', 'c', 'd', 'a'])
  })
  it('dropping before self is a no-op (original reference)', () => {
    expect(reorderToSlot(list, 'b', 'b')).toBe(list)
  })
  it('already immediately before target is a no-op', () => {
    expect(ids(reorderToSlot(list, 'b', 'c'))).toEqual(['a', 'b', 'c', 'd'])
  })
  it('unknown draggedId returns original reference', () => {
    expect(reorderToSlot(list, 'zzz', 'a')).toBe(list)
  })
  it('unknown beforeId appends to end', () => {
    expect(ids(reorderToSlot(list, 'a', 'zzz'))).toEqual(['b', 'c', 'd', 'a'])
  })
})

describe('nextIdAfter', () => {
  it('returns next id', () => expect(nextIdAfter(list, 'b')).toBe('c'))
  it('returns null for last or unknown', () => {
    expect(nextIdAfter(list, 'd')).toBeNull()
    expect(nextIdAfter(list, 'zzz')).toBeNull()
  })
})
