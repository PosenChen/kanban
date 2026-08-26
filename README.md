# 個人專案管理看板 (Kanban Project Board)

一個開源的個人專案管理工具，結合 **甘特圖（Gantt Chart）**、**看板（Kanban Board）**、**日曆視圖** 與 **待辦管理**，助力個人專案規劃與追蹤。

| 項目 | 說明 |
|------|------|
| 🌐 **部署站點** | [posenchen.github.io/kanban](https://posenchen.github.io/kanban/) |
| 📅 **專案啟動** | 2026-08-22 |
| 🔄 **最新版本** | 2026-08-26 |
| 📦 **技術棧** | React 19 + TypeScript + Vite 8 + Tailwind CSS v4 |
| 🐙 **原始碼** | [PosenChen/kanban](https://github.com/PosenChen/kanban) |
| 📊 **同步倉庫** | [PosenChen/kanban-data](https://github.com/PosenChen/kanban-data) |

---

## 🚀 功能總覽

| 功能 | 說明 |
|------|------|
| **甘特圖視圖** | 可滾動時間軸、父/子專案分層、里程碑橫列、今日醒目標示、標籤/狀態/優先級篩選 |
| **看板視圖** | 四欄式（準備中 / 等待中 / 進行中 / 已完成），專案卡片含優先級標籤、進度條、剩餘天數 |
| **日曆視圖** | 按日期檢視當天專案，支持「今天啟動」與「今天到期」分類 |
| **專案詳細頁** | 子專案管理、進展追蹤、實際進度標記 |
| **活動管理** | 可新增/編輯/刪除活動里程碑，支援標籤系統與篩選 |
| **待辦事項** | 名稱/優先級/說明，CRUD 操作，完成狀態標記 |
| **搜尋與篩選** | 全文搜尋 + 狀態/優先級/標籤多條件篩選 |
| **專案複製** | 一鍵複製專案與活動，同名自動加 `Q` 後綴 |
| **排序功能** | 父專案順序、子專案順序、待辦事項排序，含拖曳按鈕 UI |
| **數據同步** | LocalStorage 本地儲存 + GitHub API 雲端備份（手動/自動） |
| **資料備份/還原** | JSON 匯出/匯入，完整備份專案、活動與待辦 |

---

## 🏗️ 技術架構

- **前端框架**: React 19 + TypeScript
- **構建工具**: Vite 8
- **路由**: React Router v7 (HashRouter)
- **樣式**: Tailwind CSS v4 + Autoprefixer
- **甘特圖庫**: frappe-gantt v1
- **狀態管理**: React hooks (useProjects)
- **數據持久化**: LocalStorage + GitHub API (posenchen/kanban-data)
- **部署**: GitHub Pages (GitHub Actions CI/CD)

---

## 📜 更新歷史

專案於 **2026 年 8 月 22 日** 啟動，僅用三天內（8/22–8/25）完成從 0 到 1 的快速迭代，共 **48 次提交**：

### 🗓️ 2026-08-22 — 專案啟動
- `Initial commit: Kanban board V1` — 專案初始化，配置 TypeScript、Vite、Tailwind CSS
- Setup GitHub Actions CI/CD for Pages deployment — 自動化部署流程
- Add `.nojekyll` — 確保 GitHub Pages 正確構建
- Fix base path for GitHub Pages — 修正相對路徑部署問題
- Switch to HashRouter — 改用 HashRouter 兼容 GitHub Pages 靜態部署
- Trigger rebuild for HashRouter — 觸發構建更新

### 🗓️ 2026-08-22 ~ 08-24 — 核心功能建設
- Add debug logging / pre-render loading — 除錯與錯誤顯示改善
- Disable code splitting for GitHub Pages — 優化靜態部署
- Redesign Gantt: scrollable timeline — 甘特圖可滾動時間軸、日首日標籤、月份標籤
- Gantt redesign: narrow date cols, root-project rows — 重新設計甘特圖佈局
- Fix: today button always jumps to actual today — 今日按鈕行為修正
- Add calendar-style milestone highlights — 活動里程碑視覺標記
- Fix: use relative base path — GitHub Pages 路徑修正
- Add Kanban board view: Today button — 新增看板視圖
- Fix GitHub API syntax errors — GitHub API 整合修正
- Add Firebase Firestore integration — Firebase 雲端同步支援（後續移除）
- Remove Firebase, keep GitHub API — 改用 GitHub API 作為數據持久化
- Add settings button to toolbar — 設定頁工具列整合

### 🗓️ 2026-08-25 — 功能大爆發

**里程碑→活動重構系列：**
- refactor: 里程碑獨立為一類物件 — 里程碑從專案狀態獨立為獨立數據類型
- fix: 里程碑改為統一橫列顯示 — 移動至專案下方統一展示
- fix: 里程碑列移到專案上方 — 日期格→里程碑列→專案列三層佈局
- fix: 里程碑色塊對齊日期列 — 修正偏移量與視圖範圍
- feat: 新增「新增里程碑」按鈕 + 彈出表單 — 互動式新增
- feat: 里程碑支援點擊編輯/刪除 — 色塊可直接操作
- feat: 里程碑→活動 — UI 文字統一改名為「活動」

**活動增强：**
- feat: 活動新增標籤與說明欄位 + GitHub 同步活動資料
- feat: 活動標籤納入篩選 + 側邊欄名稱可點擊 + 所有標籤納入篩選器
- feat: 日曆頁面新增「+ 新增今天的活動」按鈕

**待辦管理：**
- feat: 新增待辦物件 — 名稱/優先級/說明, 總覽頁面顯示與 CRUD, GitHub 同步, 備份包含待辦

**專案複製：**
- feat: 專案與活動增加複製功能 — 同名後加 Q，其餘屬性完整複製

**看板視圖：**
- feat: 新增「看板」頁面 + 專案狀態「等待中」— 看板頁面含四欄
- enhance: 今日位置醒目標示 — 實線 + 淺紅列 + Today 徽章

**甘特圖精修：**
- Fix: 甘特圖父/子專案條不重疊 — 父專案條置頂 + 間距 + 子專案區下方
- Fix: 甘特圖色塊長度計算 — 使用專案自身日期計算條長
- Fix: 修正 UTF-8 中文字亂碼 — 使用 TextEncoder/TextDecoder 正確編解碼
- Fix: 修復 GitHub 讀取功能 — 模板字串修正 + 下載按鈕

### 🗓️ 2026-08-26 — 排序功能與同步修正

**排序功能（新功能）：**
- feat: 新增排序功能 — 父專案順序、子專案順序、待辦事項順序，含拖曳按鈕 UI
- fix: 排序按鈕 12×8 → 14×10，字體 6 → 8px

**數據類型擴展：**
- `sort_order` 欄位加入 Project 與 Todo 類型（0 = 頂部，數值越大越往後）

**GitHub 同步修正：**
- fix: loadFromGitHub 不再強制覆蓋狀態，只對 milestone 狀態做 migration
- fix: migration 只補 missing sort_order，不覆蓋既有狀態

---

## 📁 專案結構

```
kanban/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── .github/workflows/        # GitHub Actions CI/CD
├── dist/                     # 構建輸出
└── src/
    ├── App.tsx               # 主應用路由
    ├── types/
    │   └── project.ts        # 類型定義 (Project, Milestone, Todo)
    ├── data/
    │   ├── localStorageStore.ts  # 數據存儲與 GitHub API
    │   └── sampleData.ts       # 示範資料
    ├── hooks/
    │   └── useProjects.ts      # 專案管理 Hook
    ├── utils/
    │   └── dateUtils.ts        # 日期工具函數
    ├── components/
    ├── pages/
    │   ├── GanttPage.tsx       # 甘特圖頁面
    │   ├── KanbanBoard.tsx     # 看板頁面
    │   ├── DailyPage.tsx       # 日曆頁面
    │   ├── ProjectDetailPage.tsx  # 專案詳細頁
    │   └── SettingsPage.tsx    # 設定頁面
    └── main.tsx
```

---

## 🔧 開發指南

```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev

# 類型檢查與構建
npm run build

# 預覽構建結果
npm run preview
```

---

## 🔄 數據同步

- **LocalStorage**: 預設使用瀏覽器本地儲存，所有修改即時生效
- **GitHub API**: 設置 Personal Access Token 後可啟用雲端同步
  - 手動下載：從 GitHub 拉取最新資料
  - 自動上傳：修改後 3 秒自動同步至 GitHub
  - 支援三個資料檔：`projects.json`、`milestones.json`、`todos.json`

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
| end_date | string | 結束日期 (YYYY-MM-DD) |
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
| date | string | 活動日期 (YYYY-MM-DD) |
| tags | string[] | 標籤陣列 |
| description | string | 活動說明 |
| created_at / updated_at | string | ISO-8601 時間戳 |

### Todo（待辦）
| 欄位 | 類型 | 說明 |
|------|------|------|
| id | string | 唯一識別碼 |
| name | string | 待辦名稱 |
| priority | ProjectPriority | 優先級：高/中/低 |
| sort_order | number | 排序權重（0 = 頂部） |
| description | string | 待辦說明 |
| completed | boolean | 完成狀態 |

---

## 🗺️ Roadmap

- [ ] 活動甘特圖條整合（活動條顯示於甘特圖上）
- [ ] 待辦事项的日期關聯
- [ ] 專案子任務管理
- [ ] 更多視覺自訂選項
- [x] 排序功能（排序按鈕 UI）
- [x] GitHub 同步狀態 migration 修正

---

## 📄 License

MIT

---

*最後更新：2026-08-26*
