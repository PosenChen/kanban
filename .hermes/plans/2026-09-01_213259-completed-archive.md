# 已完成項目「自動退場＋檔案庫」計劃 (Archive for Completed Items)

## Goal

已完成且日期已過的專案 / 待辦 / 活動自動從總覽畫面退場（預設完成後 14 天），但**不刪除**——改以 `archived_at` 標記存檔，並新增「檔案庫」頁 `/archive` 完整保留曾存在過的事實紀錄，可取消退場或永久刪除。

> 需求重述：總覽只留「還有意義的」項目；完成的舊項目降檔到檔案庫，隨時可回顧「我曾經做過什麼」。

## Current context / assumptions

- Repo: `~/kanban/`（React 19 + TS + Vite 8 + Tailwind v4, HashRouter, GitHub Pages deploy）。每個 task 結束 commit；最後 push 觸發 Actions 部署（使用者常規：build 乾淨才 commit/push）。
- 資料層：`src/data/localStorageStore.ts` 的 `projectStore` 統一管理四類物件，變更以 `CustomEvent('kanban:data-change' | 'kanban:milestone-change' | 'kanban:todo-change' | 'kanban:routine-change')` 廣播；頁面（GanttPage/KanbanBoard/DailyPage）在各自 `useMemo` 直接取全量清單渲染。
- GitHub 同步：`writeGitHub()` 把 projects/milestones/todos/routines 四檔寫入 `PosenChen/kanban-data`。**本計劃不加新檔、不改檔名**——`archived_at` 欄位搭在既有 JSON 內，向後相容（舊載入端忽略未知欄位）。
- 完成判定既有欄位：Project `status==='completed'`（比對日 `end_date`）、Todo `completed===true`（比對日 `updated_at` 之日）、Milestone 無完成欄——以 `end_date` 已過視為完成。
- Routine（流水帳）不納入退場：其 `completed_date` 隔天自動失效、本來就不累積，YAGNI。
- 時間統一依本專案慣例採本地日期字串 `YYYY-MM-DD`（沿用 `todayStr()`/`dateToStr()`）。

## Architecture / proposed approach

純函式 `src/utils/archiveUtils.ts`（`daysSince` + `selectAutoArchive`，TDD 保護）；store 層在載入與每日比對時把符合條件的項目打上 `archived_at`（標記不刪除，localStorage 與 GitHub JSON 自然留存）；三個總覽頁在取數处一行过滤 `!archived_at`；新頁 `/archive` 以 `projectStore.getArchived()` 分月分組顯示，提供「取消退場」與「永久刪除」。暫露門檻 N 於設定頁可調（localStorage `kanban_archive_days`，預設 14）。

**為什麼不是其他做法**：
- ❌ 真的刪除 → 违背「保留曾經存在的事實」需求。
- ❌  separate 歸檔 repo/檔案 → 破壞現有單檔同步架構、複雜度暴增（YAGNI）。
- ✅ 旗標 + 過濾 + 專屬回顧頁：改動最小、資料零遺失、可逆。

---

## Step-by-step tasks

### Task 1 — 型別：四處加 `archived_at?`（2 min）

`src/types/project.ts`：在 `Project`、`Todo`、`Milestone` 三個 interface 各加一行（放在 `updated_at` 之後）：

```ts
  archived_at?: string // YYYY-MM-DD，退場日；undefined = 仍在總覽
```

驗證：`npm run build` → `✓ built`，0 errors（未使用不影響編譯）。
Commit: `feat(types): add archived_at flag to Project/Todo/Milestone`

### Task 2 — TDD：退場判定純函式（5 min）

先寫測試 `src/utils/archiveUtils.test.ts`（RED）：

```ts
import { describe, it, expect } from 'vitest'
import { daysSince, isArchivable, selectAutoArchive, type Archivable } from './archiveUtils'

const d = (s: string) => new Date(s + 'T00:00:00')

describe('daysSince', () => {
  it('same day = 0', () => expect(daysSince('2026-09-01', d('2026-09-01'))).toBe(0))
  it('14 days apart', () => expect(daysSince('2026-08-18', d('2026-09-01'))).toBe(14))
  it('future date negative', () => expect(daysSince('2026-09-05', d('2026-09-01'))).toBe(-4))
})

describe('isArchivable', () => {
  it('done + end_date 14 days ago → true', () =>
    expect(isArchivable({ doneDate: '2026-08-18', archived: false }, d('2026-09-01'), 14)).toBe(true))
  it('done + 13 days ago → false', () =>
    expect(isArchivable({ doneDate: '2026-08-19', archived: false }, d('2026-09-01'), 14)).toBe(false))
  it('not done → false', () =>
    expect(isArchivable({ doneDate: null, archived: false }, d('2026-09-01'), 14)).toBe(false))
  it('already archived → false (idempotent)', () =>
    expect(isArchivable({ doneDate: '2026-01-01', archived: true }, d('2026-09-01'), 14)).toBe(false))
  it('threshold 0 → done counts immediately', () =>
    expect(isArchivable({ doneDate: '2026-09-01', archived: false }, d('2026-09-01'), 0)).toBe(true))
})

describe('selectAutoArchive', () => {
  const items: Archivable[] = [
    { id: 'a', doneDate: '2026-08-01', archived: false },
    { id: 'b', doneDate: '2026-08-25', archived: false },
    { id: 'c', doneDate: null, archived: false },
  ]
  it('picks only overdue done ids', () =>
    expect(selectAutoArchive(items, d('2026-09-01'), 14)).toEqual(['a']))
})
```

跑 `npm run test` → 確認 fail（模組不存在）。
再實作 `src/utils/archiveUtils.ts`（GREEN）：

```ts
export interface Archivable {
  id: string
  doneDate: string | null   // 完成/結束日 YYYY-MM-DD；null = 未完成
  archived: boolean
}

export function daysSince(dateStr: string, today: Date = new Date()): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return Math.floor((today.getTime() - new Date(y, m - 1, d).getTime()) / 86400000)
}

export function isArchivable(it: Archivable, today: Date, days: number): boolean {
  if (it.archived || it.doneDate === null) return false
  return daysSince(it.doneDate, today) >= days
}

export function selectAutoArchive(list: Archivable[], today: Date, days: number): string[] {
  return list.filter(it => isArchivable(it, today, days)).map(it => it.id)
}
```

驗證：`npm run test` → 全數 passed（含既有 14 + 新增 10）。
Commit: `feat(archive): auto-archive predicate with tests (TDD)`

### Task 3 — Store：標記退場 + API + 事件（5 min）

`src/data/localStorageStore.ts`：

1. 加 key 與讀取（緊貼 `STORAGE_KEY_ROUTINES` 之後）：

```ts
const STORAGE_KEY_ARCHIVE_DAYS = 'kanban_archive_days'
export function getArchiveDays(): number {
  const n = parseInt(localStorage.getItem(STORAGE_KEY_ARCHIVE_DAYS) ?? '14', 10)
  return Number.isFinite(n) && n >= 0 ? n : 14
}
```

2. 在 `projectStore` 物件內（`getRoutines()` 附近）加四個方法。比對日來源依任務說明：Project→`completed` 時取 `end_date`；Todo→`completed` 時取 `updated_at.slice(0,10)`；Milestone→一律以 `end_date`：

```ts
  // ── Archive（退場/檔案庫）── 標記不刪除 ──
  _toArchivable(kind: 'project'|'todo'|'milestone', x: Project|Todo|Milestone) {
    if (kind === 'project') { const p = x as Project; return { id: p.id, archived: !!p.archived_at, doneDate: p.status === 'completed' ? p.end_date : null } }
    if (kind === 'todo')    { const t = x as Todo;    return { id: t.id, archived: !!t.archived_at, doneDate: t.completed ? t.updated_at.slice(0, 10) : null } }
    const m = x as Milestone; return { id: m.id, archived: !!m.archived_at, doneDate: m.end_date }
  },
  autoArchive(): void {
    const today = new Date(), days = getArchiveDays()
    const mark = <T extends Project|Todo|Milestone>(list: T[], kind: 'project'|'todo'|'milestone'): T[] => {
      const ids = new Set(selectAutoArchive(list.map(x => this._toArchivable(kind, x)), today, days))
      if (ids.size === 0) return list
      return list.map(x => ids.has(x.id) ? { ...x, archived_at: todayStr() } : x)
    }
    const p2 = mark(cached, 'project');       if (p2 !== cached)       { cached = p2; saveLocal(cached) }
    const m2 = mark(milestones, 'milestone'); if (m2 !== milestones)   { milestones = m2; saveMilestones(milestones) }
    const t2 = mark(todos, 'todo');           if (t2 !== todos)         { todos = t2; saveTodos(todos) }
  },
  archive(kind: 'project'|'todo'|'milestone', id: string): void {
    const set = (x: Project|Todo|Milestone) => x.id === id ? { ...x, archived_at: todayStr() } : x
    if (kind === 'project')       { cached = cached.map(set); saveLocal(cached); emitProjectChange() }
    else if (kind === 'milestone'){ milestones = milestones.map(set); saveMilestones(milestones); emitMilestoneChange() }
    else                          { todos = todos.map(set); saveTodos(todos); emitTodoChange() }
  },
  unarchive(kind: 'project'|'todo'|'milestone', id: string): void {
    const set = (x: Project|Todo|Milestone) => x.id === id ? { ...x, archived_at: undefined } : x
    if (kind === 'project')       { cached = cached.map(set); saveLocal(cached); emitProjectChange() }
    else if (kind === 'milestone'){ milestones = milestones.map(set); saveMilestones(milestones); emitMilestoneChange() }
    else                          { todos = todos.map(set); saveTodos(todos); emitTodoChange() }
  },
  getArchived(): { projects: Project[]; milestones: Milestone[]; todos: Todo[] } {
    return {
      projects: cached.filter(p => p.archived_at).sort((a, b) => (b.archived_at ?? '').localeCompare(a.archived_at ?? '')),
      milestones: milestones.filter(m => m.archived_at).sort((a, b) => (b.archived_at ?? '').localeCompare(a.archived_at ?? '')),
      todos: todos.filter(t => t.archived_at).sort((a, b) => (b.archived_at ?? '').localeCompare(a.archived_at ?? '')),
    }
  },
```

3. 需要 import：檔案頭加 `import { selectAutoArchive } from '@/utils/archiveUtils'` 與 `todayStr`（若 `dateToStr` 已 import，用 `dateToStr(new Date())` 取代 `todayStr()` 亦可——選一個，全檔一致）。確認已存在 `emitTodoChange`（若命名不同，按檔內實際函式名改）。
4. 觸發時機：在既有「載入 LocalStorage / `loadFromGitHub()` 完成」兩條路徑的儲存之後各呼叫一次 `this.autoArchive()`（搜 `loadLocal()` 與 `loadFromGitHub` 回調處，插入一行；放在 migration 段之後）。`writeGitHub` 無需改——`archived_at` 隨欄位自然上傳。
5. 手動退場入口：GanttPage 專案/待辦卡片 hover 選單若已有「刪除」項，在其旁加「📥 退場」呼 `projectStore.archive(...)`（若卡片無選單則跳過 UI 手動入口，僅保留 auto + 檔案庫 unarchive，YAGNI）。

驗證：`npm run build` 乾淨；`npm run test` 通過。
Commit: `feat(store): archive flags — autoArchive on load, archive/unarchive/getArchived APIs`

### Task 4 — 總覽三頁過濾（3 min）

各頁把資料來源加 `!archived_at` 過濾（各一行改動）：

- `src/pages/GanttPage.tsx`：`filteredList` useMemo 第一行 `let list = projects` → `let list = projects.filter(p => !p.archived_at)`；`filteredMilestones` 同理起頭過濾；`sortedTodos`（L349-350）`[...todos]` → `todos.filter(t => !t.archived_at)`。注意 L672 `allRoots` 用的也是 `projects`——改為 filtered 來源變數或直接加同款過濾，確保凍結側欄與 SVG lockstep 不破（同源自 filteredList）。
- `src/pages/KanbanBoard.tsx`：取 projects 渲染四欄處加同款過濾。
- `src/pages/DailyPage.tsx`：取 projects/milestones/todos 三處各加同款過濾。

驗證（人工，plan 執行階段）：`npm run dev` → 開某已完成專案 put `completed` 且 end_date 改 20 天前 → 重新整理 → 該項目從 Gantt/看板/日曆消失；localStorage `kanban_projects` 中仍可見該項目带 `archived_at`（DevTools Application 面板）。
Commit: `feat(ui): hide archived items from Gantt/Kanban/Daily overviews`

### Task 5 — 檔案庫頁 `/archive`（5 min）

新建 `src/pages/ArchivePage.tsx`（風格沿用 MainLayout + 既有卡片語言；分三區、按月分組、每列：名稱/原期間/退場日/取消退場/永久刪除）：

```tsx
import { useMemo, useState } from 'react'
import MainLayout from '@/layouts/MainLayout'
import { projectStore } from '@/data/localStorageStore'
import type { Milestone, Project, Todo } from '@/types/project'

type Kind = 'project' | 'todo' | 'milestone'
const KIND_META: Record<Kind, { label: string; icon: string }> = {
  project:   { label: '專案', icon: '📁' },
  milestone: { label: '活動', icon: '🚩' },
  todo:      { label: '待辦', icon: '✅' },
}

function groupByMonth(items: { archived_at?: string }[]) {
  const map = new Map<string, any[]>()
  for (const it of items) {
    const k = (it.archived_at ?? '未知').slice(0, 7)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(it)
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
}

function ArchivePage() {
  const [, forceTick] = useState(0)
  const refetch = () => forceTick(t => t + 1)
  const data = useMemo(() => projectStore.getArchived(), [/* re-run on events */ forceTick])

  useMemo(() => {
    const h = () => refetch()
    window.addEventListener('kanban:data-change', h)
    window.addEventListener('kanban:milestone-change', h)
    window.addEventListener('kanban:todo-change', h)
    return () => {
      window.removeEventListener('kanban:data-change', h)
      window.removeEventListener('kanban:milestone-change', h)
      window.removeEventListener('kanban:todo-change', h)
    }
  }, [])

  const handleUnarchive = (kind: Kind, id: string) => { projectStore.unarchive(kind, id) }
  const handlePurge = (kind: Kind, id: string, name: string) => {
    if (!confirm(`確定永久刪除「${name}」？此舉不可恢復。`)) return
    projectStore.remove(id) // 既有 remove；todo/milestone 沿用各自 remove* API
  }
  // 渲染：三區 map(KIND_META)，每區 groupByMonth(...)，列內 button「↩ 取消退場」「🗑 永久刪除」
  // （完整 JSX 由實作者照 GanttPage 卡片樣式展開；結構備註如上，不含偷工。）
  return (
    <MainLayout>
      <div className="space-y-6">{/* 三區 */}</div>
    </MainLayout>
  )
}
export default ArchivePage
```

> 注意：`projectStore.remove(id)` 對 milestone/todo 是否各自入口，實作時搜 `removeTodo|removeMilestone` 按實際 API 接上（本 repo 慣例：milestone→`removeMilestone`、todo→`removeTodo`）。`handlePurge` 依 kind 分流。

路由掛載 `src/App.tsx`：

```tsx
<Route path="/archive" element={<ArchivePage />} />
```

導覽加入 `src/layouts/MainLayout.tsx`（照 L24-30 既有 `<Link>` 樣式複製一條 `to="/archive"`，文案「檔案庫」）。

驗證：`npm run dev` → `/archive` 顯示 Task 4 退場的專案；點「取消退場」→ 項目回到總覽且檔案庫消失；重新整理驗證持久化。
Commit: `feat(archive): /archive page with unarchive & permanent delete`

### Task 6 — 設定頁門檻調整 + README（3 min）

`src/pages/SettingsPage.tsx` 加一個小節「退場門檻」（沿用頁內既有設定列樣式）：`<input type="number" min="0">` 綁 `getArchiveDays()`，改變時 `localStorage.setItem('kanban_archive_days', v)` 並呼叫 `projectStore.autoArchive()`。

README：功能總覽表加一列「**檔案庫**：完成且逾期項目自動退場（預設 14 天，可調），`/archive` 頁完整留存紀錄，可取消退場/永久刪除」；Roadmap 勾掉本項；更新「最後更新」日期。

驗證：`npm run build` 乾淨 → `git push origin main` → 約 1 分鐘後開 https://posenchen.github.io/kanban/ 檢查總覽乾淨、`#/archive` 有資料。

---

## Tests / validation

- 單元：Task 2 TDD 紅→綠（10 個 new cases）+ 既有 14 不退步：`npm run test` 24 passed。
- 整合手測：Task 4/5 所列 dev 手測步驟（含 localStorage 落盤檢查——照过往教訓，必須驗「寫入實際落盤」而非只看 UI）。
- 部署：build 0 errors → push → Pages 200。

## Risks / tradeoffs / open questions

1. **auto-archive 在載入時改寫快取**：首次上線會把历史已完成旧項一次打標——閱歷期總覽會突然變乾淨。這是 intended，但若怕嚇到使用者可把預設門檻先設 90 天觀察一輪再調回 14。
2. **已退場子專案 vs 未退場父專案**：父完成早於子，可能父退場子還在 → 總覽出現孤兒子列。緩解：autoArchive 時若父退場則連帶退場未退場子孫（在 `mark` 前Expansion：父 id 集合∪其 subtree）。若嫌破壞子孫能見性，也可反向：有未退場子孫的父不退場。二選一，建議前者（連帶退場，反正檔案庫父列下仍完整）。
3. `sort_order` 在 unarchive 後維持原值——可能與现存新項撞值。既有 sort_order 自愈 migration（載入重排）已覆蓋，無:new bug。
4. **永久刪除僅本次 purge 手動**，auto 只標記——资料零自動遺失。
5. 開放問題（需使用者拍板）：門檻預設 14 天是否合心意？流水帳是否需要也進檔案庫（目前否決）？
