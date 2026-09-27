> 📖 Language: [繁體中文](README.md) · **English** · [简体中文](README.zh-CN.md)

# Personal Project Management Board (Kanban)

An open-source personal project-management tool that combines a **Gantt Chart**, **Kanban Board**, **Calendar View**, and **Todo Management** to help you plan and track personal projects.

| Item | Description |
|------|------|
| 🌐 **Live Demo** | [posenchen.github.io/kanban](https://posenchen.github.io/kanban/) |
| 📅 **Started** | 2026-08-22 |
| 🔄 **Latest Version** | 2026-09-27 |
| 📦 **Stack** | React 19 + TypeScript 7 + Vite 8 + Tailwind CSS v4 |
| 🧪 **Unit Tests** | Vitest (102 tests passing: archiving, drag-to-slot, ledger stats, memo filtering, routine-trigger matching, template import/export, topic rotation, new-todo-top, **tag presets / empty-overwrite guard / 409 conflict / cross-device merge**, store flows) |
| 🐙 **Source** | [PosenChen/kanban](https://github.com/PosenChen/kanban) |
| 📦 **Data Backup Repo** | [PosenChen/kanban-data](https://github.com/PosenChen/kanban-data) (`data/projects.json` / `milestones.json` / `todos.json` / `routines.json` / `ledger.json` / `memos.json` / `topics.json`) |

---

## 🚀 Feature Overview

| Feature | Description |
|------|------|
| **Gantt Chart View** | Frozen sidebar + scrollable SVG timeline (left/right row-locked alignment), parent/child project expand/collapse, milestone diamonds ◆, today highlight, stable random color per activity row |
| **Gantt Drag Editing** | Drag bars to move dates, edge handles to resize length; ghost preview, day-snap, click/drag safely distinguished |
| **Priority Saturation Scale** | Bars are **always** colored by priority saturation 100/72/45 (always on since 20260905, the old toggle was removed), legend always visible; light mode auto-clamps brightness to keep white text readable |
| **Kanban View** | Four columns (Preparing / Waiting / In Progress / Done); project cards show priority badge, progress bar, days remaining |
| **Calendar View** | View a day's projects and activities; single stacked column on mobile, three side-by-side columns (Todos / Projects / Activities) on desktop (≥768px) |
| **Project Detail Page** | Sub-project management, progress tracking, actual-dates marking; **export menu**: JSON project template (with subtree) / Word document (.doc) |
| **Routines (流水帳)** | 📒 routine popup on the overview page: triggered by **weekday / day-of-month / tag** (OR within a dimension, OR across dimensions, all-empty = never shown), daily check-off (auto-expires the next day), CRUD + GitHub sync (`routines.json`) |
| **Project Template Import** | Export a template JSON with the full subtree (`anchor_start` records the workflow start); import auto-detects the template → new IDs, re-parented, dates **re-anchored to today**, status reset to Preparing / progress zeroed, additive (not overwriting) (one-click reuse for annual recurring projects) |
| **Activity Management** | Add/edit/delete activities, supports **multi-day ranges** (same name + adjacent dates auto-merge), tag filtering, shown as Gantt bars |
| **Todos** | Name / priority / description, CRUD, completion marking, ▲▼ reorder |
| **Auto-Archiving (Archive)** | Overdue-completed project groups / activities / todos auto-retire (default 14 days, adjustable via `kanban_archive_days` in Settings); overview filters all of them; `/archive` groups by month, one-click restore (projects re-attach their ancestor chain) or confirmed permanent delete, **never auto-deletes data** |
| **Search & Filter** | Full-text search + multi-condition filter by status/priority/tag; priority filter **also filters the todo list**, empty results show a hint |
| **Tag Quick-Pick** | Project/activity forms drop the pre-filled tags in favor of one-tap quick-pick buttons ("Work / Purchase / Course…") |
| **Project Copy** | One-click deep-copy of a project and all descendants, name auto-suffixed with `Q` |
| **Reordering** | Parent projects, sub-projects, and todos all support ▲▼ reorder; frozen sidebar and todo list intelligently hide arrows at the ends |
| **Drag Reordering** | Drag sidebar projects (same group only) and todos directly to a slot, blue insertion-line indicator, ghost semi-transparent; ▲▼ kept as a touch/accessibility fallback |
| **Ledger (收支)** | `/ledger` record income/expense on the fly (date / amount / category / note), monthly income·expense·net cards + expense-category share bars, quick category pick, CRUD + confirm-delete + GitHub sync (`ledger.json`) |
| **Memo** | `/memo` quick notes (title / body / tags), keyword search + tag filter + 📌 pin, native `<details>` collapse, CRUD + GitHub sync (`memos.json`) |
| **Topics (daily writing)** | `/topics` topic-pool FIFO rotation: a "Today's Topic" hero card auto-suggests (an unfinished `writing` sticks to the same topic tomorrow), ✍️ claim → ✅ submit, ▲▼ reorder, monthly submit stats, CRUD + GitHub sync (`topics.json`) |
| **Expand-State Persistence** | Gantt parent/child expand/collapse state stored in `localStorage`, persists across pages and reloads |
| **Dark Mode** | Tailwind v4 class-based dark theme, light/dark/system three-way toggle, floating button, pre-paint script prevents white flash |
| **Tag Presets (quick-pick)** | Settings 🏷️ lets you edit the quick-pick candidates per form: project/activity (Gantt), ledger, memo, topic — one group each; add/remove takes effect immediately, one-click reset to defaults, stored locally in `kanban_tag_presets`, not uploaded |
| **Data Sync** | LocalStorage local storage + GitHub API cloud backup; **auto-upload** (3s debounce) + **auto-download-merge** (on open / refocus, throttled 30s) + manual download/upload |
| **Sync Guard (prevent overwrite)** | Local empty + cloud non-empty → **auto-skip upload** (never wipe the cloud); sha conflict detection (another device changed it first → 409 abort and prompt to download-merge first); manual upload shows a **local/cloud per-file count comparison** in the confirm dialog; upload failures reported as-is; the `kanban-data` repo's Actions take a **daily snapshot** to `backups/YYYYMMDD/` retained 90 days |
| **Data Backup/Restore** | JSON export/import, full backup of projects, activities, and todos |

---

## 🏗️ Tech Architecture

- **Framework**: React 19.2 + TypeScript 7.0
- **Build Tool**: Vite 8.2 (`codeSplitting: false` for GitHub Pages static deploy)
- **Routing**: React Router v7.18 (HashRouter)
- **Styling**: Tailwind CSS v4.3 (`@tailwindcss/vite`) + hand-rolled SVG Gantt chart (does not depend on the frappe-gantt render component)
- **State Management**: React hooks (`useProjects`) + `kanban:data-change` CustomEvent-driven re-render
- **Data Persistence**: LocalStorage + GitHub Content API (PosenChen/kanban-data)
- **Unit Tests**: Vitest (18 test files / 102 tests: archiving, drag-to-slot reorder, routine triggers, ledger stats, memo filtering, topic rotation, new-todo-top, tag presets, sync guard / cross-device merge, template import/export, store integration flows)
- **Deploy**: GitHub Pages (GitHub Actions CI/CD: build → upload-pages-artifact → deploy-pages)

---

## 📁 Project Structure

```
kanban/
├── index.html                # entry (includes a pre-paint theme script to avoid dark-mode white flash)
├── package.json
├── vite.config.ts            # codeSplitting: false + @ src alias + relative base path (any subpath deploy)
├── tsconfig.json
├── requirements.md           # requirements spec + Roadmap
├── .github/workflows/deploy.yml  # GitHub Actions CI/CD (Node 20 + npm ci → build → Pages)
└── src/
    ├── App.tsx               # main app routes (/ /board /project/:id /daily/:date? /ledger /memo /topics /archive /settings) + global ThemeToggle
    ├── main.tsx
    ├── types/
    │   └── project.ts        # data types (Project, Milestone, Todo, Routine, LedgerEntry, Memo, Topic, ProjectTemplate) + status/priority config
    ├── data/
    │   ├── localStorageStore.ts  # Unified store: LocalStorage + GitHub API sync (mergeById / auto-push safety gate) + migration + template import + auto-archive
    │   ├── sampleData.ts         # sample data (seeded on first load only; not auto-pushed during init)
    │   ├── store.archive.test.ts # store archive-flow integration test (1 test)
    │   ├── store.reorder.test.ts # store drag-to-slot tests (6 tests)
    │   ├── store.ledger.test.ts  # store ledger CRUD tests (2 tests)
    │   ├── store.memo.test.ts    # store memo CRUD tests (2 tests)
    │   ├── store.todo.test.ts    # store new-todo-top test (3 tests)
    │   ├── store.topic.test.ts   # store topic CRUD/rotation tests (4 tests)
    │   ├── store.syncguard.test.ts # store sync guard: empty-overwrite skip / upload / 409 (4 tests)
    │   └── store.crossdevice.test.ts # store cross-device merge (dual-device mock, relative dates, 3 tests)
    ├── hooks/
    │   ├── useProjects.ts      # React hook wrapper (exposes store CRUD/reorder methods)
    │   └── useDragReorder.ts   # shared list-drag state machine (insertion line / ghost / drop)
    ├── utils/
    │   ├── dateUtils.ts        # date utility functions
    │   ├── theme.ts            # theme management (localStorage['kanban_theme'] + useTheme hook)
    │   ├── routineUtils.ts     # routine trigger matching (three-dimension OR)
    │   ├── routineUtils.test.ts    # routine unit tests (9 tests)
    │   ├── archiveUtils.ts        # archiving pure functions (single item / parent+descendants group, threshold days)
    │   ├── archiveUtils.test.ts    # archive unit tests (16 tests)
    │   ├── reorderUtils.ts      # drag-to-slot pure functions (reorderToSlot/nextIdAfter)
    │   ├── reorderUtils.test.ts    # slot unit tests (8 tests)
    │   ├── ledgerUtils.ts       # ledger month match / round2 / category stats
    │   ├── ledgerUtils.test.ts     # ledger unit tests (5 tests)
    │   ├── memoUtils.ts         # memo filter pure function (keyword/tag/pin sort)
    │   ├── memoUtils.test.ts       # memo unit tests (5 tests)
    │   ├── topicUtils.ts          # topic rotation pure functions (todayTopic/claim/submit/reorder)
    │   ├── topicUtils.test.ts       # topic unit tests (7 tests)
    │   ├── exportUtils.ts      # project template assembly/export + date re-anchor + Word HTML builder
    │   ├── exportUtils.test.ts     # template unit tests (5 tests)
    │   ├── syncGuardUtils.ts   # sync guard pure functions (empty-overwrite skip / plan / mergeById / diff detect / count summary)
    │   ├── syncGuardUtils.test.ts  # sync guard unit tests (7 tests)
    │   ├── syncMerge.test.ts   # cross-device mergeById unit tests (9 tests)
    │   ├── tagPresets.ts       # tag presets (quick-pick): get/set/reset/clean, stored in kanban_tag_presets
    │   └── tagPresets.test.ts  # tag preset unit tests (6 tests)
    ├── components/
    │   ├── FilterBar.tsx       # search/filter row
    │   ├── ProjectCard.tsx     # kanban card
    │   ├── ProjectForm.tsx     # project form
    │   └── ThemeToggle.tsx     # dark/light floating toggle
    ├── layouts/
    │   └── MainLayout.tsx      # navigation bar
    └── pages/
        ├── GanttPage.tsx       # Gantt overview page (frozen sidebar / SVG render / drag edit / drag reorder / activity & todo CRUD)
        ├── KanbanBoard.tsx     # kanban page (four columns)
        ├── DailyPage.tsx       # calendar detail page (responsive three-column)
        ├── ProjectDetailPage.tsx  # project detail page (incl. back to parent)
        ├── LedgerPage.tsx      # ledger page (/ledger: income/expense + monthly stats)
        ├── MemoPage.tsx        # memo page (/memo: notes + search + tags + 📌 pin)
        ├── TopicsPage.tsx      # topics page (/topics: today hero + rotation pool + submit stats)
        ├── ArchivePage.tsx     # archive page (/archive: grouped by month, restore / permanent delete)
        └── SettingsPage.tsx    # settings & sync (incl. archive threshold days, cloud/local mode)
```

> Build output `dist/` is not committed: CI rebuilds it each time (excluded via `.gitignore`); GitHub Pages is deployed directly by Actions, and local `npm run build` gives a preview.

---

## 🔧 Development Guide

```bash
# install dependencies
npm install

# start the dev server
npm run dev

# type-check and build (tsc + vite build)
npm run build

# unit tests (vitest)
npm run test

# preview the build
npm run preview
```

Deploy flow: push to `main` → GitHub Actions auto-builds → deploys to GitHub Pages.

---

## 🚀 Deploy Your Own Instance

Fork this repo and follow the four steps below to have your own board (using GitHub account `YOURNAME` as the example).

### 1️⃣ Fork and enable GitHub Pages
1. Click **Fork** at the top-right of the repo page to fork it into your account.
2. In the forked repo, go to **Settings → Pages** and choose **GitHub Actions** for **Build and deployment / Source**.
3. In **Settings → Actions → General / Workflow permissions**, confirm *Read and write permissions* is checked (needed by deploy-pages).

### 2️⃣ Trigger CI for auto-deploy
Push once to `main` (any commit, or **Run workflow** manually on the Actions page) to auto-complete `npm ci → tsc + vite build → deploy-pages`. The site lives at `https://YOURNAME.github.io/<repo-name>/` — this project uses HashRouter + relative base path (`base: './'`), so **any repo name / subpath works with no config change**.

### 3️⃣ (Recommended) Create your own data-backup repo
> ⚠️ The cloud-sync target is currently **hard-coded** in `src/data/localStorageStore.ts` to `PosenChen/kanban-data` (two `api.github.com/repos/...` sites). Without changing it, a local upload will 403 (no write permission), but **pure LocalStorage mode is unaffected** — you can jump straight to step 4.

1. Create a new repo `YOURNAME/kanban-data` (public or private; private needs a same-account token).
2. Pre-create seven empty data files in that repo: `data/projects.json`, `data/milestones.json`, `data/todos.json`, `data/routines.json`, `data/ledger.json`, `data/memos.json`, `data/topics.json` (each `[]`).
3. Change the two `PosenChen/kanban-data` sites in `src/data/localStorageStore.ts` to `YOURNAME/kanban-data`, then commit and push to `main`.
4. (Optional) Copy [PosenChen/kanban-data](https://github.com/PosenChen/kanban-data)'s `.github/workflows/daily-backup.yml` into your data repo to get the daily snapshot (90-day retention); skip it (or delete) and the main site is unaffected.

### 4️⃣ Enable cloud sync (or stay purely local)
1. At GitHub **Settings → Developer settings → Personal access tokens**, create a token: classic with the `repo` scope; or a fine-grained PAT scoped to the `kanban-data` repo with **Contents: Read and write**.
2. Open the site → **Settings page**, paste the token and save → manual download/upload work; switch to cloud mode and edits auto-upload after a 3s debounce.
3. **No cloud needed**: the default is pure LocalStorage mode, data saved straight in the browser; periodically use the Settings page **Export JSON** to back up and **Import JSON** to restore.

### ❓ FAQ
| Situation | Cause & fix |
|------|-----------|
| CI build fails | Actions pins Node 20; use Node 20+ locally |
| Cloud upload 403 | Token lacks write permission on `kanban-data`, or you forgot to change the hard-coded repo name in step 3️⃣ |
| Cloud upload 409 | Another device changed the cloud first — download-merge in Settings, then upload |
| Pages 404 | Source not set to GitHub Actions, or the deploy job hasn't finished |

---

## 🔄 Data Sync

- **LocalStorage**: by default uses browser local storage (keys: `kanban_projects` / `kanban_milestones` / `kanban_todos` / `kanban_routines` / `kanban_ledger` / `kanban_memos` / `kanban_topics`); all edits take effect immediately
- **GitHub API**: after entering a Personal Access Token in Settings, cloud sync can be enabled
  - Manual download: pull the latest data from `PosenChen/kanban-data` (enabled when `kanban_storage_source = "github"`)
  - Auto-upload: after a change, auto-syncs to GitHub on a 3s debounce
  - Auto-download-merge: on open / refocus / visibilitychange, auto-pulls (throttled 30s); the seven data kinds merge via `mergeById()` — same ID resolves to the newer `updated_at` (ties keep local), so another device's todo check / routine tick / project progress refresh across devices
  - Seven data files: `data/projects.json`, `data/milestones.json`, `data/todos.json`, `data/routines.json`, `data/ledger.json`, `data/memos.json`, `data/topics.json`
- **Auto-migration on load**: the old `date` field auto-converts to `start_date`/`end_date`; missing or duplicate `sort_order` auto-resequences to contiguous values
- **Auto-archiving**: on load, `autoArchive()` runs — objects completed and overdue by ≥ `kanban_archive_days` (default 14 days) get an `archived_at` mark retiring them to the archive; projects use a **group rule** (parent and all descendants completed, measured by the latest end date) — only marked, never deleted

---

## 📝 Data Types

### Project
| Field | Type | Description |
|------|------|------|
| id | string | unique identifier |
| name | string | project name |
| description | string | project description |
| parent_id | string \| null | parent project ID (supports nesting) |
| sort_order | number | sort weight (0 = top, larger = further down) |
| start_date | string | start date (YYYY-MM-DD) |
| end_date | string | end date (YYYY-MM-DD, inclusive of the last day) |
| actual_start_date? / actual_end_date? | string | actual start/finish dates |
| status | ProjectStatus | status: preparing / waiting / in_progress / completed |
| priority | ProjectPriority | priority: high / medium / low |
| tags | string[] | tag array |
| progress | number | progress 0–100 |
| archived_at? | string | archive date (YYYY-MM-DD); undefined = still in overview |
| created_at / updated_at | string | ISO-8601 timestamps |

### Milestone (Activity)
| Field | Type | Description |
|------|------|------|
| id | string | unique identifier |
| name | string | activity name |
| start_date | string | start date (YYYY-MM-DD) |
| end_date | string | end date (defaults = start_date, single-day) |
| tags | string[] | tag array |
| description? | string | activity description |
| archived_at? | string | archive date (YYYY-MM-DD); undefined = still in overview |
| created_at / updated_at | string | ISO-8601 timestamps |

### Todo
| Field | Type | Description |
|------|------|------|
| id | string | unique identifier |
| name | string | todo name |
| priority | ProjectPriority | priority: high / medium / low |
| sort_order | number | sort weight (0 = top) |
| description? | string | todo description |
| completed | boolean | completion state |
| archived_at? | string | archive date (YYYY-MM-DD); undefined = still in overview |
| created_at / updated_at | string | ISO-8601 timestamps |

### Routine (流水帳)
| Field | Type | Description |
|------|------|------|
| id | string | unique identifier |
| name | string | item name |
| weekdays | number[] | trigger weekdays (0=Sun … 6=Sat), OR within the dimension |
| monthDays | number[] | trigger day-of-month (1..31), OR within the dimension |
| tags | string[] | triggers if today's activity carries any of these tags |
| sort_order | number | sort weight (0 = top) |
| completed_date? | string | last check-off date (YYYY-MM-DD), auto-expires the next day |
| created_at / updated_at | string | ISO-8601 timestamps |

> Trigger semantics: OR within a dimension, OR across dimensions, all-empty condition = never appears.

### LedgerEntry
| Field | Type | Description |
|------|------|------|
| id | string | unique identifier |
| date | string | date (YYYY-MM-DD) |
| kind | LedgerKind | `income` / `expense` |
| amount | number | amount > 0, in TWD |
| category | string | category (food / transport / salary…, quick-pick buttons) |
| note? | string | note |
| created_at / updated_at | string | ISO-8601 timestamps |

### Memo
| Field | Type | Description |
|------|------|------|
| id | string | unique identifier |
| title | string | short title (falls back to a truncated body if blank) |
| content | string | body (may be empty); title/content at least one non-empty |
| tags | string[] | tag array (follow-up / idea / call…, quick-pick) |
| date | string | record date (YYYY-MM-DD, defaults to today) |
| pinned? | boolean | 📌 pinned |
| created_at / updated_at | string | ISO-8601 timestamps |

### Topic
| Field | Type | Description |
|------|------|------|
| id | string | unique identifier |
| title | string | topic title (required) |
| outline? | string | outline / notes (the body is linked, not stored) |
| tags | string[] | tags (essay / tech / note…, quick-pick) |
| status | TopicStatus | `pool` reserve / `writing` in progress / `done` submitted |
| sort_order | number | pool rotation order (0 = head, written first) |
| added_date | string | added date (YYYY-MM-DD) |
| done_date? | string | submission date; undefined = not submitted |
| created_at / updated_at | string | ISO-8601 timestamps |

> Rotation semantics: today's topic = a `writing` item sticks and carries forward; with no `writing`, take the `pool` item with the smallest sort_order; an empty pool prompts you to reserve.

### ProjectTemplate
| Field | Type | Description |
|------|------|------|
| kind | `'kanban-project-template'` | template marker (auto-detected on import) |
| version | number | template format version (currently 1) |
| exported_at | string | export timestamp |
| anchor_start | string | earliest start date of the subtree (import re-anchors dates from this) |
| projects | Project[] | depth-first-ordered subtree (parents before children) |

---

## 📜 Changelog

### 🗓️ 2026-08-22 — Project kickoff
- Initialized the TypeScript, Vite, Tailwind CSS project
- GitHub Actions CI/CD auto-deploy (`.nojekyll` + relative base path)
- Switched to HashRouter for GitHub Pages static deploy

### 🗓️ 2026-08-22 ~ 08-24 — Core feature build-out
- Gantt scrollable timeline, day/month labels, root-project rows
- Kanban view (four columns) + today highlight
- GitHub API data persistence (dropped the Firebase plan)
- Settings-page toolbar integration

### 🗓️ 2026-08-25 — Feature burst
- Milestones became their own object type → renamed "Activity", unified row display + CRUD modal
- Activity tag/description fields + tag filter
- The todo object debuted: CRUD + GitHub sync + backup
- Deep-copy of projects and activities (`Q` suffix)
- First version of todo/project reorder buttons

### 🗓️ 2026-08-26 — Reordering and sync fixes
- Reordering complete: parent/sub/todos ▲▼ reorder (including 6 bug fixes; finally changed to the "reorder + reassign contiguous sort_order" algorithm)
- `sort_order` field added to the Project and Todo types
- `loadFromGitHub()` no longer force-overwrites state; migration also fixes missing and duplicate `sort_order`

### 🗓️ 2026-08-27 — Layout and theme
- Activities upgraded to **date ranges** (`start_date`/`end_date`): multi-day bars + auto-merge of same-name adjacent items on load
- Gantt today highlight (red line + red date number)
- **Dark mode**: Tailwind v4 class-based dark + floating toggle + `utils/theme.ts` + pre-paint anti-flash
- DailyPage responsive three-column layout (mobile stacked / desktop side-by-side) + back-to-overview button

### 🗓️ 2026-08-28 — Gantt rendering finalized
- Frozen sidebar and SVG row-locked (lockstep): no duplicate push when a parent expands, fixing left/right misalignment and duplicate React keys
- Expand/collapse state persisted to `localStorage['kanban_expanded']`
- Bar width includes the last day (8/24~8/31 occupies 8 columns); waiting status changed to orange `#F97316` to avoid clashing with in-progress blue
- Narrow bars (≤36px) show the first 2 characters of the name; single-day bars fixed at 1 column
- **Milestone diamond (option A)**: when a parent is collapsed, a single-day child project shows as an 8px diamond ◆ on the parent row, click to expand

### 🗓️ 2026-08-29 — Priority color system
- Gantt bar **saturation scale**: high/medium/low → 100/72/45, toggle on by default (`kanban_color_by_priority`), legend and bars sync in real time
- Light mode auto-clamps the desaturated bar brightness to keep the white name text readable
- Refactor: deduped the saturation-toggle storage key, fixed the JSX structure

### 🗓️ 2026-08-30 — Gantt interactive editing
- **Drag bars/activities to move dates directly**, edge handles **resize length**: ghost preview, day-snap, click/drag safely distinguished (click-safe)
- "+ Add" now opens the project form modal directly (no longer creates a placeholder project first); adding a sub-project auto-expands its parent

### 🗓️ 2026-08-31 — Routines, project templates, and unit tests
- **Routines (Routine)**: `Routine` type + three-dimension OR trigger matching (weekday / day-of-month / tag), overview 📒 popup (today's list + check-off + edit), store CRUD + `routines.json` GitHub sync
- **Project template import/export**: depth-first subtree collection, `anchor_start` anchor, import assigns new IDs + re-parents + re-anchors dates to today + resets status; import auto-detects the template JSON (additive, not overwriting)
- **Project detail page export menu**: JSON project template (with sub-projects) / Word document (.doc)
- **Filter enhancements**: priority filter also filters the todo list, empty results show a hint, reorder arrows now based on the visible list
- **Tag quick-pick**: forms drop the "Activity" pre-fill in favor of Work/Purchase/Course… quick buttons
- **Engineering**: introduced Vitest unit tests (`routineUtils` 9 + `exportUtils` 5 = 14 tests passing)

### 🗓️ 2026-09-01 — Routine/form polish, archiving ships
- **Edit preserves order**: editing a project no longer jumps it to the Gantt top (keeps `sort_order`)
- Toolbar semantic icons: 📁 project / 🚩 activity replace the generic +; the routine 📒 button shows completion state (un-checked → red circular number badge top-right (static), all done → emerald check)
- Removed the redundant ▾ from the filter dropdown (native selects already have an arrow)
- **Auto-archive core**: `archived_at` mark added to the Project/Todo/Milestone types; `utils/archiveUtils.ts` pure-function decision (single item + parent-with-descendants group rule, threshold `kanban_archive_days` default 14 days, TDD 16 tests); the store's `autoArchive()` on load retires them together, all overview getters filter archived items (raw kept via `getAllRaw`/`getArchived`)

### 🗓️ 2026-09-02 — Archive page
- **`/archive` archive page**: archived projects/activities/todos listed grouped by month
- One-click **restore**: projects re-attach their ancestor chain (`unarchiveAncestry`), avoiding an orphaned sub-project on the Gantt after restore
- **Permanent delete** requires a confirm dialog; archiving only marks, never auto-deletes data
- Gantt toolbar 🗂️ archive entry; Settings archive threshold (days) adjustable
- Engineering: `store.archive.test.ts` archive-flow integration test — **31 tests passing** overall

### 🗓️ 2026-09-02 — Drag reordering
- **Project/todo drag-to-slot**: drag frozen-sidebar and todo-list items to reorder; passing a legal target shows a blue 2px insertion line (top half = insert before, bottom half = insert after); the dragged source row is semi-transparent
- Implementation: `utils/reorderUtils.ts` pure functions (`reorderToSlot`/`nextIdAfter`) + `hooks/useDragReorder.ts` shared state machine; the store added `moveProjectToSlot`/`moveTodoToSlot` (same-group siblings reorder + contiguous sort_order + reuses GitHub sync)
- Boundary rule: **cross-group is rejected** (a sub-project cannot be dragged to a root / change parent, no indicator line); a filtered-state drop maps onto the visible list; HTML5 DnD doesn't support touch → ▲▼ buttons kept

### 🗓️ 2026-09-02 — Ledger (income/expense)
- **`/ledger` ledger page**: record an income/expense on the fly (date / amount / category / note), quick category buttons (food / transport / salary…), click a row to edit, ✕ confirm-delete
- **Monthly stats**: income / expense / net cards + expense-category share bars; month ‹/›/current toggle
- Engineering: `LedgerEntry` type; `utils/ledgerUtils.ts` pure functions (month match / round2 / category stats, TDD 5); store `addLedgerEntry/getLedger/updateLedgerEntry/removeLedgerEntry` + `kanban_ledger` + `data/ledger.json` GitHub sync (merge on load, 3s debounced upload); Gantt toolbar 💰 entry — **52 tests passing** overall

### 🗓️ 2026-09-03 — Memo
- **`/memo` memo page**: quick notes (title / body / date / tags), 📌 pin, keyword search (title/content/tags), tag-pill filter, native `<details>` body collapse, click to edit, ✕ confirm-delete
- Engineering: `Memo` type; `utils/memoUtils.ts` pure function `filterMemos` (TDD 5); store `addMemo/getMemos/updateMemo/removeMemo` + `kanban_memos` + `data/memos.json` GitHub sync (merge on load, 3s debounced upload); Gantt toolbar 📝 entry — **59 tests passing** overall

### 🗓️ 2026-09-05 — Sync guard (prevent overwrite)
- **Empty-overwrite guard**: `writeGitHub()` checks per file before upload — local empty array + cloud non-empty (or read failed) → **auto-skip**, a fresh machine accidentally hitting upload won't wipe the cloud (`syncGuardUtils.ts` pure function, TDD 7); manual upload only proceeds if you opt into "force upload"
- **sha conflict detection**: download records each file's sha; upload verifies the old sha to confirm nothing changed in between; another device changed it first → HTTP 409 throws `SyncConflictError`, the UI shows "download-merge first"; the backend doesn't fail silently (checks res.ok after PUT, reports errors as-is)
- **Confirm-dialog comparison**: before a manual upload, shows the **local/cloud per-file counts** (`3/10` format); locally-empty files are auto-marked ⚠️ as pre-skipped
- **Status feedback**: a `kanban:sync-status` CustomEvent surfaces background auto-sync conflicts/errors/skips on the Settings page
- **Cloud daily snapshot**: `kanban-data` added `daily-backup.yml` — daily at 02:00 (UTC+8) all `data/*.json` → `backups/YYYYMMDD/`, retained 90 days, manually triggerable; two layers of recovery after an accidental overwrite (snapshot + git history)
- Engineering: `store.syncguard.test.ts` mocks fetch to verify skip/upload/409 (4 tests) — **70 tests passing** overall

### 🗓️ 2026-09-05 — Topics (daily writing)
- **`/topics` topic pool**: FIFO rotation — the "Today's Topic" hero card auto-suggests (an unfinished `writing` sticks to the same topic tomorrow, zero memory load); ✍️ claim to start / ✅ submit / ↩ release back to the pool, ▲▼ reorder, monthly submit stats badge, historical submissions list
- Engineering: `Topic` type (pool/writing/done); `utils/topicUtils.ts` rotation pure functions (todayTopic/claimTopic/completeTopic/swapPoolOrder/reorderPoolAfterRemove, TDD 7); store `addTopic/getTopics/todayTopic/claimTopic/completeTopic/releaseTopic/moveTopic/removeTopic` + `kanban_topics` + `data/topics.json` seventh-file sync (incl. empty-overwrite guard / 409 conflict / seven-file confirm comparison); Gantt toolbar 📚 entry — **81 tests passing** overall
- Fix: `addTopic` id changed to `Date.now()+random` to prevent same-millisecond collisions (a millisecond collision would give two topics the same id, and deleting one loses both)

### 🗓️ 2026-09-05 — Priority coloring always on
- Removed the "priority coloring" checkbox and the "priority (saturation high→low):" intro text — bars/diamonds are **always** colored by priority (saturation 100/72/45), the saturation legend is always visible
- Also removed the dead code: `isColorByPriority()` / `STORAGE_KEY_COLOR_BY_PRIORITY` (a leftover localStorage value is harmless)

### 🗓️ 2026-09-10 — Docs
- README added a "**Deploy Your Own Instance**" section: Fork → Pages setup → build your own `kanban-data` repo (incl. the hard-coded rewrite sites) → token and pure-local mode, with an FAQ troubleshooting table

### 🗓️ 2026-09-10 — Cross-device state sync fix (major)
- **Root cause**: `loadFromGitHub()` skipped "already-existing same IDs" wholesale → another device's todo checks, routine ticks, and project progress **never came in**
- **Fix**: added the `mergeById()` pure function (same ID resolves to the newer `updated_at`, ties keep local); all seven kinds (projects/activities/todos/routines/ledger/memos/topics) merge-refresh on download; a newer local value isn't regressed by an older cloud value
- **Wired up auto-upload**: `scheduleGitHubSync()` was dead code nobody called — now hooked by all seven emits (cloud mode + 3s debounce; pure-local mode and cross-tab landing don't auto-push, preventing duplicate quota burn and self-colliding 409)
- **Auto-download**: on open / window focus / visibilitychange, auto-pull-merge (throttled 30s; a 409 conflict force-pulls immediately); local edits during a pull are recorded and pushed to make up, no missed checks
- Settings sync status shows the current mode (cloud/local); new regression tests: `syncMerge.test.ts` 9 + `store.crossdevice.test.ts` 3 (dual-device scenario mocks) — **93 tests passing** overall

### 🗓️ 2026-09-27 — Auto-push safety gate (seal off sample pollution of the cloud)
- **Root cause**: `scheduleGitHubSync()` was triggered during module evaluation by migration / `autoArchive()`→`emit` — a **brand-new device opening the site for the first time, having made no edits**, pushed the default sample data to the cloud, polluting the shared repo
- **Fix (multiple gates)**: `scheduleGitHubSync()` added five non-force gates — ① `initializing` (no push during the open/landing seed/migration/autoArchive phase; opened once landing completes) ② `_isBrowser` (no network from node/Vitest test env) ③ `autoPulling` (no push mid-pull; `lastPullHadLocalChanges` diff detection takes over the push afterward) ④ `crossTabReload` (another tab in the same browser only refreshes the UI, no duplicate push) ⑤ pure-local mode doesn't auto-push (manual upload button unaffected); force skips all
- **409 self-heal**: a push hitting a conflict (another device changed it first) → auto `autoPullIfCloud(true)` download-merge, local stays fresh, the next edit naturally pushes the merged data, no more stuck conflicts
- Engineering: dual-device regression tests switched to **relative-date** fixtures (the old fixed `2026-09-10` timestamps crossed the 14-day archive threshold over time, got marked by `autoArchive()`, and were filtered out of `getTodos()` — a flaky time bomb) — **93 tests passing** overall
- Engineering: `git rm --cached node_modules` (3,589 files) + untracked `.DS_Store` — CI already uses `npm ci`; the tracked `node_modules` was pure bloat and contradicted the deploy guide, avoiding every Fork inheriting thousands of useless files

### 🗓️ 2026-09-27 — New todos default to top
- `addTodo` changed to take the smallest `sort_order` for the new item, shifting the rest down and renumbering (contiguous 0..N-1) — a new/copied todo shows at the **top** of the list (it used to append to the bottom)
- Also fixed `addTodo` id collisions: `Date.now()+random` (same pattern as `copyProject`), preventing rapid add/copy in the same millisecond from producing the same id and folding two todos into one under cross-device merge
- Engineering: added `store.todo.test.ts` (3 tests) — **96 tests passing** overall

### 🗓️ 2026-09-27 — Settings page: tag-preset editor + Gantt entry renamed
- **Gantt toolbar "Sync" → "Settings"**: the button already navigated to `/settings` (which includes manual sync); renamed to "Settings" with a gear icon for clearer semantics (avoids "Download from GitHub" and "Sync" being side-by-side being misread as a manual-sync action)
- **Tag quick-pick made configurable**: added `utils/tagPresets.ts` — `TagPresets` (`project` shared by project/activity/routine, `ledger`, `memo`, `topic`) stored in `localStorage['kanban_tag_presets']`, defaults reuse the original `QUICK_TAGS`/`LEDGER_QUICK_CATEGORIES`/`MEMO_QUICK_TAGS`/`TOPIC_QUICK_TAGS` constants (behavior unchanged); `getTagPresets()/setTagPresets()/resetTagPreset()/cleanTags()` (trim + dedup, TDD 6)
- **Five forms now read from the preset**: `ProjectForm`, GanttPage (activity + routine), `LedgerPage`, `MemoPage`, `TopicsPage` quick tags now read the matching `getTagPresets()` category (re-read on each form open, changes take effect immediately)
- **Settings page added "🏷️ Tag Presets"**: four editable tag groups (pill + ✕ remove, input + Enter add, ↺ reset to defaults), plus a "⚙️ Configurable Options" reference (tag presets / auto-archive days / dark-light theme / cloud-sync mode; notes that Gantt bars are auto-colored by priority)
- Engineering: `tagPresets.test.ts` (6 tests) — **102 tests passing** overall

---

## 🗺️ Roadmap

- [x] Reordering (reorder-button UI)
- [x] GitHub sync state migration fix
- [x] Dark/light theme toggle
- [x] Activity date ranges + auto-merge
- [x] Gantt drag move/resize bars
- [x] Routines (daily recurring) three-dimension triggers + daily check-off
- [x] Project template import/export (date re-anchor, annual recurring project reuse)
- [x] Priority filter also filters todos
- [x] Auto-archiving + archive page (/archive: restore / permanent delete)
- [x] Ledger (/ledger: income/expense + monthly stats + GitHub sync)
- [x] Memo (/memo: notes + search + tags + 📌 pin + GitHub sync)
- [x] Topics (/topics: daily writing FIFO rotation + claim/submit + GitHub sync)
- [ ] Todo date association
- [ ] Project subtask management
- [ ] More visual customization options

---

## 📄 License

MIT

---

*Last updated: 2026-09-27*
