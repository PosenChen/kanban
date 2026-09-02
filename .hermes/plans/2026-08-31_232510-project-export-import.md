# 專案匯出／匯入（JSON 模板 + Word 文件）

## Goal
在專案詳細頁（編輯畫面）加「匯出」選單：匯出含子樹的 JSON 模板（供隔年重複專案匯入 reuse）與 `.doc` Word 文件（辦公場合與同事交流），並讓匯入自動分配新 ID、重錨定日期。

## Current context / assumptions
Repo：`~/kanban/`（React 19 + TS + Vite 8 + Tailwind v4；vitest 已裝，`npm run test` 可跑；有 `@` → `src` alias）。

盤點到的現況（實作者零上下文也能上手）：
- **專案詳細頁** `src/pages/ProjectDetailPage.tsx`：action 列（第 116–147 行附近）有「編輯／複製／刪除」按鈕 — **匯出按鈕加在這裡**（使用者所稱「父專案的編輯畫面」；子專案匯出的子樹只有自己，天然不相衝）。
- **全域備份匯入** `src/pages/SettingsPage.tsx` 第 31–67 行已有 `handleImport()`（「📥 匯入 JSON」按鈕，第 234 行）：直接覆寫 localStorage。**匯入按鈕複用它**（需求 #4 由我規劃）：升級為自動偵測「模板格式」→ 走 append 合併而非覆寫；一般備份檔維持原覆寫行為。
- **store** `src/data/localStorageStore.ts`：`projectStore` 單字體，已有 `addProject`／`copyProject(id)`（回傳 `{project, childCount}`，做深層複製＋ID 重映射 — 匯入模板的 ID 重映射可借鏡其思路）。事件用 `emitProjectChange()` 派發 `kanban:project-change` 驅動重繪。
- **型別** `src/types/project.ts`：`Project { id, name, description, parent_id, sort_order, start_date, end_date, actual_start_date?, actual_end_date?, status, priority, tags, progress, created_at, updated_at }`。
- **dateUtils** `src/utils/dateUtils.ts`：有 `dateToStr(Date)`、`getDaysDiff(a,b)`。若缺 addDays 類函數，在 exportUtils 內自備（見 Task 2）。
- 無後端、零新增 npm 依賴原則（YAGNI）：Word 檔採 **MS-Word-compatible HTML 存成 `.doc`**（Office 長期支援的格式，直接開正確字型與表格），不引入 docx 套件库。

### 設計決策（模板語意，照做）
- **匯出範圍**：該專案＋全部子孫（遞迴圈 collect）。活動（milestones）不進模板（YAGNI，見開放問題 Q2）。
- **模板檔封裝**（偵測用）：
  ```json
  { "kind": "kanban-project-template", "version": 1,
    "exported_at": "ISO", "anchor_start": "YYYY-MM-DD",
    "projects": [ 含原 parent_id 的子樹（剥掉 id 欄位）... ] }
  ```
  projects 內**保留原 id 作為 `ref` 欄**供 parent_id 映射，不剥欄位以免複雜化：其實直接保留原 id＋parent_id，匯入時整批重新分配。
- **匯入行為**：每一筆都發新 id（`p` + base36，撞號重試）、parent_id 依 old→new 對照表重映射、掛為頂層（根專案 parent_id=null 保持 null）、sort_order 接到現有尾端。**日期重錨定**：`偏移 = 今日 − anchor_start`，每筆 `start_date/end_date`（含 actual_*）同日偏移 →「每年採購專案」隔年匯入自動落到新年度、相對工期不變。進度歸零、狀態保留（模板重複使用時通常要重新跑；保留狀態較不意外？——採**重置為 preparation、progress=0**，見開放問題 Q1）。

## Architecture / proposed approach
新增純函式檔 `src/utils/exportUtils.ts`（collect 子樹、模板組裝、ID 重映射＋日期偏移、Word HTML 產生 — 全部可測、無 DOM），TDD 保護核心邏輯。UI 兩處極薄：詳細頁「匯出 ▾」下拉（JSON 模板／Word 檔案，觸發 Blob 下載）；SettingsPage 的既有匯入升級為 `kind` 偵測分流，呼叫新增的 `projectStore.importTemplate()`。

---

## Step-by-step tasks

### Task 1 — 純函式：collectSubtree + buildTemplate（TDD）

**1a. 失敗測試** `src/utils/exportUtils.test.ts`：
```ts
import { describe, it, expect } from 'vitest'
import { collectSubtree, buildTemplate, remapAndShift } from './exportUtils'
import type { Project } from '@/types/project'

const P = (o: Partial<Project>): Project => ({
  id: 'p1', name: 'n', description: '', parent_id: null, sort_order: 0,
  start_date: '2026-01-01', end_date: '2026-01-31', status: 'preparation',
  priority: 'medium', tags: [], progress: 0, created_at: '', updated_at: '', ...o,
})
const tree: Project[] = [
  P({ id: 'root', name: '年度採購', start_date: '2026-03-01', end_date: '2026-03-31' }),
  P({ id: 'c1', parent_id: 'root', name: '發包', start_date: '2026-03-05', end_date: '2026-03-10' }),
  P({ id: 'c2', parent_id: 'c1', name: '核可', start_date: '2026-03-08', end_date: '2026-03-09' }),
  P({ id: 'other', name: '無關專案', start_date: '2026-05-01', end_date: '2026-05-05' }),
]

describe('collectSubtree', () => {
  it('收集根＋所有子孫，深度排序（父在子前）', () => {
    expect(collectSubtree(tree, 'root').map(p => p.id)).toEqual(['root', 'c1', 'c2'])
  })
  it('葉節點只回自己', () => {
    expect(collectSubtree(tree, 'other').map(p => p.id)).toEqual(['other'])
  })
})

describe('buildTemplate', () => {
  it('封裝 kind/version/anchor/projects', () => {
    const t = buildTemplate(tree, 'root', new Date(2026, 7, 31))
    expect(t.kind).toBe('kanban-project-template')
    expect(t.version).toBe(1)
    expect(t.anchor_start).toBe('2026-03-01') // 子樹最小 start_date
    expect(t.projects.map(p => p.id)).toEqual(['root', 'c1', 'c2'])
  })
})

describe('remapAndShift', () => {
  it('全部新 ID、parent 映射正確、日期偏移 365 天、狀態重置', () => {
    const t = buildTemplate(tree, 'root', new Date(2026, 7, 31))
    const now = new Date(2027, 7, 31) // anchor 2026-03-01 → 偏移 depend on today-anchor
    const out = remapAndShift(t, now)
    expect(out.length).toBe(3)
    const ids = new Set(out.map(p => p.id))
    expect(ids.has('root')).toBe(false) // 全新 id
    const root = out.find(p => p.name === '年度採購')!
    const c1 = out.find(p => p.name === '發包')!
    expect(c1.parent_id).toBe(root.id)
    // 偏移 = 2027-08-31 − 2026-03-01 = 548 天
    expect(root.start_date).toBe('2027-08-31')
    expect(c1.end_date).toBe('2027-09-09')
    expect(root.status).toBe('preparation')
    expect(root.progress).toBe(0)
    expect(root.parent_id).toBe(null)
  })
})
```

**1b. 驗證失敗**：
```bash
cd ~/kanban && npx vitest run src/utils/exportUtils.test.ts
```
預期：FAIL（Cannot find module './exportUtils'）。

**1c. 實作** `src/utils/exportUtils.ts`：
```ts
import type { Project } from '@/types/project'
import { dateToStr } from '@/utils/dateUtils'

// ── 模板封裝 ──
export interface ProjectTemplate {
  kind: 'kanban-project-template'
  version: 1
  exported_at: string
  anchor_start: string
  projects: Project[]
}

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

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}
function parseYMD(s: string): Date {
  const [y, m, dd] = s.split('-').map(Number)
  return new Date(y, m - 1, dd)
}
function daysBetween(from: string, to: Date): number {
  return Math.round((to.getTime() - parseYMD(from).getTime()) / 86400000)
}

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

/** 匯入核心：新 ID、parent 重映射、日期重錨定到 today、狀態重置 */
export function remapAndShift(t: ProjectTemplate, today: Date = new Date()): Project[] {
  const offset = daysBetween(t.anchor_start, today)
  const idMap = new Map<string, string>()
  // 先分配全部新 id（避免映射過程中撞到既有）
  t.projects.forEach(p => {
    let nid = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    while ([...idMap.values()].includes(nid)) nid += 'x'
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

/** MS-Word-compatible HTML（存成 .doc 可直接用 Word/WPS 開） */
export function buildWordHtml(root: Project, subtree: Project[]): string {
  const rows = subtree.map(p => {
    const indent = p.parent_id && p.parent_id !== root.id ? '&nbsp;&nbsp;&nbsp;&nbsp;' : ''
    return `<tr><td>${indent}${p.name}</td><td>${p.start_date}</td><td>${p.end_date}</td><td>${p.progress}%</td><td>${p.priority}</td></tr>`
  }).join('\n      ')
  return `\ufeff<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>${root.name}</title></head>
<body style="font-family:'Microsoft JhengHei',sans-serif">
  <h1>${root.name}</h1>
  <p>期間：${root.start_date} ～ ${root.end_date}　優先級：${root.priority}　進度：${root.progress}%</p>
  ${root.description ? `<p>${root.description}</p>` : ''}
  ${root.tags.length ? `<p>標籤：${root.tags.map(t => `#${t}`).join('  ')}</p>` : ''}
  <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse">
    <tr><th>專案</th><th>開始</th><th>結束</th><th>進度</th><th>優先級</th></tr>
      ${rows}
  </table>
</body></html>`
}

/** 瀏覽器下載觸發（JSON/Word 共用） */
export function downloadBlob(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```
> 注意：本檔含 `downloadBlob`（DOM）— 測試只測純函數；vitest 預設 environment=node 不會載入它，無妨。

**1d. 驗證通過**：
```bash
cd ~/kanban && npx vitest run src/utils/exportUtils.test.ts
```
預期：PASS（5 tests）。若 `remapAndShift` 日期斷言失敗，先確認 `daysBetween('2026-03-01', new Date(2027,7,31))===548` 再調試算，**不可改測試遷就實作**。

**Commit**：`git add src/utils/exportUtils.ts src/utils/exportUtils.test.ts && git commit -m "feat(export): template collect/build/remap+shift + word html builder (TDD)"`

---

### Task 2 — store：importTemplate
檔案 `src/data/localStorageStore.ts`。在 `projectStore` 內（`removeTodo` 之後、Routine CRUD 之前的任何穩固位置）加：
```ts
  /** 匯入專案模板：新 ID、日期重錨定今日、附加到尾端 */
  importTemplate(t: import('@/utils/exportUtils').ProjectTemplate): Project[] {
    const newProjects = remapAndShift(t)
    // sort_order 接尾（根專案層）
    const maxSort = cached.reduce((m, p) => Math.max(m, p.sort_order ?? 0), -1)
    let rootIdx = 0
    newProjects.forEach(p => {
      if (p.parent_id === null) { p.sort_order = maxSort + 1 + (rootIdx++) }
    })
    cached = [...cached, ...newProjects]
    saveLocal(cached)
    emitProjectChange()
    return newProjects
  },
```
檔頭加 import：`import { remapAndShift } from '@/utils/exportUtils'`（並確認 `saveLocal`／`emitProjectChange` 已存在——兩者均已存在）。

驗證：`npm run build` → `✓ built`，0 errors。
**Commit**：`git add src/data/localStorageStore.ts && git commit -m "feat(store): importTemplate with id remap + date re-anchor"`

---

### Task 3 — 詳細頁「匯出 ▾」按鈕
檔案 `src/pages/ProjectDetailPage.tsx`（在 action 列「複製」按鈕之後、「刪除」之前插入，見第 136 行附近的 `</button>`）：
```tsx
{/* 匯出下拉 */}
<div className="relative">
  <button
    onClick={() => setShowExportMenu(v => !v)}
    className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-200"
  >
    匯出 ▾
  </button>
  {showExportMenu && (
    <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-30 overflow-hidden">
      <button
        onClick={() => {
          const tpl = buildTemplate(getAll(), id, new Date())
          downloadBlob(`${project.name}-專案模板.json`, JSON.stringify(tpl, null, 2), 'application/json')
          setShowExportMenu(false)
        }}
        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        📤 JSON 模板（含子專案）
      </button>
      <button
        onClick={() => {
          const sub = collectSubtree(getAll(), id)
          downloadBlob(`${project.name}.doc`, buildWordHtml(project, sub), 'application/msword')
          setShowExportMenu(false)
        }}
        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        📄 Word 文件 (.doc)
      </button>
    </div>
  )}
</div>
```
加 state：`const [showExportMenu, setShowExportMenu] = useState(false)`；加 import：
`import { buildTemplate, collectSubtree, buildWordHtml, downloadBlob } from '@/utils/exportUtils'`
（`getAll` 已在第 14 行由 `useProjects()` 取得）。

驗證：`npm run build` → 0 errors。
**Commit**：`git add src/pages/ProjectDetailPage.tsx && git commit -m "feat(ui): export menu (JSON template / Word doc) on project detail page"`

---

### Task 4 — 匯入升級：模板偵測分流
檔案 `src/pages/SettingsPage.tsx` `handleImport()`：在 `const data = JSON.parse(...)` 之後、既有覆寫邏輯之前插入分流：
```ts
          if (isProjectTemplate(data)) {
            const roots = data.projects.filter(p => !p.parent_id).length
            const msg = `匯入模板「${data.projects[0].name}」？\n共 ${data.projects.length} 個專案（頂層 ${roots} 個），日期將重錨定為今天起算。\n（附加到現有資料，不會覆蓋）`
            if (!confirm(msg)) return
            const added = projectStore.importTemplate(data)
            alert(`已匯入 ${added.length} 個專案`)
            return
          }
```
檔頭 import 加 `isProjectTemplate`：`import { isProjectTemplate } from '@/utils/exportUtils'`。
按鈕維持既有「📥 匯入 JSON」（重載入繞 `window.location.reload()` 不在此佈條件顯示；需加 `window.location.reload()` 於 `alert` 之後以刷新列表 — `emitProjectChange` 已驅動重繪，但若頁面初始載入僅一次則需 reload。保守起見：`alert` 後加 `window.location.reload()`）。

驗證：`npm run build` → 0 errors。
**Commit**：`git add src/pages/SettingsPage.tsx && git commit -m "feat(import): detect project-template JSON, append with re-anchored dates"`

---

### Task 5 — 端到端驗證 + 部署
```bash
cd ~/kanban && npm run test && npm run build
```
預期：tests 全過（新增 5＋既有 9）、build 0 errors。

手動（`npm run dev` + 瀏覽器 http://localhost:5173）：
1. 開一個父專案詳細頁 → 「匯出 ▾」→ JSON 模板：確認下載檔內容含 `kind:"kanban-project-template"`、anchor_start、含子樹。
2. 同畫面匯出 Word：確認 `.doc` 檔可用文字編輯器看到 HTML、Word 開檔有表格。
3. 設定頁「匯入 JSON」選剛下載的模板 → confirm 顯示筆數＋「重錨定今天」→ 確定後總覽出現新專案樹、日期錨在今天起算、原模板專案不受影響。
4. `git push origin main` → GitHub Actions 部署 → 開 https://posenchen.github.io/kanban/ 抽檢匯出按鈕存在（匯入/匯出純前端，不測雲端寫入）。

**Commit**：依慣例若需重建 dist：`git add -A && git commit -m "chore: rebuild dist"`（若 dist 不入版控則跳過）。

---

## Risks / tradeoffs / open questions
- **Q1 匯入後狀態**：採重置 `preparation`／progress=0（模板重用場景直覺）。若你想原封保留原進度狀態，刪 `remapAndShift` 內兩行即可。
- **Q2 活動/流水帳入模板**：本次僅專案樹。「每年採購」若綁固定活動（如「3/15 開標」），模板應否含 milestones？建議下一輪再加（milestones 同 offset shift 機制可直接复用）。
- **`.doc` 格式**：MS-Word-HTML 法零依賴、Word/WPS/LibreOffice 都能開且可編輯；非真 OOXML `.docx`。若需 `.docx`（如 Wor預設格式严格要求）須引入 `docx` npm 套件，另開任務。
- **檔名特殊字元**：專案名含 `/` 等檔名字禁字會使下載異常—可在 `downloadBlob` 內 `filename.replace(/[\\/:*?"<>|]/g, '_')`（一行，建議一併做）。
- **覆寫 vs 附加**：模板走附加（安全）；既有全備份仍覆寫（原行為不變）。使用者若誤匯同模板兩次會收到兩份—BY DESIGN，刪除即可。
