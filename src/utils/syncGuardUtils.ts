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
