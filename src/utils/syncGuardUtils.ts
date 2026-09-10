// ── Sync guard（同步防護）純函式 ──
// 防止「空資料覆蓋雲端」與「多裝置互相覆蓋」的決策邏輯（可單測、無 I/O）。

export interface FilePlan {
  path: string
  localCount: number
  remoteCount: number  // -1 = 雲端讀取失敗（未知，保守視為不可覆蓋）
}

export interface SyncPlan {
  upload: string[]
  skip: string[]
  conflict: string[]
}

/**
 * 空覆蓋守則：本地空陣列 + 雲端非空 → 跳過上傳。
 * 雲端狀態未知（-1）時保守跳過（宁可漏同步，不可覆蓋）。
 */
export function shouldSkipEmptyUpload(localCount: number, remoteCount: number): boolean {
  if (localCount > 0) return false
  return remoteCount !== 0 // 雲端非空或未知 → skip
}

/**
 * 制定上傳計畫：逐檔判定上傳/跳過。
 * conflict 於此層不判（HTTP 409 於 store 層處理），保留欄位供 UI。
 */
export function buildSyncPlan(files: FilePlan[]): SyncPlan {
  const plan: SyncPlan = { upload: [], skip: [], conflict: [] }
  for (const f of files) {
    if (shouldSkipEmptyUpload(f.localCount, f.remoteCount)) {
      plan.skip.push(f.path)
    } else {
      plan.upload.push(f.path)
    }
  }
  return plan
}

/**
 * 跨裝置狀態合併純函式：同 ID 以 `updated_at` 新者勝出（last-write-wins）。
 * 修補「下載只補新 ID、舊項永不更新」——待辦 completed、流水帳 completed_date、
 * 專案 status/progress 等狀態欄位必須隨載入刷新，否则多裝置勾選狀態各說各話。
 * - 僅雲端有 → 加入
 * - 兩邊都有 → remote.updated_at 較新則以 remote 覆蓋本地
 * - 缺 updated_at 者視為最舊（不覆蓋有時間戳的對方）
 * @param tieBreakLocalWins 時間戳相同時保留本地（預設），避免同刻抖動反覆盪換
 */
export function mergeById<T extends { id: string; updated_at?: string }>(
  local: T[],
  remote: T[],
  tieBreakLocalWins = true,
): { merged: T[]; added: number; refreshed: number } {
  const byId = new Map(local.map(x => [x.id, x]))
  let added = 0
  let refreshed = 0
  const merged = [...local]
  for (const r of remote) {
    const cur = byId.get(r.id)
    if (!cur) {
      merged.push(r)
      byId.set(r.id, r)
      added++
      continue
    }
    const la = cur.updated_at ?? ''
    const ra = r.updated_at ?? ''
    const remoteWins = ra > la || (!ra && !la && !tieBreakLocalWins)
    if (remoteWins) {
      const idx = merged.findIndex(x => x.id === r.id)
      if (idx !== -1) merged[idx] = r
      byId.set(r.id, r)
      refreshed++
    }
  }
  return { merged, added, refreshed }
}

/** 比對摘要字串：本地 vs 雲端（供確認對話框） */
export function formatCountSummary(
  labels: string[],
  localCounts: number[],
  remoteCounts: number[],
): string {
  return labels
    .map((l, i) => `${l} ${localCounts[i]}/${remoteCounts[i] < 0 ? '?' : remoteCounts[i]}`)
    .join('　')
}
