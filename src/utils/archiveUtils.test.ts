import { describe, it, expect } from 'vitest'
import {
  daysSince,
  isItemArchivable,
  isGroupArchivable,
  selectArchivableGroups,
  type GroupNode,
} from './archiveUtils'

const d = (s: string) => new Date(s + 'T00:00:00')
const TODAY = d('2026-09-01')

describe('daysSince', () => {
  it('same day = 0', () => expect(daysSince('2026-09-01', TODAY)).toBe(0))
  it('14 days apart', () => expect(daysSince('2026-08-18', TODAY)).toBe(14))
  it('future date negative', () => expect(daysSince('2026-09-05', TODAY)).toBe(-4))
})

describe('isItemArchivable (todo / milestone)', () => {
  it('doneDate 14 days ago → true', () =>
    expect(isItemArchivable({ id: 'a', doneDate: '2026-08-18', archived: false }, TODAY, 14)).toBe(true))
  it('doneDate 13 days ago → false', () =>
    expect(isItemArchivable({ id: 'b', doneDate: '2026-08-19', archived: false }, TODAY, 14)).toBe(false))
  it('not done → false', () =>
    expect(isItemArchivable({ id: 'c', doneDate: null, archived: false }, TODAY, 14)).toBe(false))
  it('already archived → false (idempotent)', () =>
    expect(isItemArchivable({ id: 'd', doneDate: '2026-01-01', archived: true }, TODAY, 14)).toBe(false))
  it('threshold 0 → counts immediately', () =>
    expect(isItemArchivable({ id: 'e', doneDate: '2026-09-01', archived: false }, TODAY, 0)).toBe(true))
})

describe('isGroupArchivable (parent + all descendants)', () => {
  const g = (id: string, doneDate: string | null, children: GroupNode[] = []): GroupNode =>
    ({ id, doneDate, children })

  it('lone root done 14 days ago → true', () =>
    expect(isGroupArchivable(g('r', '2026-08-18'), TODAY, 14)).toBe(true))

  it('parent done but child NOT done → false', () =>
    expect(isGroupArchivable(g('r', '2026-08-01', [g('c1', null)]), TODAY, 14)).toBe(false))

  it('parent NOT done but child done → false', () =>
    expect(isGroupArchivable(g('r', null, [g('c1', '2026-08-01')]), TODAY, 14)).toBe(false))

  it('all done, last child ends 13 days ago → false (group anchored on LAST end date)', () =>
    expect(isGroupArchivable(g('r', '2026-08-01', [g('c1', '2026-08-19')]), TODAY, 14)).toBe(false))

  it('all done, last member ends exactly 14 days ago → true', () =>
    expect(isGroupArchivable(g('r', '2026-08-10', [g('c1', '2026-08-18'), g('c2', '2026-08-12')]), TODAY, 14)).toBe(true))

  it('deep grandchild incomplete → false', () =>
    expect(isGroupArchivable(g('r', '2026-08-01', [g('c1', '2026-08-02', [g('gc1', null)])]), TODAY, 14)).toBe(false))

  it('deep all done past threshold → true', () =>
    expect(isGroupArchivable(g('r', '2026-08-01', [g('c1', '2026-08-02', [g('gc1', '2026-08-15')])]), TODAY, 14)).toBe(true))
})

describe('selectArchivableGroups', () => {
  it('flattens ids of every archivable group, skips mixed groups', () => {
    const roots: GroupNode[] = [
      { id: 'a', doneDate: '2026-08-01', children: [{ id: 'a1', doneDate: '2026-08-05', children: [] }] }, // all done → all archived
      { id: 'b', doneDate: '2026-08-01', children: [{ id: 'b1', doneDate: null, children: [] }] },          // child open → skip whole group
      { id: 'c', doneDate: null, children: [] },                                                                 // root open → skip
      { id: 'e', doneDate: '2026-08-25', children: [] },                                                            // only 7 days → skip
    ]
    expect(selectArchivableGroups(roots, TODAY, 14)).toEqual(['a', 'a1'])
  })
})
