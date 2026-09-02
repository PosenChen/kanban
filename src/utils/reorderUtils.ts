// ── 拖曳排序純函式 ──

/** 將 draggedId 項目插入到 beforeId 之前；beforeId=null 或找不到 → 置末。
 *  回傳新陣列；draggedId 不在清單、或 beforeId===draggedId（原地）時回傳原
 *  reference（呼叫端可據 `結果 === 輸入` 判 no-op）。 */
export function reorderToSlot<T extends { id: string }>(
  list: T[], draggedId: string, beforeId: string | null,
): T[] {
  const from = list.findIndex(x => x.id === draggedId)
  if (from === -1) return list
  if (beforeId === draggedId) return list
  const next = [...list]
  const [moved] = next.splice(from, 1)
  if (beforeId === null) {
    next.push(moved)
  } else {
    const to = next.findIndex(x => x.id === beforeId)
    if (to === -1) next.push(moved)
    else next.splice(to, 0, moved)
  }
  return next
}

/** list 中 afterId 的下一筆 id；最後一筆或找不到 → null。 */
export function nextIdAfter<T extends { id: string }>(list: T[], afterId: string): string | null {
  const i = list.findIndex(x => x.id === afterId)
  return i >= 0 && i + 1 < list.length ? list[i + 1].id : null
}
