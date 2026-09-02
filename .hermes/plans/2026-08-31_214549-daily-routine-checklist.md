# 每日流水帳（Daily Routine Checklist）

## Goal
在 Kanban 總覽頁新增「流水帳」功能：一組由**條件觸發**（星期幾／幾號／今日標籤）的重複性小提醒，以每日自動重置的 checklist 呈现，並可編輯觸發條件。

## Current context / assumptions
Repo：`~/kanban/`（React 19 + TS + Vite 8 + Tailwind v4，HashRouter，GitHub Pages 部署）。
- **資料型別**：`src/types/project.ts`。目前 `QUICK_TAGS = ['工作','採購','上課','會議','研究','考試']` 已存在（第 71 行附近），沿用。
- **持久化**：`src/data/localStorageStore.ts`。模式為「模組層級陣列 + `saveX()`/`loadX()` + `emitXChange()` 派發 `CustomEvent` + 匯出的 `projectStore` 單字體負責 CRUD」。GitHub 同步用 `writeGitHubFile`/`readGitHubFile`，路徑常數在檔頭（`data/projects.json` / `milestones.json` / `todos.json`）。
- **總覽頁工具列**：`src/pages/GanttPage.tsx` ~第 748–800 行有「新增／活動／待辦」三個按鈕（`.flex items-center gap-2`），新增按鈕照此樣式插入。
- **彈窗樣式**：GanttPage 內「活動」彈窗用 `fixed inset-0 z-50 ... bg-black/50`（~第 1296 行起），流水帳彈窗照同一結構。
- **無測試框架**：`package.json` scripts 只有 `dev`/`build`/`preview`，無 vitest/jest。本計畫會新增 **vitest**（僅 devDependency）來對純函式做 TDD；UI 以 `npm run build` + 手動驗證。⚠️ 見「開放問題」——若不想引入測試框架，可跳過所有測試步驟，但仍建議保留純函式拆分。

### 條件觸發語意（設計決策，需實作者嚴格照做）
一個流水帳項目 `Routine` 是否「今日出現」：
- **同一維度內 = OR**：`weekdays=[1,2]` → 星期一或星期二都觸發（符合需求 #3）。
- **跨維度 = AND**：若一個項目同時設了 weekdays 與 tags，則「是星期X **且** 今日有該標籤活動」才出現（較可預測；若要跨維度 OR 見開放問題 Q1）。
- **多項目各自獨立評估**：不同項目滿足不同條件時**都要出現**（符合需求 #4）——filter 天然滿足。
- **空條件 = 每天出現**：某項目三個維度都空 → 天天提醒（適合「上班打卡」類基準流水帳）。
- **勾選狀態每日重置**：用 `completed_date === 今日(YYYY-MM-DD)` 判斷是否已勾，隔天自動變未勾。

## Architecture / proposed approach
新增 `Routine` 型別與一套**純函式** `src/utils/routineUtils.ts`（條件匹配 + 今日勾選判斷，可單元測試）。持久化沿用 store 模式新增 `kanban_routines` key 與 `data/routines.json` GitHub 同步。UI 在 GanttPage 加「流水帳」按鈕開啟彈窗：上半部今日 checklist（勾選），下半部「編輯模式」可增修刪項目與觸發條件（星期 chips／日期輸入／標籤 chips）。

---

## Step-by-step tasks

### Task 0 — 新增 vitest（測試基礎設施）
`package.json` devDependencies 加 vitest，scripts 加 `test`。

修改 `~/kanban/package.json`：
- devDependencies 內加入 `"vitest": "^3.0.0"`
- scripts 內加入 `"test": "vitest run"`

指令：
```bash
cd ~/kanban
npm install
```
預期：`package-lock.json` 更新，無錯誤。

驗證 vitest 可用：
```bash
cd ~/kanban && npx vitest --version
```
預期：印出 `3.x.x`。

Commit：
```bash
git add package.json package-lock.json && git commit -m "chore: add vitest for unit tests"
```

---

### Task 1 — `Routine` 型別
檔案：`~/kanban/src/types/project.ts`（加在 `QUICK_TAGS` 之後）

```ts
// ── Daily Routine (流水帳) ──
export interface Routine {
  id: string
  name: string
  weekdays: number[]      // 0=日 1=一 ... 6=六；空=不限制星期
  monthDays: number[]     // 1..31；空=不限制日期
  tags: string[]          // 今日活動含任一標籤才觸發；空=不限制標籤
  sort_order: number
  completed_date?: string // YYYY-MM-DD，最後勾選日；隔天自動失效
  created_at: string
  updated_at: string
}

// 星期顯示（index 0..6）
export const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']
```

驗證：
```bash
cd ~/kanban && npx tsc --noEmit -p tsconfig.json 2>&1 | head
```
預期：無新增錯誤（型別尚未被使用不影響 tsc）。

Commit：`git add src/types/project.ts && git commit -m "feat(types): add Routine + WEEKDAY_LABELS"`

---

### Task 2 — 純匹配邏輯（TDD）

#### 2a. 先寫失敗測試
檔案：`~/kanban/src/utils/routineUtils.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { matchesToday, getActiveRoutines, isDoneToday, todayStr } from './routineUtils'
import type { Routine } from '@/types/project'

const base = (o: Partial<Routine>): Routine => ({
  id: 'r1', name: 'x', weekdays: [], monthDays: [], tags: [],
  sort_order: 0, created_at: '', updated_at: '', ...o,
})

describe('matchesToday', () => {
  // 2026-08-31 是星期一(weekday=1)，date=31
  const mon31 = new Date(2026, 7, 31)
  it('空條件 → 每天出現', () => {
    expect(matchesToday(base({}), mon31, new Set())).toBe(true)
  })
  it('weekdays 維度內 OR', () => {
    expect(matchesToday(base({ weekdays: [1, 2] }), mon31, new Set())).toBe(true)
    expect(matchesToday(base({ weekdays: [2, 3] }), mon31, new Set())).toBe(false)
  })
  it('跨維度 AND：星期符合但標籤不符 → false', () => {
    const r = base({ weekdays: [1], tags: ['開會'] })
    expect(matchesToday(r, mon31, new Set(['開會']))).toBe(true)
    expect(matchesToday(r, mon31, new Set(['工作']))).toBe(false)
  })
  it('monthDays 維度：1 號觸發', () => {
    const first = new Date(2026, 8, 1) // 2026-09-01
    expect(matchesToday(base({ monthDays: [1] }), first, new Set())).toBe(true)
    expect(matchesToday(base({ monthDays: [1] }), mon31, new Set())).toBe(false)
  })
})

describe('getActiveRoutines', () => {
  // 需求 #4：1 號 rules + 星期二 rules 同時出現（今日 = 星期二且 1 號）
  const tueFirst = new Date(2026, 8, 1) // 2026-09-01 = 星期二 weekday=2
  const rDay1 = base({ id: 'd1', weekdays: [], monthDays: [1], sort_order: 0 })
  const rTue = base({ id: 't2', weekdays: [2], sort_order: 1 })
  const rWed = base({ id: 'w3', weekdays: [3], sort_order: 2 })
  it('多個規則滿足不同條件時都出現，依 sort_order 排序', () => {
    const out = getActiveRoutines([rWed, rTue, rDay1], tueFirst, new Set())
    expect(out.map(r => r.id)).toEqual(['d1', 't2']) // rWed(三) 被排除
  })
})

describe('isDoneToday', () => {
  it('completed_date === 今日 → 已勾；隔天自動未勾', () => {
    const d = '2026-08-31'
    expect(isDoneToday(base({ completed_date: d }), d)).toBe(true)
    expect(isDoneToday(base({ completed_date: '2026-08-30' }), d)).toBe(false)
    expect(isDoneToday(base({}), d)).toBe(false)
  })
})

describe('todayStr', () => {
  it('回傳 YYYY-MM-DD', () => {
    expect(todayStr(new Date(2026, 7, 31))).toBe('2026-08-31')
  })
})
```

#### 2b. 執行驗證失敗
```bash
cd ~/kanban && npx vitest run src/utils/routineUtils.test.ts
```
預期：**FAIL**（`Cannot find module './routineUtils'`）。

#### 2c. 實作最小實作
檔案：`~/kanban/src/utils/routineUtils.ts`

```ts
import type { Routine } from '@/types/project'

export function todayStr(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 單个项目今日是否出現：維度內 OR、跨維度 AND、空維度=不限制 */
export function matchesToday(r: Routine, today: Date, todayTags: Set<string>): boolean {
  const wkOK = r.weekdays.length === 0 || r.weekdays.includes(today.getDay())
  const mdOK = r.monthDays.length === 0 || r.monthDays.includes(today.getDate())
  const tagOK = r.tags.length === 0 || r.tags.some(t => todayTags.has(t))
  return wkOK && mdOK && tagOK
}

export function getActiveRoutines(routines: Routine[], today: Date, todayTags: Set<string>): Routine[] {
  return routines
    .filter(r => matchesToday(r, today, todayTags))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
}

export function isDoneToday(r: Routine, today: string): boolean {
  return r.completed_date === today
}
```

#### 2d. 執行驗證通過
```bash
cd ~/kanban && npx vitest run src/utils/routineUtils.test.ts
```
預期：**PASS**（6 tests passed）。

Commit：`git add src/utils/routineUtils.ts src/utils/routineUtils.test.ts && git commit -m "feat(routine): condition matcher + done logic with unit tests"`

---

### Task 3 — 持久化 + store CRUD
檔案：`~/kanban/src/data/localStorageStore.ts`

3a. 檔頭 import 型別加 `Routine`：
```ts
import type { Project, Milestone, Todo, Routine } from '@/types/project'
```

3b. 在 `STORAGE_KEY_COLOR_BY_PRIORITY`（第 10 行附近）下方加常數：
```ts
const STORAGE_KEY_ROUTINES = 'kanban_routines'
```

3c. 在 `GITHUB_TODOS_PATH`（第 19 行）下方加：
```ts
const GITHUB_ROUTINES_PATH = 'data/routines.json'
```

3d. load/save（加在 `saveTodos` 之後，~第 50 行附近，照 `saveMilestones` 風格）：
```ts
// ── Routine local storage ──
function loadRoutines(): Routine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ROUTINES)
    if (!raw) return []
    return JSON.parse(raw) as Routine[]
  } catch {
    return []
  }
}
function saveRoutines(routines: Routine[]): void {
  localStorage.setItem(STORAGE_KEY_ROUTINES, JSON.stringify(routines))
}
```

3e. 模組層級狀態陣列：找到現有 `let milestones: Milestone[]`／`let todos: Todo[]` 宣告處，旁邊加：
```ts
let routines: Routine[] = loadRoutines()
```

3f. emit（加在 `emitTodoChange` 之後，~第 303 行）：
```ts
function emitRoutineChange() {
  window.dispatchEvent(new CustomEvent('kanban:routine-change', { detail: routines }))
}
```

3g. `projectStore` 內加 CRUD（加在 `removeTodo` 之後，~第 600 行）：
```ts
  // ── Routine CRUD ──
  addRoutine(data: Omit<Routine, 'id' | 'created_at' | 'updated_at' | 'sort_order'>): Routine {
    const now = new Date().toISOString()
    const newRoutine: Routine = {
      ...data,
      sort_order: routines.length,
      id: `r${Date.now().toString(36)}`,
      created_at: now,
      updated_at: now,
    }
    routines = [...routines, newRoutine]
    saveRoutines(routines)
    emitRoutineChange()
    return newRoutine
  },
  getRoutines(): Routine[] { return routines },
  updateRoutine(id: string, updates: Partial<Routine>): Routine | undefined {
    const idx = routines.findIndex(r => r.id === id)
    if (idx === -1) return undefined
    const updated = { ...routines[idx], ...updates, updated_at: new Date().toISOString() }
    routines[idx] = updated
    saveRoutines(routines)
    emitRoutineChange()
    return updated
  },
  removeRoutine(id: string): boolean {
    const idx = routines.findIndex(r => r.id === id)
    if (idx === -1) return false
    routines = routines.filter(r => r.id !== id)
    saveRoutines(routines)
    emitRoutineChange()
    return true
  },
  toggleRoutineDone(id: string, today: string): void {
    const r = routines.find(x => x.id === id)
    if (!r) return
    // 已勾→取消；未勾→設為今天
    this.updateRoutine(id, { completed_date: r.completed_date === today ? undefined : today })
  },
```

3h. GitHub 同步：找到 `syncToGitHub`（~第 137–145 行，依序 `writeGitHubFile` projects/milestones/todos），在其後加一行：
```ts
  await writeGitHubFile(token, GITHUB_ROUTINES_PATH, routines)
```
找到 `loadFromGitHub`（~第 640 行），在它讀取 milestones/todos 之處比照加入讀取，並在載入後 `routines = ...; saveRoutines(routines)`。若 `loadFromGitHub` 只回傳 projects、由外部各自呼叫 `readGitHubMilestones`／`readGitHubTodos`，則新增：
```ts
export async function readGitHubRoutines(token: string): Promise<Routine[]> {
  return readGitHubFile(token, GITHUB_ROUTINES_PATH) as Promise<Routine[]>
}
```
並在 App／Settings 載入處呼叫它設定 routines（與現有讀 todos 的位置對稱）。

驗證：
```bash
cd ~/kanban && npm run build 2>&1 | tail -3
```
預期：`✓ built in ...ms`，0 errors。

Commit：`git add src/data/localStorageStore.ts && git commit -m "feat(routine): store CRUD + localStorage + GitHub sync"`

---

### Task 4 — 總覽頁「流水帳」按鈕
檔案：`~/kanban/src/pages/GanttPage.tsx`（工具列，「待辦」按鈕 ~第 793 行之後插入）

```tsx
<button
  onClick={openRoutineModal}
  className="flex items-center gap-1 px-3 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-medium border border-amber-600 transition-colors"
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
  流水帳
</button>
```

Commit（連同 Task 5 状態一起）見下。

---

### Task 5 — 流水帳彈窗（今日 checklist + 編輯）
檔案：`~/kanban/src/pages/GanttPage.tsx`

5a. import：加 `Routine`, `WEEKDAY_LABELS`, `QUICK_TAGS`（加到現有 `@/types/project` import），以及 `import { getActiveRoutines, isDoneToday, todayStr } from '@/utils/routineUtils'`。

5b. state（加在 activity state ~第 403 行之後）：
```tsx
const [showRoutineModal, setShowRoutineModal] = useState(false)
const [routineEditMode, setRoutineEditMode] = useState(false)
const [routines, setRoutines] = useState<Routine[]>(() => projectStore.getRoutines())
// 編輯中的單筆（新增=null）
const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null)
const [rName, setRName] = useState('')
const [rWeekdays, setRWeekdays] = useState<number[]>([])
const [rMonthDays, setRMonthDays] = useState('') // "1,15" 之类
const [rTags, setRTags] = useState<string[]>([])
const today = todayStr()
```

5c. 今日標籤集合（今日milestone的tags）：
```tsx
const todayTags = useMemo(() => {
  const s = new Set<string>()
  milestones.forEach(m => {
    if (m.start_date <= today && (m.end_date || m.start_date) >= today) m.tags.forEach(t => s.add(t))
  })
  return s
}, [milestones, today])

const activeRoutines = useMemo(() => getActiveRoutines(routines, new Date(), todayTags), [routines, todayTags])
```

5d. 訂閱 store 更新（照現有 `kanban:milestone-change` 樣式 ~第 250 行）：
```tsx
useEffect(() => {
  const h = (e: Event) => setRoutines((e as CustomEvent).detail as Routine[])
  window.addEventListener('kanban:routine-change', h)
  return () => window.removeEventListener('kanban:routine-change', h)
}, [])
```

5e. handler：
```tsx
const openRoutineModal = useCallback(() => {
  setRoutineEditMode(false); setEditingRoutine(null)
  setRoutines(projectStore.getRoutines())
  setShowRoutineModal(true)
}, [])
const openAddRoutine = useCallback(() => {
  setEditingRoutine(null); setRName(''); setRWeekdays([]); setRMonthDays(''); setRTags([])
}, [])
const openEditRoutine = useCallback((r: Routine) => {
  setEditingRoutine(r); setRName(r.name); setRWeekdays(r.weekdays)
  setRMonthDays(r.monthDays.join(',')); setRTags(r.tags)
  setRoutineEditMode(true)
}, [])
const saveRoutine = useCallback(() => {
  if (!rName.trim()) return
  const monthDays = rMonthDays.split(/[,，]/).map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n >= 1 && n <= 31)
  const payload = { name: rName.trim(), weekdays: rWeekdays, monthDays, tags: rTags }
  if (editingRoutine) projectStore.updateRoutine(editingRoutine.id, payload)
  else projectStore.addRoutine(payload)
  setEditingRoutine(null); setRName(''); setRWeekdays([]); setRMonthDays(''); setRTags([])
}, [rName, rWeekdays, rMonthDays, rTags, editingRoutine])
```

5f. 彈窗 JSX（加在 activity modal ~第 1296 行前後，同一層級別）：
```tsx
{showRoutineModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setShowRoutineModal(false)}>
    <div className="bg-white dark:bg-gray-800 rounded-xl w-[92%] max-w-lg max-h-[85vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-700 dark:text-gray-200">📝 今日流水帳</h2>
        <div className="flex gap-2">
          <button onClick={() => setRoutineEditMode(v => !v)} className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">{routineEditMode ? '完成編輯' : '編輯'}</button>
          <button onClick={() => setShowRoutineModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
      </div>

      {/* 今日 checklist */}
      {!routineEditMode && (
        activeRoutines.length === 0
          ? <p className="text-sm text-gray-400 text-center py-6">今天沒有需要做的流水帳 👍</p>
          : <div className="space-y-2">
              {activeRoutines.map(r => {
                const done = isDoneToday(r, today)
                return (
                  <div key={r.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
                    <button onClick={() => projectStore.toggleRoutineDone(r.id, today)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center ${done ? 'bg-amber-500 border-amber-500' : 'border-gray-300 dark:border-gray-600'}`}>
                      {done && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </button>
                    <span className={`flex-1 text-sm ${done ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-200'}`}>{r.name}</span>
                    <span className="text-[10px] text-gray-400">{r.weekdays.length ? r.weekdays.map(d => WEEKDAY_LABELS[d]).join('/') : ''}{r.monthDays.length ? ` ${r.monthDays.join('/')}号` : ''}</span>
                    {routineEditMode && null}
                  </div>
                )
              })}
            </div>
      )}

      {/* 编辑模式列表 */}
      {routineEditMode && !editingRoutine && (
        <div className="space-y-2">
          <button onClick={openAddRoutine} className="w-full py-2 border-2 border-dashed border-amber-300 rounded-lg text-amber-500 text-sm">+ 新增流水帳項目</button>
          {routines.map(r => (
            <div key={r.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
              <span className="flex-1 text-sm text-gray-700 dark:text-gray-200">{r.name}</span>
              <button onClick={() => openEditRoutine(r)} className="text-xs text-blue-500">編輯</button>
              <button onClick={() => { if (confirm('確定刪除？')) projectStore.removeRoutine(r.id) }} className="text-xs text-red-500">刪除</button>
            </div>
          ))}
        </div>
      )}

      {/* 编辑/新增表单（含触发条件） */}
      {routineEditMode && (
        <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">名稱</label>
            <input value={rName} onChange={e => setRName(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm" placeholder="例：檢查 email" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">星期（不選=每天）</label>
            <div className="flex gap-1">
              {WEEKDAY_LABELS.map((lbl, i) => (
                <button key={i} type="button" onClick={() => setRWeekdays(p => p.includes(i) ? p.filter(d => d !== i) : [...p, i].sort())}
                  className={`w-8 h-8 rounded-full text-xs border ${rWeekdays.includes(i) ? 'bg-amber-500 text-white border-amber-500 rounded-full' : 'border-gray-300 dark:border-gray-600 rounded-full'}`}>{lbl}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">每月幾號（逗號分隔，空=不限制）</label>
            <input value={rMonthDays} onChange={e => setRMonthDays(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm" placeholder="例：1,15" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">今日活動標籤符合才出現（不選=不限制）</label>
            <div className="flex flex-wrap gap-1">
              {QUICK_TAGS.map(t => (
                <button key={t} type="button" onClick={() => setRTags(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])}
                  className={`px-2 py-0.5 text-xs rounded-full border ${rTags.includes(t) ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-300 dark:border-gray-600'}`}>{t}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={saveRoutine} className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm">儲存</button>
            {editingRoutine && <button onClick={() => setEditingRoutine(null)} className="px-3 py-1.5 text-sm text-gray-500">取消</button>}
          </div>
        </div>
      )}
    </div>
  </div>
)}
```

> ⚠️ 注意：Tailwind class 拼寫（`rounded-full` 不可寫成 `rounded-full rounded-full`）；上面星期按鈕 example 中 `rounded-full` 重複為提醒勿錯字，實作時只留一次 `rounded-full`。

驗證：
```bash
cd ~/kanban && npm run build 2>&1 | tail -4
```
預期：`✓ built in ...ms`，0 errors。若報 `useMemo`/未使用 import 錯，先清掉未用 import 再重 run。

Commit：`git add src/pages/GanttPage.tsx && git commit -m "feat(routine): overview button + daily checklist modal with trigger-condition editor"`

---

### Task 6 — 手動端到端驗證 + 部署
1. `npm run dev`，瀏覽器開 http://localhost:5173
2. 打開「流水帳」→「編輯」→ 新增項目「主管晨報」星期選一~五 → 儲存。
3. 今日（依今天星期）應出現在 checklist；勾選後呈刪除線；重新整理瀏覽器（同日）仍為已勾。
4. 新增條件「每月1号」項目，確認非 1 號不出現。
5. `npm run test && npm run build`：預期 tests pass、build 0 errors。
6. `git push origin main` → 等 GitHub Actions → 開 https://posenchen.github.io/kanban/ 確認按鈕與彈窗正常。

Commit（若 dist 有跟 repo）：依現有慣例，若 `dist/` 不在 .gitignore 則 `git add -A && git commit -m "chore: rebuild dist"`。

---

## Risks / tradeoffs / open questions
- **Q1 跨維度語意**：目前採「維度內 OR、跨維度 AND」。若你希望「星期X 或 今日有某標籤」都能觸發（跨維度 OR），需把 `matchesToday` 改成 OR。這是體驗差異最大的參數，建議先試讀 qua 預設 AND，不合再調。
- **勾選資料入 GitHub**：`completed_date` 每日變更會被同步到 `kanban-data`，造成小量 commit。可接受（3 秒去抖），若想省流量可把 `completed_date` 只留 local。
- **今日標籤觸發範圍**：目前定義「今日有進行中的活動（milestone）含該標籤」。若你想改以 project 標籤觸發，改 `todayTags` 來源即可。
- **引入 vitest**：專案原本零測試；若不想新增 devDep，可刪除 Task 0 與所有 `.test.ts`，但建議保留 `routineUtils.ts` 純函式拆分以便未來可测。
- **手機版**：彈窗 max-w-lg + 縦向，手機可用；未做额外响应式優化（YAGNI）。

## 後續可選（Task 7+，本次不做，僅提案）
- 流水帳完成度統計（本週勾選率小圖）。
- 「今天全部完成 🎉」彩蛋 + 一鍵清空。
- 拖曳排序流水帳項目（沿用现有 sort_order 重排演算法）。
- 未勾選跨天累未到響鈴提醒（需通知權限，複雜度高，建議獨立評估）。
