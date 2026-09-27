// ── 預設標籤（quick-pick tag presets）──
// 各表單「點選快速標籤」的候選，改為可在設定頁編輯、存 LocalStorage。
// 預設值沿用 types/project.ts 的原始常數（行為不變），編輯後即生效。
// 屬個人偏好（同 archive_days / theme），純本地、不上 GitHub。

import { QUICK_TAGS, LEDGER_QUICK_CATEGORIES, MEMO_QUICK_TAGS, TOPIC_QUICK_TAGS } from '@/types/project'

export interface TagPresets {
  /** 甘特圖：專案／活動／流水帳（三者共用同一組） */
  project: string[]
  /** 記帳類別 */
  ledger: string[]
  /** 備忘錄標籤 */
  memo: string[]
  /** 選題庫標籤 */
  topic: string[]
}

export type TagPresetKey = keyof TagPresets

export const DEFAULT_TAG_PRESETS: TagPresets = {
  project: [...QUICK_TAGS],
  ledger: [...LEDGER_QUICK_CATEGORIES],
  memo: [...MEMO_QUICK_TAGS],
  topic: [...TOPIC_QUICK_TAGS],
}

export const TAG_PRESET_LABELS: Record<TagPresetKey, string> = {
  project: '專案／活動（甘特圖）',
  ledger: '記帳類別',
  memo: '備忘錄',
  topic: '選題庫',
}

const STORAGE_KEY = 'kanban_tag_presets'

/** 依序去空白、去空白項、去重（保留出現順序） */
export function cleanTags(list: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of list) {
    const v = t.trim()
    if (v && !seen.has(v)) { seen.add(v); out.push(v) }
  }
  return out
}

export function getTagPresets(): TagPresets {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {
      project: [...DEFAULT_TAG_PRESETS.project],
      ledger: [...DEFAULT_TAG_PRESETS.ledger],
      memo: [...DEFAULT_TAG_PRESETS.memo],
      topic: [...DEFAULT_TAG_PRESETS.topic],
    }
    const p = JSON.parse(raw) as Partial<TagPresets>
    const pick = (k: TagPresetKey, fallback: string[]) =>
      Array.isArray(p[k]) ? cleanTags(p[k]!) : [...fallback]
    return {
      project: pick('project', DEFAULT_TAG_PRESETS.project),
      ledger: pick('ledger', DEFAULT_TAG_PRESETS.ledger),
      memo: pick('memo', DEFAULT_TAG_PRESETS.memo),
      topic: pick('topic', DEFAULT_TAG_PRESETS.topic),
    }
  } catch {
    return {
      project: [...DEFAULT_TAG_PRESETS.project],
      ledger: [...DEFAULT_TAG_PRESETS.ledger],
      memo: [...DEFAULT_TAG_PRESETS.memo],
      topic: [...DEFAULT_TAG_PRESETS.topic],
    }
  }
}

export function setTagPresets(presets: TagPresets): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    project: cleanTags(presets.project),
    ledger: cleanTags(presets.ledger),
    memo: cleanTags(presets.memo),
    topic: cleanTags(presets.topic),
  }))
}

/** 還原單一類別為預設 */
export function resetTagPreset(key: TagPresetKey, presets: TagPresets): TagPresets {
  return { ...presets, [key]: [...DEFAULT_TAG_PRESETS[key]] }
}
