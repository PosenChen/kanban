import { describe, it, expect } from 'vitest'
import { shouldSkipEmptyUpload, buildSyncPlan, formatCountSummary } from './syncGuardUtils'

describe('shouldSkipEmptyUpload', () => {
  it('本地非空 → 一律上傳', () => {
    expect(shouldSkipEmptyUpload(3, 0)).toBe(false)
    expect(shouldSkipEmptyUpload(1, 50)).toBe(false)
  })

  it('本地空 + 雲端空 → 可上傳（無所謂）', () => {
    expect(shouldSkipEmptyUpload(0, 0)).toBe(false)
  })

  it('本地空 + 雲端非空 → 跳過（防空覆蓋）', () => {
    expect(shouldSkipEmptyUpload(0, 5)).toBe(true)
  })

  it('本地空 + 雲端未知(-1) → 保守跳過', () => {
    expect(shouldSkipEmptyUpload(0, -1)).toBe(true)
  })
})

describe('buildSyncPlan', () => {
  it('混合情境：只跳過空覆蓋檔', () => {
    const plan = buildSyncPlan([
      { path: 'data/projects.json', localCount: 2, remoteCount: 2 },   // upload
      { path: 'data/todos.json', localCount: 0, remoteCount: 7 },      // skip!
      { path: 'data/ledger.json', localCount: 0, remoteCount: 0 },     // upload
      { path: 'data/memos.json', localCount: 0, remoteCount: -1 },     // skip (unknown)
    ])
    expect(plan.upload).toEqual(['data/projects.json', 'data/ledger.json'])
    expect(plan.skip).toEqual(['data/todos.json', 'data/memos.json'])
  })
})

describe('formatCountSummary', () => {
  it('本雲比對摘要', () => {
    expect(formatCountSummary(['專案', '待辦'], [3, 0], [10, 4])).toBe('專案 3/10　待辦 0/4')
  })

  it('未知雲端顯示 ?', () => {
    expect(formatCountSummary(['活動'], [1], [-1])).toBe('活動 1/?')
  })
})
