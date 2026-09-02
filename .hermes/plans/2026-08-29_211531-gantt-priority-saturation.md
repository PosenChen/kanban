# Gantt 色塊優先級飽和度 Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 甘特圖專案色塊依優先級呈現不同飽和度 — 高=現有顏色（滿和）、中=稍微降低、低=再更低 — 並完成本地未提交實作的清理、驗證與部署。

**Architecture:** 單頁 React SPA（`src/pages/GanttPage.tsx`）。色塊填色走純函數 `desaturate(hex, S%, dark)`：hex→HSL、Hue 保留狀態色、Saturation 依優先級降、Lightness 隨 S 補償避免暗色模式發灰。圖例與色塊共用同一組常數（legend = ground truth）。

**Tech Stack:** React 19 + TypeScript 7 + Vite 8 + Tailwind v4，GitHub Pages 部署（`.github/workflows/deploy.yml`，push main 觸發）。

---

## 仓库解析（PosenChen/kanban）

```
kanban/
├── .github/workflows/deploy.yml   # push→main: npm ci → vite build → GH Pages
├── index.html / vite.config.ts    # @ alias
├── requirements.md
└── src/
    ├── pages/    GanttPage.tsx (1325行, 核心) / KanbanBoard / DailyPage / ProjectDetail / Settings
    ├── components/ ProjectForm / ProjectCard / FilterBar / ThemeToggle
    ├── hooks/    useProjects.ts
    ├── data/     localStorageStore.ts (含 kanban-data 倉庫 GitHub sync)
    ├── types/    project.ts (Project.priority: 'high'|'medium'|'low', PRIORITY_CONFIG)
    └── utils/    dateUtils / theme
```

資料模型：`Project { priority: 'high'|'medium'|'low', status: preparation|in_progress|waiting|completed, parent_id, sort_order, ... }`。狀態色 `statusColorMap`（GanttPage.tsx:418）：準備中 `#FBBF24`、進行中 `#3B82F6`、等待中 `#F97316`、已完成 `#10B981`。

## Current context / 現況（重要）

功能**已在本地實作約 95%，但尚未 commit**（`git status`: `M src/pages/GanttPage.tsx`、`M src/data/localStorageStore.ts`；GitHub 上沒有）。已存在：

- `GanttPage.tsx:25` — `BAR_SATURATIONS = { high: 100, medium: 46, low: 30 }`
- `GanttPage.tsx:34-59` — `hexToHsl()` + `desaturate(hex, s, dark)`
- `GanttPage.tsx:616` — 色塊 fill：`colorByPriority ? desaturate(baseColor, BAR_SATURATIONS[project.priority] ?? 100, dk) : baseColor`
- `GanttPage.tsx:1035` — 摺疊父列的里程碑菱形同樣套 desaturate
- `GanttPage.tsx:743-756` — 「優先級調色」checkbox（localStorage `kanban_color_by_priority`）
- `localStorageStore.ts:10-14` — `isColorByPriority()` helper（**未被使用，死碼**）

待辦的缺陷／調整點：

| # | 問題 | 位置 | 處置 |
|---|------|------|------|
| A | 預設 **OFF**（`=== 'true'`），使用者要的是常態行為 → 改為預設 ON | GanttPage.tsx:84 | Task 1 |
| B | medium=46 已是「大幅偏灰」，與「稍微低一些」不符 → 階梯放緩：**100 / 72 / 45** | GanttPage.tsx:25 | Task 1 |
| C | 圖例 `LEGEND_SATURATIONS=[100,62,46,30]` 是 4 階，色塊只有 3 階 → 圖例與色塊不一致（違反 legend=ground truth） | GanttPage.tsx:24, 774 | Task 1 |
| D | 淺色模式低飽和色塊 L≈63%，白字對比不足 | desaturate():57 | Task 2 |
| E | `isColorByPriority()` 死碼／key 字串散落兩處 | localStorageStore.ts:12, GanttPage.tsx:84,750 | Task 3 |
| F | JSX 排版殘跡 `)      </div>` | GanttPage.tsx:783 | Task 3 |
| G | 註解殘留無意義詞「light (normal / special-ops)」 | GanttPage.tsx:21 | Task 3 |

不动点（回歸保護，勿改）：色塊寬度 `end−start+1`（:599）、waiting `#F97316`、凍結欄與 SVG 同一份 rows 派生、`kanban_expanded` localStorage。活動列（milestone row, :987 `hsl(hue,65%,65%)` 雜湊色）**不套優先級調色** — 活動無 priority 欄位，維持現況（YAGNI）。

## Proposed approach

保留既有架構，只做參數化收尾：飽和度三檔常數集中一處、開關預設開啟、圖例與色塊讀同一組值、清掉死碼，再依慣例 build → commit → push → 驗證 GH Pages。

建議飽和度（唯一調整槓桿，不满意只改這一行）：

```
high   → 100%（現色，不變）          ← 使用者要求：維持目前顏色
medium →  72%（稍微降低飽和）        ← 使用者要求：稍微低一些
low    →  45%（再更低，明顯偏灰）    ← 使用者要求：再更低一些
```

---

## Task 1: 飽和度階梯 + 預設開啟 + 圖例同步

**Files:**
- Modify: `src/pages/GanttPage.tsx:20-25`（常數）
- Modify: `src/pages/GanttPage.tsx:84`（開關預設值）
- Modify: `src/pages/GanttPage.tsx:767-782`（圖例）

**Step 1 — 改常數（:24-25）：**

```ts
// Priority → bar saturation ladder. Legend swatches read the SAME array
// (legend = ground truth). high keeps the status color untouched.
const PRIORITY_SATURATIONS: Record<ProjectPriority, number> = { high: 100, medium: 72, low: 45 }
const LEGEND_SATURATIONS = [PRIORITY_SATURATIONS.high, PRIORITY_SATURATIONS.medium, PRIORITY_SATURATIONS.low]
```

並刪除舊 `BAR_SATURATIONS`，將 `:616` 與 `:1035` 兩處 `BAR_SATURATIONS[...]` 改名為 `PRIORITY_SATURATIONS[...]`（`?? 100` 保底保留）。

**Step 2 — 預設開啟（:84）：**

```ts
const [colorByPriority, setColorByPriority] = useState(() => localStorage.getItem('kanban_color_by_priority') !== 'false')
```

（用 `!== 'false'` 反推：未設定 = 開；使用者關過 = 尊重其選擇。）

**Step 3 — 圖例改 3 階且逐 priority 標示（:767-782）：** 每個狀態色画 3 個色票，依序標 高/中/低：

```tsx
{colorByPriority && (
  <div className="flex items-center gap-3 flex-wrap">
    <span className="text-xs text-gray-500 dark:text-gray-400">優先級（飽和度 高→低）：</span>
    {([['#3B82F6', '進行中'], ['#F97316', '等待中'], ['#10B981', '已完成']] as const).map(([hex, label]) => (
      <span key={hex} className="flex items-center gap-1 text-xs">
        <span className="flex gap-px">
          {LEGEND_SATURATIONS.map(s => (
            <span key={s} className="w-2.5 h-3 rounded-sm inline-block" style={{ backgroundColor: desaturate(hex, s, dk) }} />
          ))}
        </span>
        {label}
      </span>
    ))}
  </div>
)}
```

（順手刪掉錯位註解「由上而下…」—圖例是橫排，與 Task 3 合併清理。）

**Verify:** `cd ~/kanban && npm run build` → clean（tsc 通過）。`grep -n "BAR_SATURATIONS" src/ -r` → 0 hits。

**Commit:** `git add -A && git commit -m "feat(gantt): priority saturation ladder 100/72/45, toggle default-on, legend matches bars"`

## Task 2: 低飽和色塊文字對比（淺色模式）

**Objective:** 防止 medium/low 色塊（L≈63%）上白字不可讀。

**Files:** Modify `src/pages/GanttPage.tsx:54-59`（`desaturate`）

**Step 1 — 壓低淺色模式明度上限：**

```ts
function desaturate(hexColor: string, s: number, dark: boolean): string {
  if (s >= 100) return hexColor
  const [h, , l0] = hexToHsl(hexColor)
  // dark: clamp 52 so bars don't glow pale; light: clamp 54 so white bar labels stay legible
  const lightness = dark
    ? Math.round(Math.min(52, l0 * Math.sqrt(s / 100)))
    : Math.round(Math.min(54, 50 + (100 - s) * 0.045))
  return `hsl(${h}, ${s}%, ${lightness}%)`
}
```

**Verify:** build clean；瀏覽器淺色模式下 medium/low 條上專案名白字清晰可讀。

**Commit:** `git commit -m "fix(gantt): clamp light-mode desaturated bar lightness for white label contrast"`

## Task 3: 死碼清理 + 排版修正

**Files:**
- Modify: `src/data/localStorageStore.ts:10-14` — 保留 helper 並實際使用（DRY），或将 key 常數匯出：

```ts
export const STORAGE_KEY_COLOR_BY_PRIORITY = 'kanban_color_by_priority'
export function isColorByPriority(): boolean {
  return localStorage.getItem(STORAGE_KEY_COLOR_BY_PRIORITY) !== 'false'
}
```

- Modify: `GanttPage.tsx:84` → `useState(isColorByPriority)`；`:750` onChange → `localStorage.setItem(STORAGE_KEY_COLOR_BY_PRIORITY, String(e.target.checked))`（import 補上）。
- Modify: `GanttPage.tsx:783` — `)      </div>` 拆回兩行正常縮排。
- Modify: `GanttPage.tsx:20-23` — 刪除「light (normal / special-ops)」殘留註解。

**Verify:** `npx tsc --noEmit` clean；`grep -rn "kanban_color_by_priority" src/` 仅剩 localStorageStore.ts 一处字面量。

**Commit:** `git commit -m "refactor: dedupe color-by-priority storage key, fix legend JSX formatting"`

## Task 4: 全量驗證（本機）

```bash
cd ~/kanban && npm run build            # 期望：tsc + vite build 0 errors
npm run dev &                            # http://localhost:5173/kanban/（或 vite 預設 port）
```

檢查清單（開/關「優先級調色」各一次，淺色 + 深色各一次）：
- [ ] 同狀態、不同優先級三條並排 → 飽和度可辨識地 高>中>低
- [ ] 關閉開關 → 所有色塊恢復滿和舊行為
- [ ] 重新整理（reload）→ 開關狀態持久
- [ ] 圖例色票與實際色塊逐色一致（同 desaturate 輸出）
- [ ] 菱形里程碑同 priority 降飽和；活動列紫色色塊不受影響
- [ ] 凍結欄/捲動欄逐行對齊無错位（回歸點）

## Task 5: 推送 + GitHub Pages 部署驗證（慣例流程）

```bash
cd ~/kanban && git push origin main
gh run watch --repo PosenChen/kanban --exit-status   # 或輪詢 API
curl -s https://posenchen.github.io/kanban/ | grep -o 'assets/[^"]*\.js' | head -1   # 拿到新 bundle hash
```

確認 CI `Deploy to GitHub Pages` green 且线上 bundle hash 與本地 `dist/` 一致後才算完成。

---

## 风险 / 開放問題

1. **medium=72 / low=45 是建議值** —「稍微」「更低」主觀，顏色只存在於一行常數，不满意隨時一行改回（如 60/35）。
2. 開關預設由 OFF→ON：若你之前的瀏覽器已存 `kanban_color_by_priority='false'`，會沿用你的舊選擇（刻意保留，非 bug）。
3. 本地 dist/ 曾被 CI 重建（README 說 "Force rebuild"）— `.gitignore` 已忽略 dist，無衝突。
4. `frappe-gantt` 依賴仍在 package.json 但頁面是自己刻的 SVG — 可另開清理任務，本計劃不動（YAGNI 反向：移除有回歸風險）。
