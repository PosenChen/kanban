import { describe, it, expect, beforeEach } from 'vitest'
import { getTagPresets, setTagPresets, resetTagPreset, cleanTags, DEFAULT_TAG_PRESETS } from './tagPresets'
import { QUICK_TAGS, LEDGER_QUICK_CATEGORIES, MEMO_QUICK_TAGS, TOPIC_QUICK_TAGS } from '@/types/project'

function installShim() {
  const store = new Map<string, string>()
  ;(globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
  }
  ;(globalThis as any).window = {
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => {},
  }
  ;(globalThis as any).CustomEvent = class { constructor(public type: string) {} }
}

beforeEach(() => { installShim(); localStorage.removeItem('kanban_tag_presets') })

describe('tagPresets', () => {
  it('未設定時回傳各類別預設（沿用原始常數）', () => {
    const p = getTagPresets()
    expect(p.project).toEqual(QUICK_TAGS)
    expect(p.ledger).toEqual(LEDGER_QUICK_CATEGORIES)
    expect(p.memo).toEqual(MEMO_QUICK_TAGS)
    expect(p.topic).toEqual(TOPIC_QUICK_TAGS)
  })

  it('set 後 get 回讀到編輯值', () => {
    const p = getTagPresets()
    setTagPresets({ ...p, project: ['工作', '採購', '招標'], ledger: p.ledger, memo: p.memo, topic: p.topic })
    const r = getTagPresets()
    expect(r.project).toEqual(['工作', '採購', '招標'])
  })

  it('get/set 回傳副本，mutate 不影響內部（防止共享引用污染）', () => {
    const a = getTagPresets()
    const b = getTagPresets()
    a.project.push('XX')
    expect(getTagPresets().project).toEqual(QUICK_TAGS) // 內部未受 a 的 push 影響
    void b
  })

  it('cleanTags 去空白／去空白項／去重保序', () => {
    expect(cleanTags([' a ', 'a', 'b', '', '  ', 'c', 'a'])).toEqual(['a', 'b', 'c'])
  })

  it('resetTagPreset 只還原單一類別為預設', () => {
    const p = getTagPresets()
    const edited = { ...p, ledger: ['X', 'Y'] }
    const r = resetTagPreset('ledger', edited)
    expect(r.ledger).toEqual(DEFAULT_TAG_PRESETS.ledger)
    expect(r.project).toEqual(edited.project) // 其他類別保持
  })

  it('損毀的 JSON 退回預設（不拋錯）', () => {
    localStorage.setItem('kanban_tag_presets', '{not json')
    expect(getTagPresets().project).toEqual(QUICK_TAGS)
  })
})
