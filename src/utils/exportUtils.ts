import type { Project } from '@/types/project'
import { dateToStr } from '@/utils/dateUtils'

// ── 專案模板（供「每年固定專案」重複使用）──

export interface ProjectTemplate {
  kind: 'kanban-project-template'
  version: 1
  exported_at: string
  anchor_start: string
  projects: Project[]
}

/** 收集 root 及其所有子孫，父在子前（深度優先） */
export function collectSubtree(all: Project[], rootId: string): Project[] {
  const out: Project[] = []
  const walk = (id: string) => {
    const p = all.find(x => x.id === id)
    if (!p) return
    out.push(p)
    all.filter(c => c.parent_id === id).forEach(c => walk(c.id))
  }
  walk(rootId)
  return out
}

function parseYMD(s: string): Date {
  const [y, m, dd] = s.split('-').map(Number)
  return new Date(y, m - 1, dd)
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

function daysBetween(from: string, to: Date): number {
  return Math.round((to.getTime() - parseYMD(from).getTime()) / 86400000)
}

/** 由專案子樹組裝模板；anchor_start = 子樹最早開始日期 */
export function buildTemplate(all: Project[], rootId: string, now: Date = new Date()): ProjectTemplate {
  const subtree = collectSubtree(all, rootId)
  const anchor = subtree.reduce((min, p) => (p.start_date < min ? p.start_date : min), subtree[0].start_date)
  return {
    kind: 'kanban-project-template',
    version: 1,
    exported_at: now.toISOString(),
    anchor_start: anchor,
    projects: subtree,
  }
}

/**
 * 匯入核心：全部發新 ID、parent_id 依映射重掛、
 * 日期依 (today − anchor_start) 整體偏移（相對工期不變）、
 * 狀態重置 preparation／進度歸零（使用者確認 20260831）。
 */
export function remapAndShift(t: ProjectTemplate, today: Date = new Date()): Project[] {
  const offset = daysBetween(t.anchor_start, today)
  const idMap = new Map<string, string>()
  const taken = new Set<string>()
  t.projects.forEach(p => {
    let nid = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    while (taken.has(nid)) nid += 'x'
    taken.add(nid)
    idMap.set(p.id, nid)
  })
  const shift = (s?: string) => (s ? dateToStr(addDays(parseYMD(s), offset)) : s)
  const now = today.toISOString()
  return t.projects.map(p => ({
    ...p,
    id: idMap.get(p.id)!,
    parent_id: p.parent_id ? (idMap.get(p.parent_id) ?? null) : null,
    start_date: shift(p.start_date)!,
    end_date: shift(p.end_date)!,
    actual_start_date: shift(p.actual_start_date),
    actual_end_date: shift(p.actual_end_date),
    status: 'preparation',
    progress: 0,
    created_at: now,
    updated_at: now,
  }))
}

export function isProjectTemplate(data: unknown): data is ProjectTemplate {
  return !!data && typeof data === 'object'
    && (data as ProjectTemplate).kind === 'kanban-project-template'
    && Array.isArray((data as ProjectTemplate).projects)
    && (data as ProjectTemplate).projects.length > 0
}

/** MS-Word-compatible HTML（存成 .doc，Word/WPS/LibreOffice 皆可開） */
export function buildWordHtml(root: Project, subtree: Project[]): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const statusLabel: Record<string, string> = { preparation: '準備中', waiting: '等待中', in_progress: '進行中', completed: '已完成' }
  const prioLabel: Record<string, string> = { high: '高', medium: '中', low: '低' }
  // 深度縮排：根 0、直接子 1、孫 2...
  const depthOf = (id: string): number => {
    let d = 0
    let cur = subtree.find(p => p.id === id)
    while (cur && cur.parent_id && cur.parent_id !== root.id) {
      d++
      cur = subtree.find(p => p.id === cur!.parent_id)
    }
    if (cur && cur.id !== root.id && cur.parent_id === root.id) d++
    return d
  }
  const rows = subtree.map(p => {
    const indent = p.id === root.id ? '<b>' : '　'.repeat(depthOf(p))
    const close = p.id === root.id ? '</b>' : ''
    return `<tr><td>${indent}${esc(p.name)}${close}</td><td>${p.start_date}</td><td>${p.end_date}</td><td>${p.progress}%</td><td>${prioLabel[p.priority] || p.priority}</td><td>${statusLabel[p.status] || p.status}</td></tr>`
  }).join('\n      ')
  return `\ufeff<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>${esc(root.name)}</title></head>
<body style="font-family:'Microsoft JhengHei','PingFang TC',sans-serif">
  <h1>${esc(root.name)}</h1>
  <p>期間：${root.start_date} ～ ${root.end_date}　優先級：${prioLabel[root.priority] || root.priority}　進度：${root.progress}%</p>
  ${root.description ? `<p>${esc(root.description)}</p>` : ''}
  ${root.tags.length ? `<p>標籤：${root.tags.map(t => `#${esc(t)}`).join('  ')}</p>` : ''}
  <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse">
    <tr><th>專案</th><th>開始</th><th>結束</th><th>進度</th><th>優先級</th><th>狀態</th></tr>
      ${rows}
  </table>
</body></html>`
}

/** 瀏覽器觸發下載（檔名過濾禁字元） */
export function downloadBlob(filename: string, content: string, mime: string): void {
  const safe = filename.replace(/[\\/:*?"<>|]/g, '_')
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = safe
  a.click()
  URL.revokeObjectURL(url)
}
