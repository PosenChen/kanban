// ── 退場（archive）判定純函式 ──
// 語意（使用者確認 20260901）：
// - 門檻預設 14 天（kanban_archive_days 可調）
// - 父專案群組：父與全部子孫都已完成，且「最後結束日」過期 ≥ 門檻，才整群退場
// - 待辦/活動：個別判定，完成日過期 ≥ 門檻即退場
// - 已退場者不重複處理（idempotent）

export interface ArchivableItem {
  id: string
  doneDate: string | null // 完成/結束日 YYYY-MM-DD；null = 未完成
  archived: boolean
}

export interface GroupNode {
  id: string
  doneDate: string | null
  children: GroupNode[]
  archived?: boolean // 群組本身或任何已退場子孫由呼叫端預先剔除；此欄供根節點快速略過
}

export function daysSince(dateStr: string, today: Date = new Date()): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return Math.floor((today.getTime() - new Date(y, m - 1, d).getTime()) / 86400000)
}

/** 個別物件（待辦/活動）：已完成且 doneDate 過期 ≥ days */
export function isItemArchivable(it: ArchivableItem, today: Date, days: number): boolean {
  if (it.archived || it.doneDate === null) return false
  return daysSince(it.doneDate, today) >= days
}

/** 群組（父＋全部子孫）：全部完成且「最晚結束日」過期 ≥ days */
export function isGroupArchivable(node: GroupNode, today: Date, days: number): boolean {
  if (node.doneDate === null) return false
  for (const c of node.children) {
    if (!isGroupArchivableDone(c)) return false
  }
  const lastEnd = groupLastEnd(node)
  return daysSince(lastEnd, today) >= days
}

function isGroupArchivableDone(node: GroupNode): boolean {
  if (node.doneDate === null) return false
  return node.children.every(isGroupArchivableDone)
}

function groupLastEnd(node: GroupNode): string {
  let last = node.doneDate as string
  for (const c of node.children) {
    const ce = groupLastEnd(c)
    if (ce > last) last = ce
  }
  return last
}

/** 由根節點清單挑出所有可退場群組的完整 id 列表（含子孫） */
export function selectArchivableGroups(roots: GroupNode[], today: Date, days: number): string[] {
  const out: string[] = []
  const collect = (node: GroupNode) => {
    out.push(node.id)
    node.children.forEach(collect)
  }
  for (const r of roots) {
    if (r.archived) continue
    if (isGroupArchivable(r, today, days)) collect(r)
  }
  return out
}
