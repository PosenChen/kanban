# 個人專案管理看板 (Kanban Project Board)

一個開源的個人專案管理工具，結合 **甘特圖（Gantt Chart）**、**看板（Kanban Board）**、**日曆視圖** 與 **待辦管理**，助力個人專案規劃與追蹤。

| 項目 | 說明 |
|------|------|
| 🌐 **部署站點** | [posenchen.github.io/kanban](https://posenchen.github.io/kanban/) |
| 📅 **專案啟動** | 2026-08-22 |
| 🔄 **最新版本** | 2026-08-31 |
| 📦 **技術架構** | React 19 + TypeScript 7 + Vite 8 + Tailwind CSS v4 |
| 🧪 **單元測試** | Vitest（14 tests passed：流水帳觸發比對、模板匯出/匯入） |
| 🐙 **原始碼** | [PosenChen/kanban](https://github.com/PosenChen/kanban) |
| 📦 **資料備份倉庫** | [PosenChen/kanban-data](https://github.com/PosenChen/kanban-data)（`data/projects.json` / `milestones.json` / `todos.json` / `routines.json`） |

---

## 🚀 功能總覽

| 功能 | 說明 |
|------|------|
| **甘特圖視圖** | 凍結式側欄 + 可滾動 SVG 時間軸（左右逐列鎖定對齊）、父/子專案分層展開、里程碑菱形◆、今日醒目標示、活動列隨機穩定色 |
| **甘特圖拖曳編輯** | 直接拖曳色塊/活動條移動日期、左右邊緣手柄縮放長短；幽靈預覽（ghost preview）、逐日吸附（day-snap）、點擊/拖曳安全區分 |
| **優先級飽和度色階** | 色塊依優先級飽和度 100/72/45 分級（`kanban_color_by_priority` 開關，預設開啟），圖例與色塊同步；淺色模式自動夾取亮度保證白字對比 |
| **看板視圖** | 四欄式（準備中 / 等待中 / 進行中 / 已完成），專案卡片含優先級標籤、進度條、剩餘天數 |
| **日曆視圖** | 按日期檢視當天專案與活動；手機單欄堆疊、桌面（≥768px）三欄並排（待辦 / 專案 / 活動） |
| **專案詳細頁** | 子專案管理、進展追蹤、實際進度標記；**匯出選單**：JSON 專案模板（含子樹）/ Word 文件（.doc） |
| **流水帳（日常例行事）** | 總覽頁 📒 流水帳彈窗：依**星期 / 月內日 / 標籤**三維度觸發（同維度 OR、跨維度 OR、全空不出現），每日勾選打勾（隔天自動失效），CRUD + GitHub 同步（`routines.json`） |
| **專案模板匯入** | 匯出含子樹的模板 JSON（`anchor_start` 記 workflow 起點）；匯入自動偵測模板 → 發新 ID、父連重掛、日期**重錨定至今日**、狀態重置準備中/進度歸零，附加不覆蓋（每年固定專案一鍵重用） |
| **活動管理** | 可新增/編輯/刪除活動，支援**跨天日期範圍**（同名且日期相鄰自動合併）、標籤篩選、甘特圖色塊顯示 |
| **待辦事項** | 名稱/優先級/說明，CRUD 操作，完成狀態標記，▲▼ 排序 |
| **搜尋與篩選** | 全文搜尋 + 狀態/優先級/標籤多條件篩選；優先級篩選**同步過濾待辦清單**，空結果顯示篩選提示 |
| **標籤快速選取** | 專案/活動表單移除預填標籤，改由「工作 / 採購 / 上課…」快速選取按鈕選標籤 |
| **專案複製** | 一鍵深層複製專案與所有子孫，名稱自動加 `Q` 後綴 |
| **排序功能** | 父專案、子專案、待辦事項皆可 ▲▼ 重排；凍結側欄與待辦清單首尾智能隱藏箭頭 |
| **展開狀態持久化** | 甘特圖父子專案展開/收合狀態存入 `localStorage`，跨頁與重載保持 |
| **深色模式** | Tailwind v4 class-based 暗色主題，light/dark/system 三檔切換，浮動切換鈕，pre-paint 防閃白 |
| **數據同步** | LocalStorage 本地儲存 + GitHub API 雲端備份（手動/自動，3 秒去抖自動上傳） |
| **資料備份/還原** | JSON 匯出/匯入，完整備份專案、活動與待辦 |

---

## 🏗️ 技術架構

- **前端框架**: React 19.2 + TypeScript 7.0
- **構建工具**: Vite 8.2（`codeSplitting: false` 相容 GitHub Pages 靜態部署）
- **路由**: React Router v7.18 (HashRouter)
- **樣式**: Tailwind CSS v4.3 (`@tailwindcss/vite`) + 自繪 SVG 甘特圖（不依賴 frappe-gantt 渲染元件）
- **狀態管理**: React hooks (`useProjects`) + `kanban:data-change` CustomEvent 驅動重繪
- **數據持久化**: LocalStorage + GitHub Content API (PosenChen/kanban-data)
- **單元測試**: Vitest（`src/utils/*.test.ts`：流水帳觸發比對、模板組裝/重掛/偏移）
- **部署**: GitHub Pages (GitHub Actions CI/CD: build → upload-pages-artifact → deploy-pages)

---

## 📁 專案結構

```
kanban/
├── index.html                # 入口（含 pre-paint 主題腳本，防暗色模式閃白）
├── package.json
├── vite.config.ts            # codeSplitting: false + @ src alias
├── tsconfig.json
├── requirements.md           # 需求規格書 + Roadmap
├── .github/workflows/deploy.yml  # GitHub Actions CI/CD
├── dist/                     # 構建輸出（供靜態部署參考）
└── src/
    ├── App.tsx               # 主應用路由 + 全域 ThemeToggle
    ├── types/
    │   └── project.ts        # 資料型別 (Project, Milestone, Todo, Routine, ProjectTemplate) + 狀態/優先級設定
    ├── data/
    │   ├── localStorageStore.ts  # 資料持久化（LocalStorage + GitHub API 同步 + migration + 模板匯入）
    │   └── sampleData.ts       # 示範資料
    ├── hooks/
    │   └── useProjects.ts      # React hook wrapper（暴露 store CRUD/排序方法）
    ├── utils/
    │   ├── dateUtils.ts        # 日期工具函數
    │   ├── theme.ts            # 主題管理（localStorage['kanban_theme'] + useTheme hook）
    │   ├── routineUtils.ts     # 流水帳觸發比對（三維度 OR）
    │   ├── routineUtils.test.ts    # 流水帳單元測試（9 tests）
    │   ├── exportUtils.ts      # 專案模板組裝/匯出 + Word HTML builder
    │   └── exportUtils.test.ts     # 模板單元測試（5 tests）
    ├── components/
    │   ├── FilterBar.tsx       # 搜尋/篩選列
    │   ├── ProjectCard.tsx     # 看板卡片
    │   ├── ProjectForm.tsx     # 專案表單
    │   └── ThemeToggle.tsx     # 深/浅主題浮動切換鈕
    ├── layouts/
    │   └── MainLayout.tsx      # 導航列
    ├── pages/
    │   ├── GanttPage.tsx       # 甘特圖總覽頁（~1460 行：凍結側欄/SVG 渲染/拖曳編輯/活動與待辦 CRUD）
    │   ├── KanbanBoard.tsx     # 看板頁面（四欄）
    │   ├── DailyPage.tsx       # 日曆詳細頁（響應式三欄）
    │   ├── ProjectDetailPage.tsx  # 專案詳細頁
    │   └── SettingsPage.tsx    # 設定與同步
    └── main.tsx
```

---

## 🔧 開發指南

```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev

# 類型檢查與構建（tsc + vite build）
npm run build

# 單元測試（vitest）
npm run test

# 預覽構建結果
npm run preview
```

部署流程：push 至 `main` → GitHub Actions 自動 build → 部署至 GitHub Pages。

---

## 🔄 數據同步

- **LocalStorage**: 預設使用瀏覽器本地儲存（keys: `kanban_projects` / `kanban_milestones` / `kanban_todos` / `kanban_routines`），所有修改即時生效
- **GitHub API**: 在設定頁填入 Personal Access Token 後可啟用雲端同步
  - 手動下載：從 `PosenChen/kanban-data` 拉取最新資料（`kanban_storage_source = "github"` 時啟用）
  - 自動上傳：修改後 3 秒去抖自動同步至 GitHub
  - 四個資料檔：`data/projects.json`、`data/milestones.json`、`data/todos.json`、`data/routines.json`
- **載入時自動遷移**: 舊格式 `date` 自動轉為 `start_date`/`end_date`；缺失或重複的 `sort_order` 自動重排為連續值

---

## 📝 數據類型

### Project（專案）
| 欄位 | 類型 | 說明 |
|------|------|------|
| id | string | 唯一識別碼 |
| name | string | 專案名稱 |
| description | string | 專案描述 |
| parent_id | string \| null | 父專案 ID（支援子專案分層） |
| sort_order | number | 排序權重（0 = 頂部，數值越大越往後） |
| start_date | string | 開始日期 (YYYY-MM-DD) |
| end_date | string | 結束日期 (YYYY-MM-DD，含末日) |
| actual_start_date? / actual_end_date? | string | 實際開工/完工日期 |
| status | ProjectStatus | 狀態：準備中/等待中/進行中/已完成 |
| priority | ProjectPriority | 優先級：高/中/低 |
| tags | string[] | 標籤陣列 |
| progress | number | 進展 0–100 |
| created_at / updated_at | string | ISO-8601 時間戳 |

### Milestone（活動）
| 欄位 | 類型 | 說明 |
|------|------|------|
| id | string | 唯一識別碼 |
| name | string | 活動名稱 |
| start_date | string | 開始日期 (YYYY-MM-DD) |
| end_date | string | 結束日期（預設 = start_date，單日活動） |
| tags | string[] | 標籤陣列 |
| description? | string | 活動說明 |
| created_at / updated_at | string | ISO-8601 時間戳 |

### Todo（待辦）
| 欄位 | 類型 | 說明 |
|------|------|------|
| id | string | 唯一識別碼 |
| name | string | 待辦名稱 |
| priority | ProjectPriority | 優先級：高/中/低 |
| sort_order | number | 排序權重（0 = 頂部） |
| description? | string | 待辦說明 |
| completed | boolean | 完成狀態 |
| created_at / updated_at | string | ISO-8601 時間戳 |

### Routine（流水帳／日常例行事）
| 欄位 | 類型 | 說明 |
|------|------|------|
| id | string | 唯一識別碼 |
| name | string | 事項名稱 |
| weekdays | number[] | 觸發星期（0=日 … 6=六），同維度內 OR |
| monthDays | number[] | 觸發月內日（1..31），同維度內 OR |
| tags | string[] | 今日活動含任一標籤即觸發 |
| sort_order | number | 排序權重（0 = 頂部） |
| completed_date? | string | 最後勾選日（YYYY-MM-DD），隔天自動失效 |
| created_at / updated_at | string | ISO-8601 時間戳 |

> 觸發語意：同一維度內 OR、跨維度 OR、全空條件 = 永不出現。

### ProjectTemplate（專案模板）
| 欄位 | 類型 | 說明 |
|------|------|------|
| kind | `'kanban-project-template'` | 模板識別標記（匯入時自動偵測） |
| version | number | 模板格式版本（目前 1） |
| exported_at | string | 匯出時間戳 |
| anchor_start | string | 子樹最早開始日期（匯入時日期依此重錨定） |
| projects | Project[] | 深度優先排序的子樹（父在子前） |

---

## 📜 更新歷史

### 🗓️ 2026-08-22 — 專案啟動
- TypeScript、Vite、Tailwind CSS 專案初始化
- GitHub Actions CI/CD 自動化部署（`.nojekyll` + 相對 base path）
- 改用 HashRouter 兼容 GitHub Pages 靜態部署

### 🗓️ 2026-08-22 ~ 08-24 — 核心功能建設
- 甘特圖可滾動時間軸、日/月標籤、根專案列
- 看板視圖（四欄）+ 今日醒目標示
- GitHub API 資料持久化（移除 Firebase 方案）
- 設定頁工具列整合

### 🗓️ 2026-08-25 — 功能大爆發
- 里程碑獨立為一類物件 → 更名為「活動」，統一橫列顯示 + CRUD 彈窗
- 活動標籤/說明欄位 + 標籤篩選器
- 待辦物件問世：CRUD + GitHub 同步 + 備份
- 專案與活動深層複製（`Q` 後綴）
- 待辦/專案排序按鈕第一版

### 🗓️ 2026-08-26 — 排序功能與同步修正
- 排序功能完成：父專案/子專案/待辦 ▲▼ 重排（含 6 個 bug 修正，最終改為「重排 + 重指派連續 sort_order」演算法）
- `sort_order` 欄位加入 Project 與 Todo 類型
- `loadFromGitHub()` 不再強制覆寫狀態；migration 同時修復缺失與重複的 `sort_order`

### 🗓️ 2026-08-27 — 佈局與主題
- 活動升級為**日期範圍**（`start_date`/`end_date`）：多日活動色塊 + 載入時同名相鄰自動合併
- 甘特圖今日醒目標示（紅線 + 紅色日期數字）
- **深色模式**：Tailwind v4 class-based 暗色 + 浮動切換鈕 + `utils/theme.ts` + pre-paint 防閃白
- DailyPage 響應式三欄佈局（手機堆疊 / 桌面並排）+ 返回總覽按鈕

### 🗓️ 2026-08-28 — 甘特圖渲染定案
- 凍結側欄與 SVG 逐列鎖定（lockstep）：父專案展開時不重複推送，修復左右錯位與 React key 重複
- 展開/收合狀態持久化至 `localStorage['kanban_expanded']`
- 色塊寬度含末日（8/24~8/31 佔 8 欄）；等待中狀態改橘 `#F97316` 避免與進行中藍撞色
- 窄色塊（≤36px）顯示名稱前 2 字；單日色塊固定 1 欄
- **里程碑菱形（方案 A）**：父專案收合時，一日長子專案以 8px 菱形◆顯示於父列，點擊展開

### 🗓️ 2026-08-29 — 優先級色彩系統
- 甘特圖色塊**飽和度色階**：高/中/低 → 100/72/45，開關預設開啟（`kanban_color_by_priority`），圖例與色塊即時同步
- 淺色模式自動夾取（clamp）去飽和色塊亮度，保證白色名稱文字對比可讀
- 重構：飽和度開關 storage key 去重、JSX 結構修正

### 🗓️ 2026-08-30 — 甘特圖互動編輯
- **拖曳色塊/活動條直接移動日期**、左右邊緣手柄**縮放長短**：幽靈預覽、逐日吸附、點擊與拖曳安全區分（click-safe）
- 「＋新增」改為直接開啟專案表單彈窗（不再先建立佔位專案）；新增子專案後自動展開父專案

### 🗓️ 2026-08-31 — 流水帳、專案模板與單元測試
- **流水帳（Routine）**：`Routine` 型別 + 三維度 OR 觸發比對（星期/月內日/標籤）、總覽頁 📒 彈窗（今日清單 + 勾選 + 編輯）、store CRUD + `routines.json` GitHub 同步
- **專案模板匯出/匯入**：子樹深度優先收集、`anchor_start` 錨定、匯入發新 ID + 父連重掛 + 日期重錨定今日 + 狀態重置；匯入自動偵測模板 JSON（附加不覆蓋）
- **專案詳細頁匯出選單**：JSON 專案模板（含子專案）/ Word 文件（.doc）
- **篩選增強**：優先級篩選同步過濾待辦清單、空結果顯示篩選提示、排序箭頭改依可見清單
- **標籤快速選取**：表單移除「活動」預填，改工作/採購/上課…快速按鈕
- **工程化**：引入 Vitest 單元測試（`routineUtils` 9 + `exportUtils` 5 = 14 tests passed）

---

## 🗺️ Roadmap

- [x] 排序功能（排序按鈕 UI）
- [x] GitHub 同步狀態 migration 修正
- [x] 深色/淺色主題切換
- [x] 活動日期範圍 + 自動合併
- [x] 甘特圖拖曳移動/縮放色塊
- [x] 流水帳（日常例行事）三維度觸發 + 每日勾選
- [x] 專案模板匯出/匯入（日期重錨定，年度固定專案重用）
- [x] 優先級篩選同步過濾待辦
- [ ] 待辦事項的日期關聯
- [ ] 專案子任務管理
- [ ] 更多視覺自訂選項

---

## 📄 License

MIT

---

*最後更新：2026-09-01*
