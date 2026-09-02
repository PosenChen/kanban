# Plan: 甘特圖側欄專案列 ＆ 待辦清單 — 拖曳排序（drag-to-reorder）

## Goal

讓甘特圖總覽頁（`src/pages/GanttPage.tsx`）左側凍結欄的專案列、以及待辦清單項目，可以用**拖曳**直接放到目標位置調整顯示順序；▲▼ 按鈕保留作為觸控/無障礙備用。

## Current context / assumptions

- Repo: `~/kanban/`（React 19 + TS + Vite 8 + Tailwind v4，HashRouter，GitHub Pages 部署；push main → Actions 自動 build 部署）。
- 排序現況：
  - Store（`src/data/localStorageStore.ts` L490–575）已有 `moveProjectUp/moveProjectDown(parentId, projectId)`、`moveTodoUp/moveTodoDown(todoId)`。演算法＝同層（同 `parent_id`） siblings 重排 → **重新指派連續 `sort_order` 0..N-1** → `saveLocal` + `emitProjectChange()/emitTodoChange()`（事件 detail 已過濾 `archived_at`；3 秒去抖雲端上傳在 `saveLocal` 內建，不用另寫）。
  - UI（`GanttPage.tsx`）：側欄由 `sidebarRows`（L662–700）渲染，每列含 `project / isRoot / groupId / isFirstSibling / isLastSibling`；待辦清單由 `visibleTodos`（L346）渲染。兩處各有 ▲▼ 箭頭（專案 L1046–1090、待辦 L1378–1399），本計劃**不動箭頭**。
  - SVG 色塊已有一套 pointer 拖曳（改日期用，L774 `startDrag`）——與本次縱向排序**無關，不要碰**：側欄/待辦是獨立 DOM，pointer events 與 drag events 事件模型不同，無衝突。
- 已定案（implementer 不必再猜）：
  1. **原生 HTML5 Drag & Drop**（`draggable` + `onDragStart/onDragOver/onDragLeave/onDrop/onDragEnd`），不引入套件（YAGNI）。
  2. 只允許**同群組內**排序：根 ↔ 根（`parent_id === null`）；子 ↔ 同 `parent_id` 子。**不支持 re-parenting**——拖到不同群組的列無指示線、松手無效。
  3. 落點語意＝「插入到目標列之前/之後」：指標 Y 比對目標列垂直中點 → before/after；after 時 `beforeId = 同群組完整 siblings（依 sort_order 排序、含隱蔽項）中 overId 的下一筆 id`，沒有下一筆 → `null`＝置末。
  4. 視覺：拖曳中列 `opacity-40`；合法目標列命中時顯示 2px 藍色指示線（上半 `border-t-2 border-t-blue-500`、下半 `border-b-2 border-b-blue-500`，覆蓋原 1px 灰線）。
  5. 觸控裝置 HTML5 DnD 無效 → ▲▼ 按鈕保留（硬需求）。
  6. 商業規則：退場（archived）項目不出現在側欄，不可能被拖；store 端以 `cached`（raw 含退場）計算 sort_order，語意正確。

## Architecture / proposed approach

抽純函式 `reorderToSlot<T extends {id:string}>(list, draggedId, beforeId)`（移除 dragged 後插入 beforeId 之前；beforeId 為 null/找不到→置末；dragged 不在清單→回傳原引用＝no-op）與 `nextIdAfter<T>(list, afterId)`，store 新方法 `moveProjectToSlot / moveTodoToSlot` 以之取得 siblings 新序後重指派 `sort_order` 並持久化發事件（完全沿用現有模式）。UI 層抽共用 hook `useDragReorder`（`src/hooks/useDragReorder.ts`）管理 `draggingId/dropTarget` 狀態機，側欄與待辦兩處複用（DRY）。

---

## Step 1 — 純函式 `reorderToSlot` + `nextIdAfter`（TDD RED→GREEN）

**新建** `src/utils/reorderUtils.test.ts`：

```ts
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
  it('dropping before self is a no-op', () => {
    expect(ids(reorderToSlot(list, 'b', 'b'))).toEqual(['a', 'b', 'c', 'd'])
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
```

驗證 RED：`cd ~/kanban && npx vitest run src/utils/reorderUtils.test.ts` → **FAIL**（Cannot find module）。

**新建** `src/utils/reorderUtils.ts`：

```ts
/** 將 draggedId 項目插入到 beforeId 之前；beforeId=null 或找不到 → 置末。
 *  回傳新陣列；draggedId 不在清單時回傳原 reference（呼叫端可據此判 no-op）。 */
export function reorderToSlot<T extends { id: string }>(
  list: T[], draggedId: string, beforeId: string | null,
): T[] {
  const from = list.findIndex(x => x.id === draggedId)
  if (from === -1) return list
  const next = [...list]
  const [moved] = next.splice(from, 1)
  if (beforeId === null || beforeId === draggedId) {
    next.push(moved)
  } else {
    const to = next.findIndex(x => x.id === beforeId)
    if (to === -1) next.push(moved)
    else next.splice(to, 0, moved)
  }
  return next
}

/** list 中 afterId 的下一筆 id；最後一笔或找不到 → null。 */
export function nextIdAfter<T extends { id: string }>(list: T[], afterId: string): string | null {
  const i = list.findIndex(x => x.id === afterId)
  return i >= 0 && i + 1 < list.length ? list[i + 1].id : null
}
```

驗證 GREEN：同命令 → **8 passed**。
Commit：`git add src/utils/reorderUtils.ts src/utils/reorderUtils.test.ts && git commit -m "feat(utils): reorderToSlot/nextIdAfter insert-before primitives, TDD (8 tests)"`

## Step 2 — Store slot APIs（TDD RED→GREEN）

**新建** `src/data/store.reorder.test.ts`。shim 寫法**照抄 `src/data/store.archive.test.ts`**（同目錄已有可直接參照的 `installShim()` + `beforeAll` 動態 import 模式），seed 如下結構（3 根 r1/r2/r3、r1 之子 c1/c2、3 待辦 t1/t2/t3；日期用近clair期避免 autoArchive 干預）：

```ts
import { describe, it, expect, beforeAll } from 'vitest'
// shim：複製 store.archive.test.ts 的 installShim()，一模一樣。
function installShim() {
  const store = new Map<string, string>()
  ;(globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
  }
  const listeners = new Map<string, Function[]>()
  ;(globalThis as any).window = {
    addEventListener: (t: string, f: Function) => {
      if (!listeners.has(t)) listeners.set(t, [])
      listeners.get(t)!.push(f)
    },
    removeEventListener: () => { /* noop */ },
    dispatchEvent: (e: any) => { (listeners.get(e.type) ?? []).forEach(f => f(e)) },
    location: { hash: '' },
  }
}

const mkProject = (id: string, sort: number, parent_id: string | null = null) => ({
  id, name: id, description: '', parent_id, sort_order: sort,
  start_date: '2026-09-01', end_date: '2026-09-30',
  status: 'preparation' as const, priority: 'medium' as const,
  tags: [] as string[], progress: 0,
  created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z',
})

function seed() {
  const LS = (globalThis as any).localStorage
  LS.setItem('kanban_projects', JSON.stringify([
    mkProject('r1', 0), mkProject('r2', 1), mkProject('r3', 2),
    mkProject('c1', 0, 'r1'), mkProject('c2', 1, 'r1'),
  ]))
  LS.setItem('kanban_todos', JSON.stringify(['t1', 't2', 't3'].map((id, i) => ({
    id, name: id, priority: 'medium' as const, sort_order: i, completed: false,
    created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z',
  }))))
}

let projectStore: typeof import('@/data/localStorageStore')['projectStore']
beforeAll(async () => {
  installShim()
  projectStore = (await import('@/data/localStorageStore')).projectStore
})

const sortedByIds = <T extends { sort_order?: number; id: string }>(l: T[]) =>
  [...l].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map(x => x.id)

describe('moveProjectToSlot', () => {
  it('root: r3 before r1 → [r3,r1,r2], sort_order 0..N-1, persisted', () => {
    seed()
    projectStore.moveProjectToSlot(null, 'r3', 'r1')
    const roots = projectStore.getAllRaw().filter(p => p.parent_id === null)
    expect(sortedByIds(roots)).toEqual(['r3', 'r1', 'r2'])
    expect([...roots].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map(p => p.sort_order)).toEqual([0, 1, 2])
    const persisted = JSON.parse((globalThis as any).localStorage.getItem('kanban_projects'))
    expect(persisted.find((p: any) => p.id === 'r3').sort_order).toBe(0)
  })
  it('child: c2 before c1 within r1', () => {
    seed()
    projectStore.moveProjectToSlot('r1', 'c2', 'c1')
    expect(sortedByIds(projectStore.getAllRaw().filter(p => p.parent_id === 'r1'))).toEqual(['c2', 'c1'])
  })
  it('beforeId=null appends to end', () => {
    seed()
    projectStore.moveProjectToSlot(null, 'r1', null)
    expect(sortedByIds(projectStore.getAllRaw().filter(p => p.parent_id === null))).toEqual(['r2', 'r3', 'r1'])
  })
  it('cross-group drag is a no-op (dragged not in sibling group)', () => {
    seed()
    projectStore.moveProjectToSlot(null, 'c1', 'r1') // c1 is a child, not root
    expect(sortedByIds(projectStore.getAllRaw().filter(p => p.parent_id === null))).toEqual(['r1', 'r2', 'r3'])
  })
})

describe('moveTodoToSlot', () => {
  it('t3 before t1', () => {
    seed()
    projectStore.moveTodoToSlot('t3', 't1')
    expect(sortedByIds(projectStore.getTodos())).toEqual(['t3', 't1', 't2'])
  })
  it('beforeId=null appends', () => {
    seed()
    projectStore.moveTodoToSlot('t1', null)
    expect(sortedByIds(projectStore.getTodos())).toEqual(['t2', 't3', 't1'])
  })
})
```

> 若 `getAllRaw` 名稱不符：`grep -n "getAllRaw\|getAll(" src/data/localStorageStore.ts` 按實際 API 微調（本 repo 已知有 `getAll`（過濾退場）與 `getAllRaw`）。`getTodos()` 回傳是否排序—若原序即陣列序，斷言維持 `sort_order` 比對寫法即可。

驗證 RED：`npx vitest run src/data/store.reorder.test.ts` → **FAIL**（`moveProjectToSlot is not a function`）。

實作：`src/data/localStorageStore.ts` 檔首加 `import { reorderToSlot } from '@/utils/reorderUtils'`；在 `moveProjectDown`（L542 附近）之後、`moveTodoDown` 之後各加一個方法（同作用域私有 `saveLocal/emitProjectChange/saveTodos/emitTodoChange` 直接呼叫）：

```ts
  // ── Slot reorder（拖曳）：插入到同層 beforeId 之前；beforeId=null → 置末 ──
  moveProjectToSlot(parentId: string | null, draggedId: string, beforeId: string | null): void {
    const siblings = cached.filter(p => p.parent_id === parentId)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const ordered = reorderToSlot(siblings, draggedId, beforeId)
    if (ordered === siblings) return // draggedId 不在該群組 → no-op
    ordered.forEach((sib, i) => {
      const sIdx = cached.findIndex(p => p.id === sib.id)
      if (sIdx !== -1) cached[sIdx] = { ...cached[sIdx], sort_order: i, updated_at: new Date().toISOString() }
    })
    saveLocal(cached)
    emitProjectChange()
  },

  moveTodoToSlot(draggedId: string, beforeId: string | null): void {
    const sorted = [...todos].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const ordered = reorderToSlot(sorted, draggedId, beforeId)
    if (ordered === sorted) return
    ordered.forEach((t, i) => {
      const tIdx = todos.findIndex(x => x.id === t.id)
      if (tIdx !== -1) todos[tIdx] = { ...todos[tIdx], sort_order: i, updated_at: new Date().toISOString() }
    })
    saveTodos(todos)
    emitTodoChange()
  },
```

驗證 GREEN：`npx vitest run src/data/store.reorder.test.ts` → 6 passed；`npm test` → **45 passed**（既有 31＋8＋6）。
Commit：`git commit -am "feat(store): moveProjectToSlot/moveTodoToSlot for drag reorder, TDD (+6)"`

## Step 3 — 共用 hook `useDragReorder`

**新建** `src/hooks/useDragReorder.ts`（直接貼完整版）：

```ts
import { useCallback, useState } from 'react'
import type { DragEvent } from 'react'

export interface DropTarget { id: string; before: boolean }
export interface DropInfo { draggedId: string; beforeId: string | null }

/**
 * HTML5 縱向拖曳排序狀態機（純 UI 邏輯，落库由呼叫端的 onDrop 決定）。
 * 用法：
 *   const d = useDragReorder(({ draggedId, beforeId }) => store.moveXToSlot(draggedId, beforeId))
 *   <li draggable
 *     onDragStart={d.start(id)}
 *     onDragOver={e => d.over(e, id)}
 *     onDragLeave={() => d.leave(id)}
 *     onDrop={e => d.drop(e, id, (overId, before) => /* 解析 beforeId *\/)}
 *     onDragEnd={d.clear}>
 * 視覺：d.draggingId === id 加 opacity-40；
 *      d.dropTarget?.id === id 依 before 加 border-t-2 / border-b-2 指示線。
 */
export function useDragReorder(onDrop: (info: DropInfo) => void) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)

  const start = useCallback((id: string) => (e: DragEvent) => {
    setDraggingId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id) // Firefox 必須 setData 才啟動拖曳
  }, [])

  const over = useCallback((e: DragEvent, overId: string) => {
    e.preventDefault() // 必要：宣告可放置
    if (!draggingId || draggingId === overId) {
      if (dropTarget) setDropTarget(null)
      return
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setDropTarget({ id: overId, before: e.clientY < rect.top + rect.height / 2 })
  }, [draggingId, dropTarget])

  const leave = useCallback((id: string) => {
    if (dropTarget?.id === id) setDropTarget(null)
  }, [dropTarget])

  /** resolveBeforeId：呼叫端算好最終 beforeId（before ? overId : 同群組下一筆 id 或 null） */
  const drop = useCallback((e: DragEvent, overId: string,
    resolveBeforeId: (overId: string, before: boolean) => string | null) => {
    e.preventDefault()
    e.stopPropagation()
    if (draggingId && draggingId !== overId) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const before = e.clientY < rect.top + rect.height / 2
      onDrop({ draggedId, beforeId: resolveBeforeId(overId, before) })
    }
    setDraggingId(null)
    setDropTarget(null)
  }, [draggingId, onDrop])

  const clear = useCallback(() => { setDraggingId(null); setDropTarget(null) }, [])

  return { draggingId, dropTarget, start, over, leave, drop, clear }
}
```

驗證：`npm run build` exit 0（tsc 過型別即守門）。Commit：
`git commit -am "feat(ui-hooks): shared useDragReorder state machine for list DnD"`

## Step 4 — 甘特圖側欄專案列拖曳

`src/pages/GanttPage.tsx`：

1. 檔首 import（既有 import 區補）：
```ts
import { useDragReorder } from '@/hooks/useDragReorder'
import { nextIdAfter } from '@/utils/reorderUtils'
```

2. 元件內、`handleMoveProjectUp`（L164 附近）之後加：
```ts
// ── 拖曳排序（同群組）──
const siblingsOf = (parentId: string | null) =>
  projects.filter(p => (p.parent_id ?? null) === parentId)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

const projDnd = useDragReorder(({ draggedId, beforeId }) => {
  const dragged = projects.find(p => p.id === draggedId)
  if (!dragged) return
  projectStore.moveProjectToSlot(dragged.parent_id ?? null, draggedId, beforeId)
})
```

3. 側欄列外層 `<div key={isRoot ? ...}>`（L1044 附近，原 `className` 含 `border-b border-gray-100 ...`）改為：
```tsx
<div
  key={isRoot ? `root-${project.id}` : `sub-${project.id}`}
  draggable
  onDragStart={projDnd.start(project.id)}
  onDragOver={e => {
    // 群組守則：跨群組不受理（不 preventDefault → 無指示線、不可放）
    const dragged = projects.find(p => p.id === projDnd.draggingId)
    if (dragged && (dragged.parent_id ?? null) !== (project.parent_id ?? null)) return
    projDnd.over(e, project.id)
  }}
  onDragLeave={() => projDnd.leave(project.id)}
  onDrop={(e) => projDnd.drop(e, project.id, (overId, before) => {
    const overParent = project.parent_id ?? null
    const sibs = siblingsOf(overParent).filter(p => p.id !== project.id && p.id !== projDnd.draggingId)
    // before：落在 overId 上半部 → beforeId=overId；下半部→ overId 的下一兄弟（排除自己後再找）
    if (before) return overId
    const rest = siblingsOf(overParent).filter(p => p.id !== projDnd.draggingId)
    return nextIdAfter(rest, overId) // 無下一筆 → null（置末）
  })}
  onDragEnd={projDnd.clear}
  className={`flex items-center border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950 select-none ${
    projDnd.draggingId === project.id ? 'opacity-40' : ''
  } ${projDnd.dropTarget?.id === project.id
    ? (projDnd.dropTarget.before ? 'border-t-2 border-t-blue-500' : 'border-b-2 border-b-blue-500')
    : ''}`}
  style={{ height: rowHeight, backgroundColor: bgEven ? (dk ? '#1f2937' : '#ffffff') : (dk ? '#111827' : '#fafafa') }}
  onClick={() => handleProjectClick(project.id)}
>
```
實作注意：
- 原 `className` 模板字串保留全部既有 class，只**追加** `select-none`、opacity、指示線三段（原始第一行 className 見 L1047）。
- `border-t-2` 出現時原 `border-b`（1px 灰）仍在——命中下半部時上下線共存一幀不美观：下半部命中改用 `border-b-2 border-b-blue-500` 同時把原 `border-b` 移除？ Tailwind 同 side 不能疊加——採簡化定案：**命中上半部＝`border-t-2 border-t-blue-500`＋原底線保留；命中下半部＝`border-b-2 border-b-blue-500` 覆蓋 `border-b`（同 side 後者勝出需把原 `border-b border-gray-100 dark:border-gray-700` 在命中時拿掉）**。實作寫法：
```tsx
const isDropBefore = projDnd.dropTarget?.id === project.id && projDnd.dropTarget.before
const isDropAfter = projDnd.dropTarget?.id === project.id && !projDnd.dropTarget!.before
className={`flex items-center ${isDropAfter ? 'border-b-2 border-b-blue-500' : 'border-b border-gray-100 dark:border-gray-700'} ${isDropBefore ? 'border-t-2 border-t-blue-500' : ''} ...`}
```
- `resolveBeforeId` 閉包引用 `projDnd.draggingId`：drop 處理時 `draggingId` 尚未被 clear（clear 在 onDrop 之後同 tick），但 TS 可能報 stale——**已定案寫法：onDrop 外面包一層 lokal closure**，把 draggedId 從 store 查 parent 改為直接用事件的 draggingId——hook 的 `onDrop(info)` 已傳 `draggedId`，所以 resolveBeforeId 裡**不要用 `projDnd.draggingId`**，改以 overId + before 定位即可（above: beforeId=overId; after: 找「不同 parent 的全序 list 中 overId 下一筆且不等於 draggedId」——但 hook 未傳 draggedId 進來）。**最終定案**：改 hook 簽名 `resolveBeforeId(overId, before, draggedId)` 並把第三參傳入：
```ts
// hook 內 drop 改為：
onDrop({ draggedId, beforeId: resolveBeforeId(overId, before, draggingId) })
// hook 型別：
resolveBeforeId: (overId: string, before: boolean, draggedId: string) => string | null
```
呼叫端對應：
```ts
(overId, before, draggedId) => {
  if (before) return overId
  const sibs = siblingsOf(project.parent_id ?? null).filter(p => p.id !== draggedId)
  return nextIdAfter(sibs, overId)
}
```
（Step 3 的 hook 檔請先套用此最終型別再提交——依序：Step 3 提交前就先寫成含 draggedId 的三參數版。）

4. `select-none` 已加（見上），防止拖文字产生幽靈。既有 `onClick`/箭頭 span 全保留不動。

**手動驗證（`npm run dev`，打開 http://localhost:5173 甘特圖頁）**：
- 拖根專案 A 至根專案 B 下半部 → 松手後 A 排 B 之後，蓝色下指示線在拖曳中可見；重新整理順序維持（localStorage `kanban_projects` 的 sort_order 已重排 0..N-1——可在 DevTools 驗證）。
- 展開父 R 拖 exchange 其子 c1/c2 → 只影響 R 內序；把子列拖向其他根列 → 無指示線且松手無效。
- 篩選（只看進行中）時拖曳 → 寫回後完整清單順序按「可見列相對位置」合理。
- 點擊列仍跳詳情頁；箭頭 ▲▼ 仍逐格移動；Console 無新錯誤。

Commit：`git commit -am "feat(gantt): drag-to-reorder projects in frozen sidebar (same-group only)"`

## Step 5 — 待辦清單拖曳

同檔待辦區（L1330 `visibleTodos.map` 的 `<div key={todo.id}>`）：

1. 元件內加（useProjects 的 todos setter 用現有 `setTodos`，若目前 todos 僅經 event 同步则照專案模式直接重讀）：
```ts
const todoDnd = useDragReorder(({ draggedId, beforeId }) => {
  projectStore.moveTodoToSlot(draggedId, beforeId)
  setTodos([...projectStore.getTodos()]) // 與 handleMoveTodoUp 同款重繪（L173）
})
```
（若組件內沒有 `setTodos` state：grep `handleMoveTodoUp` 的實作照抄——它在 L172–176 即 `projectStore.moveTodoUp(...); setTodos([...projectStore.getTodos()])`，模式相同。）

2. 列 props（併入既有 className 模板，重要規則同 Step 4 命中覆蓋）：
```tsx
draggable
onDragStart={todoDnd.start(todo.id)}
onDragOver={e => todoDnd.over(e, todo.id)}
onDragLeave={() => todoDnd.leave(todo.id)}
onDrop={(e) => todoDnd.drop(e, todo.id, (overId, before, draggedId) => {
  if (before) return overId
  const rest = [...projectStore.getTodos()].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).filter(t => t.id !== draggedId)
  return nextIdAfter(rest, overId)
})}
onDragEnd={todoDnd.clear}
```
- 待辦 list 無群組概念 → 無需群組守則。
- **以 store raw todos（含 completed）計算 after 落點**，與 drag 視覺只在可見清單一致：拖可见列到可見列「後半部」時以**可見清單**算 next 較直觀——定案改用 `visibleTodos`：
```ts
const rest = visibleTodos.filter(t => t.id !== draggedId)
return nextIdAfter(rest, overId)
```
（store 端 `moveTodoToSlot` 對「beforeId 是 completed 項」照插前，語意無損；置末才用 raw。兩法結果對 completed 尾段有細差，接受可見清單版，README 註記。）

3. 命中指示線 class 同 Step 4 覆蓋規則。

**手動驗證（dev）**：
- 拖第 3 項待辦到第 1 項上方 → 落頂、勾選框仍可點擊、刷新持久。
- 拖曳中該列半透明、目標有藍線。▲▼ 仍可用。
- 流水帳彈窗/日期篩選打開時拖曳不卡死（事件正常分發）。

Commit：`git commit -am "feat(gantt): drag-to-reorder todo list"`

## Step 6 — 全量驗證、部署、README

1. `cd ~/kanban && npm test` → 回報實際 passed 數（預期 **45 passed** = 既有 31 + utils 8 + store 6）。
2. `npm run build` → `✓ built`、exit 0。
3. `git add -f dist/index.html && git commit -m "chore: rebuild dist"`；`git push origin main`（上一個 step 若未 push 一併推）。
4. README.md 三處：
   - 功能總覽表新增：`| **拖曳排序** | 側欄專案（限同群組）與待辦清單直接拖曳落位，藍色插入線指示；▲▼ 保留為觸控/無障礙備用 |`
   - 更新歷史新增 `### 🗓️ 2026-09-02 — 拖曳排序`：三點（reorderToSlot 純函式 + useDragReorder hook／store moveProjectToSlot・moveTodoToSlot＋遷移相容／跨群組不受理、落點依可見清單折算）。
   - 尾註「*最後更新：2026-09-02*」。
   - Commit：`git commit -am "docs: README drag-to-reorder"`；push。
5. 部署驗證：GitHub Actions 完成後（約 1–2 分）`curl -s https://posenchen.github.io/kanban/ | grep -c draggable` → ≥1（或比對 assets hash 變更）。

## Risks / trade-offs / open questions

- **過濾視圖落點語意**：以「目標列在完整 siblings 的實際位置」折算，可能跨過被篩掉的兄弟；與現行箭頭「依可見清單」相容，README 註記。
- **觸控無 HTML5 DnD**：保留 ▲▼ 是硬需求，勿刪。
- **SVG 日期拖曳共存**：pointer events vs drag events 模型不同＋不同 DOM 子樹，無衝突；側欄已加 `select-none` 防幽靈。
- **行高僅 18–24px**：中點二分足夠（不做四分精度）。
- **autoArchive**：退場項不在側欄／待辦清單，拖不到；store 以 raw cached 計算 sort_order 正確。
- **Open question（不阻塞本期）**：KanbanBoard 四欄跨欄拖曳換狀態、DailyPage 拖曳——留 Roadmap，本期明確不做。
