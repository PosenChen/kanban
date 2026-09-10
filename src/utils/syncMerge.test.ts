import { describe, it, expect } from 'vitest'
import { mergeById } from './syncGuardUtils'

const iso = (s: string) => `2026-09-10T${s}:00Z`

describe('mergeById 跨裝置狀態合併（last-write-wins）', () => {
  it('雲端独有 → 加入（added）', () => {
    const local = [{ id: 'a', completed: false, updated_at: iso('01:00') }]
    const remote = [{ id: 'b', completed: true, updated_at: iso('02:00') }]
    const { merged, added, refreshed } = mergeById(local, remote)
    expect(merged.map(m => m.id)).toEqual(['a', 'b'])
    expect(added).toBe(1)
    expect(refreshed).toBe(0)
  })

  it('同 ID 雲端較新 → 以雲端覆蓋本地（狀態刷新）', () => {
    // A 裝置勾選待辦 completed=true 上傳；B 裝置本地仍是舊的 false
    const local = [{ id: 't1', completed: false, updated_at: iso('01:00') }]
    const remote = [{ id: 't1', completed: true, updated_at: iso('03:00') }]
    const { merged, added, refreshed } = mergeById(local, remote)
    expect(merged).toHaveLength(1)
    expect((merged[0] as any).completed).toBe(true)
    expect(added).toBe(0)
    expect(refreshed).toBe(1)
  })

  it('同 ID 本地較新 → 保留本地（不被雲端舊值倒退）', () => {
    const local = [{ id: 'r1', completed_date: '2026-09-10', updated_at: iso('05:00') }]
    const remote = [{ id: 'r1', completed_date: undefined, updated_at: iso('02:00') }]
    const { merged, refreshed } = mergeById(local, remote as any)
    expect((merged[0] as any).completed_date).toBe('2026-09-10')
    expect(refreshed).toBe(0)
  })

  it('時間戳相同 → 保留本地（tie-break，防抖盪換）', () => {
    const local = [{ id: 'x', name: 'local', updated_at: iso('04:00') }]
    const remote = [{ id: 'x', name: 'remote', updated_at: iso('04:00') }]
    const { merged, refreshed } = mergeById(local, remote)
    expect((merged[0] as any).name).toBe('local')
    expect(refreshed).toBe(0)
  })

  it('缺 updated_at：視為最舊，不覆蓋有時間戳的本地；雙方皆缺則保本地', () => {
    const local = [{ id: 'y', done: 1, updated_at: iso('01:00') }]
    const remote = [{ id: 'y', done: 2 } as any]
    expect((mergeById(local, remote).merged[0] as any).done).toBe(1)
    const both = mergeById([{ id: 'z', v: 'L' }], [{ id: 'z', v: 'R' }] as any)
    expect((both.merged[0] as any).v).toBe('L')
  })

  it('混合：新增＋刷新＋保留一次到位，順序穩定', () => {
    const local = [
      { id: 'a', v: 'L', updated_at: iso('01:00') }, // 雲端較新 → 刷新
      { id: 'b', v: 'L', updated_at: iso('09:00') }, // 本地較新 → 保留
    ]
    const remote = [
      { id: 'a', v: 'R', updated_at: iso('02:00') },
      { id: 'b', v: 'R', updated_at: iso('08:00') },
      { id: 'c', v: 'R', updated_at: iso('08:00') }, // 雲端独有 → 加入
    ]
    const { merged, added, refreshed } = mergeById(local, remote)
    expect(merged.map(m => `${m.id}:${m.v}`)).toEqual(['a:R', 'b:L', 'c:R'])
    expect(added).toBe(1)
    expect(refreshed).toBe(1)
  })
})
