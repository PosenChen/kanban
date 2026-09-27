> 📖 语言：[English](README.en.md) · [繁體中文](README.md) · **简体中文**

# 个人专案管理看板 (Kanban Project Board)

一个开源的个人专案管理工具，结合 **甘特图（Gantt Chart）**、**看板（Kanban Board）**、**日历视图** 与 **待办管理**，助力个人专案规划与追踪。

| 项目 | 说明 |
|------|------|
| 🌐 **部署站点** | [posenchen.github.io/kanban](https://posenchen.github.io/kanban/) |
| 📅 **专案启动** | 2026-08-22 |
| 🔄 **最新版本** | 2026-09-27 |
| 📦 **技术架构** | React 19 + TypeScript 7 + Vite 8 + Tailwind CSS v4 |
| 🧪 **单元测试** | Vitest（102 tests passed：退场判定、拖曳落位、记帐统计、备忘筛选、流水帐触发比对、模板汇出/汇入、选题轮流、新增待办置顶、**预设标签设定/同步空覆盖防护/409冲突/跨装置合并**、store 流程） |
| 🐙 **原始码** | [PosenChen/kanban](https://github.com/PosenChen/kanban) |
| 📦 **资料备份仓库** | [PosenChen/kanban-data](https://github.com/PosenChen/kanban-data)（`data/projects.json` / `milestones.json` / `todos.json` / `routines.json` / `ledger.json` / `memos.json` / `topics.json`） |

---

## 🚀 功能总览

| 功能 | 说明 |
|------|------|
| **甘特图视图** | 冻结式侧栏 + 可滚动 SVG 时间轴（左右逐列锁定对齐）、父/子专案分层展开、里程碑菱形◆、今日醒目标示、活动列随机稳定色 |
| **甘特图拖曳编辑** | 直接拖曳色块/活动条移动日期、左右边缘手柄缩放长短；幽灵预览（ghost preview）、逐日吸附（day-snap）、点击/拖曳安全区分 |
| **优先级饱和度色阶** | 色块**一律**依优先级饱和度 100/72/45 分级（20260905 起常驻，原开关已移除），图例常显；浅色模式自动夹取亮度保证白字对比 |
| **看板视图** | 四栏式（准备中 / 等待中 / 进行中 / 已完成），专案卡片含优先级标签、进度条、剩余天数 |
| **日历视图** | 按日期检视当天专案与活动；手机单栏堆叠、桌面（≥768px）三栏并排（待办 / 专案 / 活动） |
| **专案详细页** | 子专案管理、进展追踪、实际进度标记；**汇出选单**：JSON 专案模板（含子树）/ Word 文件（.doc） |
| **流水帐（日常例行事）** | 总览页 📒 流水帐弹窗：依**星期 / 月内日 / 标签**三维度触发（同维度 OR、跨维度 OR、全空不出现），每日勾选打勾（隔天自动失效），CRUD + GitHub 同步（`routines.json`） |
| **专案模板汇入** | 汇出含子树的模板 JSON（`anchor_start` 记 workflow 起点）；汇入自动侦测模板 → 发新 ID、父连重挂、日期**重锚定至今日**、状态重置准备中/进度归零，附加不覆盖（每年固定专案一键重用） |
| **活动管理** | 可新增/编辑/删除活动，支援**跨天日期范围**（同名且日期相邻自动合并）、标签筛选、甘特图色块显示 |
| **待办事项** | 名称/优先级/说明，CRUD 操作，完成状态标记，▲▼ 排序 |
| **自动退场（档案库）** | 完成逾期的专案群组／活动／待办自动退场（预设 14 天，设定页可调 `kanban_archive_days`），总览全数过滤；`/archive` 页按月分组，一键还原（专案自动补还祖先链）或确认后永久删除，**绝不自动删除资料** |
| **搜寻与筛选** | 全文搜寻 + 状态/优先级/标签多条件筛选；优先级筛选**同步过滤待办清单**，空结果显示筛选提示 |
| **标签快速选取** | 专案/活动表单移除预填标签，改由「工作 / 采购 / 上课…」快速选取按钮选标签 |
| **专案复制** | 一键深层复制专案与所有子孙，名称自动加 `Q` 后缀 |
| **排序功能** | 父专案、子专案、待办事项皆可 ▲▼ 重排；冻结侧栏与待办清单首尾智能隐藏箭头 |
| **拖曳排序** | 侧栏专案（限同群组）与待办清单直接拖曳落位，蓝色插入线指示、幽灵半透明；▲▼ 保留为触控/无障碍备用 |
| **记帐（收支）** | `/ledger` 随手记收入／支出（日期／金额／类别／备注），月度收入・支出・净额卡＋支出分类占比条，快速类别选取，CRUD + 确认删除 + GitHub 同步（`ledger.json`） |
| **备忘录** | `/memo` 随记便条（标题／内文／标签），关键字搜寻＋标签筛选＋📌 置顶，原生 `<details>` 折页，CRUD + GitHub 同步（`memos.json`） |
| **选题库（每日一文）** | `/topics` 主题池 FIFO 轮流：「今日题」大卡自动举题（未交卷明日黏住同题），✍️ 领题 → ✅ 交卷、▲▼ 调序、本月交卷统计、CRUD + GitHub 同步（`topics.json`） |
| **展开状态持久化** | 甘特图父子专案展开/收合状态存入 `localStorage`，跨页与重载保持 |
| **深色模式** | Tailwind v4 class-based 暗色主题，light/dark/system 三档切换，浮动切换钮，pre-paint 防闪白 |
| **预设标签（快速选取）** | 设定页 🏷️ 可编辑各表单快速点选的候选：专案／活动（甘特图）、记帐、备忘、选题各一组；增删即生效、可一键还原预设，存本机 `kanban_tag_presets`、不上云端 |
| **数据同步** | LocalStorage 本地储存 + GitHub API 云端备份；**自动上传**（3 秒去抖）＋**自动下载合并**（开站／切回视窗节流 30s）＋手动下载/上传 |
| **同步防护（防误覆盖）** | 本地空＋云端非空 → **自动跳过上传**（绝不把云端清空）；sha 冲突侦测（其他装置先改 → 409 中止并提示先下载合并）；手动上传前确认框显示**本地/云端六档笔数比对**；上传失败如实报错；`kanban-data` 仓库 Actions **每日快照** `backups/YYYYMMDD/` 保留 90 天 |
| **资料备份/还原** | JSON 汇出/汇入，完整备份专案、活动与待办 |

---

## 🏗️ 技术架构

- **前端框架**: React 19.2 + TypeScript 7.0
- **构建工具**: Vite 8.2（`codeSplitting: false` 相容 GitHub Pages 静态部署）
- **路由**: React Router v7.18 (HashRouter)
- **样式**: Tailwind CSS v4.3 (`@tailwindcss/vite`) + 自绘 SVG 甘特图（不依赖 frappe-gantt 渲染元件）
- **状态管理**: React hooks (`useProjects`) + `kanban:data-change` CustomEvent 驱动重绘
- **数据持久化**: LocalStorage + GitHub Content API (PosenChen/kanban-data)
- **单元测试**: Vitest（18 test files / 102 tests：退场判定、拖曳落位重排、流水帐触发、记帐统计、备忘筛选、选题轮流、新增待办置顶、预设标签、同步防护/跨装置合并、模板汇出/汇入、store 整合流程）
- **部署**: GitHub Pages (GitHub Actions CI/CD: build → upload-pages-artifact → deploy-pages)

---

## 📁 专案结构

```
kanban/
├── index.html                # 入口（含 pre-paint 主题脚本，防暗色模式闪白）
├── package.json
├── vite.config.ts            # codeSplitting: false + @ src alias + 相对 base path（任意子路径部署）
├── tsconfig.json
├── requirements.md           # 需求规格书 + Roadmap
├── .github/workflows/deploy.yml  # GitHub Actions CI/CD（Node 20 + npm ci → build → Pages）
└── src/
    ├── App.tsx               # 主应用路由（/ /board /project/:id /daily/:date? /ledger /memo /topics /archive /settings）+ 全域 ThemeToggle
    ├── main.tsx
    ├── types/
    │   └── project.ts        # 资料型别 (Project, Milestone, Todo, Routine, LedgerEntry, Memo, Topic, ProjectTemplate) + 状态/优先级设定
    ├── data/
    │   ├── localStorageStore.ts  # Unified store：LocalStorage + GitHub API 同步（mergeById 合并/自动推送安全门）+ migration + 模板汇入 + 自动退场
    │   ├── sampleData.ts         # 示范资料（仅首次载入 seed；初始化期不自动推送上云）
    │   ├── store.archive.test.ts # store 退场流程整合测试（1 test）
    │   ├── store.reorder.test.ts # store 拖曳落位测试（6 tests）
    │   ├── store.ledger.test.ts  # store 记帐 CRUD 测试（2 tests）
    │   ├── store.memo.test.ts    # store 备忘 CRUD 测试（2 tests）
    │   ├── store.todo.test.ts    # store 新增待办置顶测试（3 tests）
    │   ├── store.topic.test.ts   # store 选题 CRUD/轮流测试（4 tests）
    │   ├── store.syncguard.test.ts # store 同步防护：空覆盖跳过/上传/409（4 tests）
    │   └── store.crossdevice.test.ts # store 跨装置合并（双装置 mock，相对日期，3 tests）
    ├── hooks/
    │   ├── useProjects.ts      # React hook wrapper（暴露 store CRUD/排序方法）
    │   └── useDragReorder.ts   # 列表拖曳共用状态机（插入线/幽灵/落位）
    ├── utils/
    │   ├── dateUtils.ts        # 日期工具函数
    │   ├── theme.ts            # 主题管理（localStorage['kanban_theme'] + useTheme hook）
    │   ├── routineUtils.ts     # 流水帐触发比对（三维度 OR）
    │   ├── routineUtils.test.ts    # 流水帐单元测试（9 tests）
    │   ├── archiveUtils.ts        # 退场判定纯函式（个别物件 / 父＋子孙群组，门槛日数）
    │   ├── archiveUtils.test.ts    # 退场判定单元测试（16 tests）
    │   ├── reorderUtils.ts      # 拖曳落位纯函式（reorderToSlot/nextIdAfter）
    │   ├── reorderUtils.test.ts    # 落位单元测试（8 tests）
    │   ├── ledgerUtils.ts       # 记帐月比对／round2／分类统计
    │   ├── ledgerUtils.test.ts     # 记帐单元测试（5 tests）
    │   ├── memoUtils.ts         # 备忘筛选纯函式（关键字/标签/置顶排序）
    │   ├── memoUtils.test.ts       # 备忘单元测试（5 tests）
    │   ├── topicUtils.ts          # 选题轮流纯函式（todayTopic/领题/交卷/调序/重排）
    │   ├── topicUtils.test.ts       # 选题单元测试（7 tests）
    │   ├── exportUtils.ts      # 专案模板组装/汇出 + 日期重锚定 + Word HTML builder
    │   ├── exportUtils.test.ts     # 模板单元测试（5 tests）
    │   ├── syncGuardUtils.ts   # 同步防护纯函式（空覆盖跳过/计划/mergeById 合并/差异侦测/笔数摘要）
    │   ├── syncGuardUtils.test.ts  # 同步防护单元测试（7 tests）
    │   ├── syncMerge.test.ts   # 跨装置 mergeById 合并单测（9 tests）
    │   ├── tagPresets.ts       # 预设标签（快速选取）设定：get/set/reset/clean，存 kanban_tag_presets
    │   └── tagPresets.test.ts  # 预设标签单元测试（6 tests）
    ├── components/
    │   ├── FilterBar.tsx       # 搜寻/筛选列
    │   ├── ProjectCard.tsx     # 看板卡片
    │   ├── ProjectForm.tsx     # 专案表单
    │   └── ThemeToggle.tsx     # 深/浅主题浮动切换钮
    ├── layouts/
    │   └── MainLayout.tsx      # 导航列
    └── pages/
        ├── GanttPage.tsx       # 甘特图总览页（冻结侧栏/SVG 渲染/拖曳编辑/拖曳排序/活动与待办 CRUD）
        ├── KanbanBoard.tsx     # 看板页面（四栏）
        ├── DailyPage.tsx       # 日历详细页（响应式三栏）
        ├── ProjectDetailPage.tsx  # 专案详细页（含返回父专案）
        ├── LedgerPage.tsx      # 记帐页（/ledger：收支＋月度统计）
        ├── MemoPage.tsx        # 备忘录页（/memo：便条＋搜寻＋标签＋📌 置顶）
        ├── TopicsPage.tsx      # 选题库页（/topics：今日题大卡＋轮流池＋交卷统计）
        ├── ArchivePage.tsx     # 档案库页（/archive：按月分组、还原／永久删除）
        └── SettingsPage.tsx    # 设定与同步（含退场门槛日数、云端/本地模式）
```

> 构建输出 `dist/` 不入库：CI 每次 build 重新产生（`.gitignore` 排除），GitHub Pages 由 Actions 直接部署，本地 `npm run build` 即可预览。

---

## 🔧 开发指南

```bash
# 安装依赖
npm install

# 启动开发伺服器
npm run dev

# 类型检查与构建（tsc + vite build）
npm run build

# 单元测试（vitest）
npm run test

# 预览构建结果
npm run preview
```

部署流程：push 至 `main` → GitHub Actions 自动 build → 部署至 GitHub Pages。

---

## 🚀 给他人部署：自建同款站点

 Fork 本仓库后依以下四步即可拥有自己的看板（以 GitHub 帐号 `YOURNAME` 为例）。

### 1️⃣ Fork 并启用 GitHub Pages
1. 在仓库页面右上点 **Fork**，分叉到自己的帐号。
2. 进入 Fork 仓库 **Settings → Pages**，**Build and deployment / Source** 选 **GitHub Actions**。
3. **Settings → Actions → General / Workflow permissions** 确认勾选 *Read and write permissions*（deploy-pages 需要）。

### 2️⃣ 推触 CI 自动部署
推一次 `main`（任意 commit，或 Actions 页 **Run workflow** 手动触发）即自动完成 `npm ci → tsc + vite build → deploy-pages`。站点地址为 `https://YOURNAME.github.io/<仓库名>/`——本专案使用 HashRouter + 相对 base path（`base: './'`），**任意仓库名／子路径都免改设定**。

### 3️⃣（推荐）建自己的资料备份仓库
> ⚠️ 云端同步目标目前于 `src/data/localStorageStore.ts` 内**硬编码**为 `PosenChen/kanban-data`（共两处 `api.github.com/repos/...`）。不改的话本地上传会 403（无写入权限），但**纯 LocalStorage 模式不受影响**，可直接跳至步骤 4。

1. 新建仓库 `YOURNAME/kanban-data`（公开／私有皆可，私有需同帐号 Token）。
2. 在该仓库预先建好七个空资料档：`data/projects.json`、`data/milestones.json`、`data/todos.json`、`data/routines.json`、`data/ledger.json`、`data/memos.json`、`data/topics.json`（内容各为 `[]`）。
3. 把 `src/data/localStorageStore.ts` 中两处 `PosenChen/kanban-data` 改为 `YOURNAME/kanban-data`，commit 推上 `main`。
4. （选用）把 [PosenChen/kanban-data](https://github.com/PosenChen/kanban-data) 的 `.github/workflows/daily-backup.yml` 复制到你的资料仓库，享每日快照保留 90 天；不用则删，不影响主站。

### 4️⃣ 启用云端同步（或使用纯本地模式）
1. 到 GitHub **Settings → Developer settings → Personal access tokens** 产生 Token：classic 勾 `repo` 范畴；或 fine-grained PAT 只授权 `kanban-data` 仓库 **Contents: Read and write**。
2. 开站 → **设定页** 贴上 Token 并储存 → 即可手动下载／上传；切至云端模式后，修改经 3 秒去抖自动上传。
3. **不用云端也能用**：预设纯 LocalStorage 模式，资料即时存浏览器；定期用设定页 **汇出 JSON** 备份、**汇入 JSON** 还原。

### ❓ 常见问题
| 状况 | 原因与解法 |
|------|-----------|
| CI build 失败 | Actions 钉选 Node 20；本机请用 Node 20+ |
| 云端上传 403 | Token 无 `kanban-data` 写入权限，或忘记改步骤 3️⃣ 的硬编码仓库名 |
| 云端上传 409 | 其他装置先改过云端——先到设定页「下载」合并再上传 |
| Pages 404 | Source 未选 GitHub Actions，或 deploy job 尚未完成 |

---

## 🔄 数据同步

- **LocalStorage**: 预设使用浏览器本地储存（keys: `kanban_projects` / `kanban_milestones` / `kanban_todos` / `kanban_routines` / `kanban_ledger` / `kanban_memos` / `kanban_topics`），所有修改即时生效
- **GitHub API**: 在设定页填入 Personal Access Token 后可启用云端同步
  - 手动下载：从 `PosenChen/kanban-data` 拉取最新资料（`kanban_storage_source = "github"` 时启用）
  - 自动上传：修改后 3 秒去抖自动同步至 GitHub
  - 自动下载合并：开站／切回视窗／visibilitychange 自动拉取（节流 30s），七类资料依 `mergeById()` 合并——同 ID 以 `updated_at` 新者胜出（tie 留本地），故其他装置的待办勾选／流水帐打勾／专案进度能跨装置刷新
  - 七个资料档：`data/projects.json`、`data/milestones.json`、`data/todos.json`、`data/routines.json`、`data/ledger.json`、`data/memos.json`、`data/topics.json`
- **载入时自动迁移**: 旧格式 `date` 自动转为 `start_date`/`end_date`；缺失或重复的 `sort_order` 自动重排为连续值
- **自动退场**: 载入时执行 `autoArchive()` —— 已完成且逾期 ≥ `kanban_archive_days`（预设 14 天）的物件打上 `archived_at` 标记退场至档案库；专案采**群组规则**（父与全部子孙都完成、以最晚结束日计），只标记、绝不删除

---

## 📝 数据类型

### Project（专案）
| 栏位 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一识别码 |
| name | string | 专案名称 |
| description | string | 专案描述 |
| parent_id | string \| null | 父专案 ID（支援子专案分层） |
| sort_order | number | 排序权重（0 = 顶部，数值越大越往后） |
| start_date | string | 开始日期 (YYYY-MM-DD) |
| end_date | string | 结束日期 (YYYY-MM-DD，含末日) |
| actual_start_date? / actual_end_date? | string | 实际开工/完工日期 |
| status | ProjectStatus | 状态：准备中/等待中/进行中/已完成 |
| priority | ProjectPriority | 优先级：高/中/低 |
| tags | string[] | 标签阵列 |
| progress | number | 进展 0–100 |
| archived_at? | string | 退场日（YYYY-MM-DD）；undefined = 仍在总览 |
| created_at / updated_at | string | ISO-8601 时间戳 |

### Milestone（活动）
| 栏位 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一识别码 |
| name | string | 活动名称 |
| start_date | string | 开始日期 (YYYY-MM-DD) |
| end_date | string | 结束日期（预设 = start_date，单日活动） |
| tags | string[] | 标签阵列 |
| description? | string | 活动说明 |
| archived_at? | string | 退场日（YYYY-MM-DD）；undefined = 仍在总览 |
| created_at / updated_at | string | ISO-8601 时间戳 |

### Todo（待办）
| 栏位 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一识别码 |
| name | string | 待办名称 |
| priority | ProjectPriority | 优先级：高/中/低 |
| sort_order | number | 排序权重（0 = 顶部） |
| description? | string | 待办说明 |
| completed | boolean | 完成状态 |
| archived_at? | string | 退场日（YYYY-MM-DD）；undefined = 仍在总览 |
| created_at / updated_at | string | ISO-8601 时间戳 |

### Routine（流水帐／日常例行事）
| 栏位 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一识别码 |
| name | string | 事项名称 |
| weekdays | number[] | 触发星期（0=日 … 6=六），同维度内 OR |
| monthDays | number[] | 触发月内日（1..31），同维度内 OR |
| tags | string[] | 今日活动含任一标签即触发 |
| sort_order | number | 排序权重（0 = 顶部） |
| completed_date? | string | 最后勾选日（YYYY-MM-DD），隔天自动失效 |
| created_at / updated_at | string | ISO-8601 时间戳 |

> 触发语意：同一维度内 OR、跨维度 OR、全空条件 = 永不出现。

### LedgerEntry（记帐／收支）
| 栏位 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一识别码 |
| date | string | 日期 (YYYY-MM-DD) |
| kind | LedgerKind | `income` 收入／`expense` 支出 |
| amount | number | 金额 > 0，单位 TWD |
| category | string | 类别（餐饮/交通/工资…，快速选取按钮） |
| note? | string | 备注 |
| created_at / updated_at | string | ISO-8601 时间戳 |

### Memo（备忘录／便条）
| 栏位 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一识别码 |
| title | string | 简短标题（没填时由内文截断补） |
| content | string | 内文（可空）；title/content 至少一非空 |
| tags | string[] | 标签阵列（待跟进/灵感/电话…快速选取） |
| date | string | 记录日 (YYYY-MM-DD，预设今日) |
| pinned? | boolean | 📌 置顶 |
| created_at / updated_at | string | ISO-8601 时间戳 |

### Topic（选题库／每日一文）
| 栏位 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一识别码 |
| title | string | 主题标题（必填） |
| outline? | string | 大纲／灵感（正文外链不入库） |
| tags | string[] | 标签（散文/技术/随笔…快速选取） |
| status | TopicStatus | `pool` 储备／`writing` 撰写中／`done` 已交卷 |
| sort_order | number | 池内轮流顺序（0 = 队首先写） |
| added_date | string | 入库日 (YYYY-MM-DD) |
| done_date? | string | 交卷日；undefined = 未交卷 |
| created_at / updated_at | string | ISO-8601 时间戳 |

> 轮流语意：今日题 = writing 黏住顺延；无 writing 则举 sort_order 最小之 pool；池空提示储备。

### ProjectTemplate（专案模板）
| 栏位 | 类型 | 说明 |
|------|------|------|
| kind | `'kanban-project-template'` | 模板识别标记（汇入时自动侦测） |
| version | number | 模板格式版本（目前 1） |
| exported_at | string | 汇出时间戳 |
| anchor_start | string | 子树最早开始日期（汇入时日期依此重锚定） |
| projects | Project[] | 深度优先排序的子树（父在子前） |

---

## 📜 更新历史

### 🗓️ 2026-08-22 — 专案启动
- TypeScript、Vite、Tailwind CSS 专案初始化
- GitHub Actions CI/CD 自动化部署（`.nojekyll` + 相对 base path）
- 改用 HashRouter 兼容 GitHub Pages 静态部署

### 🗓️ 2026-08-22 ~ 08-24 — 核心功能建设
- 甘特图可滚动时间轴、日/月标签、根专案列
- 看板视图（四栏）+ 今日醒目标示
- GitHub API 资料持久化（移除 Firebase 方案）
- 设定页工具列整合

### 🗓️ 2026-08-25 — 功能大爆发
- 里程碑独立为一类物件 → 更名为「活动」，统一横列显示 + CRUD 弹窗
- 活动标签/说明栏位 + 标签筛选器
- 待办物件问世：CRUD + GitHub 同步 + 备份
- 专案与活动深层复制（`Q` 后缀）
- 待办/专案排序按钮第一版

### 🗓️ 2026-08-26 — 排序功能与同步修正
- 排序功能完成：父专案/子专案/待办 ▲▼ 重排（含 6 个 bug 修正，最终改为「重排 + 重指派连续 sort_order」演算法）
- `sort_order` 栏位加入 Project 与 Todo 类型
- `loadFromGitHub()` 不再强制覆写状态；migration 同时修复缺失与重复的 `sort_order`

### 🗓️ 2026-08-27 — 布局与主题
- 活动升级为**日期范围**（`start_date`/`end_date`）：多日活动色块 + 载入时同名相邻自动合并
- 甘特图今日醒目标示（红线 + 红色日期数字）
- **深色模式**：Tailwind v4 class-based 暗色 + 浮动切换钮 + `utils/theme.ts` + pre-paint 防闪白
- DailyPage 响应式三栏布局（手机堆叠 / 桌面并排）+ 返回总览按钮

### 🗓️ 2026-08-28 — 甘特图渲染定案
- 冻结侧栏与 SVG 逐列锁定（lockstep）：父专案展开时不重复推送，修复左右错位与 React key 重复
- 展开/收合状态持久化至 `localStorage['kanban_expanded']`
- 色块宽度含末日（8/24~8/31 占 8 栏）；等待中状态改橘 `#F97316` 避免与进行中蓝撞色
- 窄色块（≤36px）显示名称前 2 字；单日色块固定 1 栏
- **里程碑菱形（方案 A）**：父专案收合时，一日长子专案以 8px 菱形◆显示于父列，点击展开

### 🗓️ 2026-08-29 — 优先级色彩系统
- 甘特图色块**饱和度色阶**：高/中/低 → 100/72/45，开关预设开启（`kanban_color_by_priority`），图例与色块即时同步
- 浅色模式自动夹取（clamp）去饱和色块亮度，保证白色名称文字对比可读
- 重构：饱和度开关 storage key 去重、JSX 结构修正

### 🗓️ 2026-08-30 — 甘特图互动编辑
- **拖曳色块/活动条直接移动日期**、左右边缘手柄**缩放长短**：幽灵预览、逐日吸附、点击与拖曳安全区分（click-safe）
- 「＋新增」改为直接开启专案表单弹窗（不再先建立占位专案）；新增子专案后自动展开父专案

### 🗓️ 2026-08-31 — 流水帐、专案模板与单元测试
- **流水帐（Routine）**：`Routine` 型别 + 三维度 OR 触发比对（星期/月内日/标签）、总览页 📒 弹窗（今日清单 + 勾选 + 编辑）、store CRUD + `routines.json` GitHub 同步
- **专案模板汇出/汇入**：子树深度优先收集、`anchor_start` 锚定、汇入发新 ID + 父连重挂 + 日期重锚定今日 + 状态重置；汇入自动侦测模板 JSON（附加不覆盖）
- **专案详细页汇出选单**：JSON 专案模板（含子专案）/ Word 文件（.doc）
- **筛选增强**：优先级筛选同步过滤待办清单、空结果显示筛选提示、排序箭头改依可见清单
- **标签快速选取**：表单移除「活动」预填，改工作/采购/上课…快速按钮
- **工程化**：引入 Vitest 单元测试（`routineUtils` 9 + `exportUtils` 5 = 14 tests passed）

### 🗓️ 2026-09-01 — 流水帐与表单收尾、退场机制上线
- **编辑保留排序**：编辑专案不再跳回甘特图顶端（`sort_order` 保留）
- 工具列语意图示：📁 专案／🚩 活动取代通用 ＋；流水帐📒按钮显示完成状态（有未勾选→右上角红色圆形数字徽章（静态），全完成→翡翠勾）
- 筛选下拉移除冗余 ▾（原生 select 已有箭头）
- **自动退场（archive）核心**：`archived_at` 标记加入 Project/Todo/Milestone 三型别；`utils/archiveUtils.ts` 纯函式判定（个别物件＋父含子孙群组规则，门槛 `kanban_archive_days` 预设 14 天，TDD 16 tests）；store 载入时 `autoArchive()` 一并退场，所有总览 getter 过滤已退场项目（raw 保留 `getAllRaw`/`getArchived`）

### 🗓️ 2026-09-02 — 档案库页
- **`/archive` 档案库页**：已退场专案／活动／待办按月分组列表
- 一键**还原**：专案自动补还祖先链（`unarchiveAncestry`），避免还原子专案后在甘特图失去挂靠
- **永久删除**需确认对话框；退场只标记、绝不自动删资料
- 甘特图工具列 🗂️ 档案库入口；设定页退场门槛日数（天）可调
- 工程化：`store.archive.test.ts` 退场流程整合测试 — 全数 **31 tests passed**

### 🗓️ 2026-09-02 — 拖曳排序
- **专案／待办拖曳落位**：冻结侧栏与待办清单项目直接拖曳调整顺序，拖经合法目标显示蓝 2px 插入线（上半部=插其前、下半部=插其后），拖曳中来源列半透明
- 实作：`utils/reorderUtils.ts` 纯函式（`reorderToSlot`/`nextIdAfter`）＋ `hooks/useDragReorder.ts` 共用状态机；store 新增 `moveProjectToSlot`/`moveTodoToSlot`（同群组 siblings 重排＋连续 sort_order＋GitHub 同步沿用）
- 边界守则：**跨群组不受理**（子专案不能拖成根／换父，无指示线）；筛选态下落点依可见清单折算；HTML5 DnD 不支援触控 → ▲▼ 按钮保留

### 🗓️ 2026-09-02 — 记帐（收支）
- **`/ledger` 记帐页**：随手记一笔收入／支出（日期／金额／类别／备注），快速类别按钮（餐饮／交通／工资…），点击列编辑、✕ 确认删除
- **月度统计**：收入／支出／净额三卡＋支出分类占比条；月份 ‹／›／本月切换
- 工程：`LedgerEntry` 型别；`utils/ledgerUtils.ts` 纯函式（月比对／round2／分类统计，TDD 5）；store `addLedgerEntry/getLedger/updateLedgerEntry/removeLedgerEntry`＋`kanban_ledger`＋`data/ledger.json` GitHub 同步（载入并 merge、3 秒去抖上传）；甘特图工具列 💰 入口 — 全数 **52 tests passed**

### 🗓️ 2026-09-03 — 备忘录
- **`/memo` 备忘录页**：随记便条（标题／内文／日期／标签），📌 置顶、关键字搜寻（title/content/tags）、标签 pill 筛选、原生 `<details>` 内文折叠、点击编辑、✕ 确认删除
- 工程：`Memo` 型别；`utils/memoUtils.ts` 纯函式 `filterMemos`（TDD 5）；store `addMemo/getMemos/updateMemo/removeMemo`＋`kanban_memos`＋`data/memos.json` GitHub 同步（载入并 merge、3 秒去抖上传）；甘特图工具列 📝 入口 — 全数 **59 tests passed**

### 🗓️ 2026-09-05 — 同步防护（防误覆盖）
- **空覆盖防护**：`writeGitHub()` 上传前逐档检查——本地空阵列＋云端非空（或读取失败）→ **自动跳过**，新电脑误按上传不会清空云端（`syncGuardUtils.ts` 纯函式，TDD 7）；手动上传可选「强制上传」才放行
- **sha 冲突侦测**：下载时记录各档 sha，上传以旧 sha 验证中间未被人改；其他装置先改 → HTTP 409 抛 `SyncConflictError`，UI 明示「请先下载合并」；后端拒绝静默失败（PUT 后检查 res.ok，失败如实报错）
- **确认框比对**：手动上传前显示**本地/云端六档笔数**（`3/10` 格式），本地空档自动标⚠️预跳过
- **状态回传**：`kanban:sync-status` CustomEvent 让背景自动同步的冲突/错误/跳过也能在设定页浮现
- **云端每日快照**：`kanban-data` 新增 `daily-backup.yml` —— 每日 02:00 (UTC+8) 全数 `data/*.json` → `backups/YYYYMMDD/`，保留 90 天，可手动触发；误覆盖后有二层退路（快照＋git 历史）
- 工程：`store.syncguard.test.ts` mock fetch 验证跳过/上传/409（4 tests）— 全数 **70 tests passed**

### 🗓️ 2026-09-05 — 选题库（每日一文）
- **`/topics` 选题库**：主题池 FIFO 轮流——「今日题」大卡自动举题（`writing` 未交卷明日黏住同一题，零记忆负担）；✍️ 领题开写／✅ 交卷／↩ 放回池、池内 ▲▼ 调序、本月交卷统计徽章、历史交卷清单
- 工程：`Topic` 型别（pool/writing/done）；`utils/topicUtils.ts` 轮流纯函式（todayTopic/claimTopic/completeTopic/swapPoolOrder/reorderPoolAfterRemove，TDD 7）；store `addTopic/getTopics/todayTopic/claimTopic/completeTopic/releaseTopic/moveTopic/removeTopic`＋`kanban_topics`＋`data/topics.json` 第七档同步（含空覆盖防护／409 冲突／确认框比对七档）；甘特图工具列 📚 入口 — 全数 **81 tests passed**
- 修正：`addTopic` id 改 `Date.now()+random` 防同毫秒碰撞（原毫秒戳碰撞会致两题同 id、删一并失）

### 🗓️ 2026-09-05 — 优先级调色常驻化
- 移除「优先级调色」勾选开关与「优先级（饱和度 高→低）：」引导文字——色块／菱形**一律**依优先级调色（饱和度 100/72/45），饱和度图例常显
- 连带清除死代码：`isColorByPriority()`／`STORAGE_KEY_COLOR_BY_PRIORITY`（旧 localStorage 值残留无影响）

### 🗓️ 20260910 — 文档
- README 新增「**给他人部署：自建同款站点**」章节：Fork → Pages 设定 → 自建 `kanban-data` 资料仓（含硬编码改写位置）→ Token 与纯本地模式，附常见问题排错表

### 🗓️ 20260910 — 跨装置状态同步修正（重大）
- **根因**：`loadFromGitHub()` 对「已存在同 ID」一律跳过 → 其他装置的待办勾选、流水帐打勾、专案进度**永远进不来**
- **修正**：新增 `mergeById()` 纯函式（同 ID 以 `updated_at` 新者胜出，tie 留本地），七类资料（专案/活动/待办/流水帐/记帐/备忘/选题）下载一律合并刷新；本地较新不受云端旧值倒退
- **自动上传接上电**：`scheduleGitHubSync()` 原为死代码无人呼叫——现由七个 emit 挂上（云端模式＋3 秒去抖；纯本地模式与跨分页落地不自动推，防重复耗损配额与自撞 409）
- **自动下载**：开站／视窗 focus／visibilitychange 自动拉取合并（节流 30s；409 冲突立即 force 拉取）；拉取期间的本地修改记帐补推，不漏勾选
- 设定页同步状态显示目前模式（云端/本地）；新回归测试：`syncMerge.test.ts` 9 + `store.crossdevice.test.ts` 3（双装置情境 mock）— 全数 **93 tests passed**

### 🗓️ 20260927 — 自动推送安全门（封死样本污染云端）

- **根因**：`scheduleGitHubSync()` 在模组求值期即被 migration／`autoArchive()`→`emit` 触发——**全新装置第一次开站、尚未做任何修改**，就把预设样本资料推到云端，污染共用仓库
- **修正（多重安全门）**：`scheduleGitHubSync()` 新增五道非 force 闸门——① `initializing`（开站落地期 seed/migration/autoArchive 不推，落地完成才放开）② `_isBrowser`（node／Vitest 测试环境不触网）③ `autoPulling`（拉取中不推，拉取后由 `lastPullHadLocalChanges` 差异侦测接手补推）④ `crossTabReload`（同浏览器他页变更只刷 UI、不重复推）⑤ 纯本地模式不自动推（手动上传按钮不受限）；force 可跳过全部
- **409 自愈**：推送遇冲突（其他装置先改）→ 自动 `autoPullIfCloud(true)` 下载合并，本地保持最新，下次修改自然回推，不再卡死冲突
- 工程：双装置回归测试改采**相对日期** fixture（原固定 `2026-09-10` 时间戳随时间推进跨过 14 天退场门槛、被 `autoArchive()` 标记后从 `getTodos()` 过滤掉，是枚 flaky 时间炸弹）— 全数 **93 tests passed**
- 工程：`git rm --cached node_modules`（3,589 档）+ `.DS_Store` 取消追踪——CI 已用 `npm ci`，追踪的 `node_modules` 纯膨胀且与部署指引相冲，避免每个 Fork 继承数千无用档案

### 🗓️ 20260927 — 新增待办预设置顶

- `addTodo` 改为新项取最小 `sort_order`、其余下移重编号（0..N-1 连续）——新增／复制的待办预设显示在待办清单**最上面**（原为追加到最下面）
- 连带修 `addTodo` id 防撞：`Date.now()+random`（同 `copyProject` 模式），避免同毫秒连按新增／复制产生同 id、跨装置合并时两笔折成一首
- 工程：新增 `store.todo.test.ts`（3 tests）— 全数 **96 tests passed**

### 🗓️ 20260927 — 设定页：预设标签编辑 + 甘特图入口改名

- **甘特图工具列「同步」→「设定」**：原按钮本就导航 `/settings`（含手动同步），改名「设定」并换齿轮图示，语意更准（避免「下载 GitHub」与「设定」并列时误以为「同步」是手动同步动作）
- **预设标签（quick-pick）改为可设定**：新增 `utils/tagPresets.ts`——`TagPresets`（`project` 专案／活动／流水帐共用、`ledger`、`memo`、`topic`）存 `localStorage['kanban_tag_presets']`，预设沿用原 `QUICK_TAGS`/`LEDGER_QUICK_CATEGORIES`/`MEMO_QUICK_TAGS`/`TOPIC_QUICK_TAGS` 常数（行为不变）；`getTagPresets()/setTagPresets()/resetTagPreset()/cleanTags()`（去空白＋去重，TDD 6）
- **五处表单改读设定**：`ProjectForm`、GanttPage（活动＋流水帐）、`LedgerPage`、`MemoPage`、`TopicsPage` 的快速标签改为读 `getTagPresets()` 对应类别（每次开启表单重新读，改完即生效）
- **设定页新增「🏷️ 预设标签」**：四组可编辑标签（pill＋✕ 移除、输入＋Enter 新增、↺ 还原预设），另加「⚙️ 可设定选项」参考（预设标签／自动退场天数／深浅主题／云端同步模式；说明甘特图色块依优先级自动调色）
- 工程：`tagPresets.test.ts`（6 tests）— 全数 **102 tests passed**

---

## 🗺️ Roadmap

- [x] 排序功能（排序按钮 UI）
- [x] GitHub 同步状态 migration 修正
- [x] 深色/浅色主题切换
- [x] 活动日期范围 + 自动合并
- [x] 甘特图拖曳移动/缩放色块
- [x] 流水帐（日常例行事）三维度触发 + 每日勾选
- [x] 专案模板汇出/汇入（日期重锚定，年度固定专案重用）
- [x] 优先级筛选同步过滤待办
- [x] 自动退场 + 档案库页（/archive：还原／永久删除）
- [x] 记帐（/ledger：收支＋月度统计＋GitHub 同步）
- [x] 备忘录（/memo：便条＋搜寻＋标签＋📌 置顶＋GitHub 同步）
- [x] 选题库（/topics：每日一文 FIFO 轮流＋领题/交卷＋GitHub 同步）
- [ ] 待办事项的日期关联
- [ ] 专案子任务管理
- [ ] 更多视觉自订选项

---

## 📄 License

MIT

---

*最后更新：20260927*
