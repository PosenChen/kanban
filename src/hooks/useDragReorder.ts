import { useCallback, useState } from 'react'
import type { DragEvent } from 'react'

export interface DropTarget { id: string; before: boolean }
export interface DropInfo { draggedId: string; beforeId: string | null }

/**
 * HTML5 縱向拖曳排序狀態機（純 UI；落庫由呼叫端 onDrop 決定）。
 * 用法：
 *   const d = useDragReorder(({ draggedId, beforeId }) => store.moveXToSlot(...))
 *   <div draggable
 *     onDragStart={d.start(id)}
 *     onDragOver={e => d.over(e, id)}
 *     onDragLeave={() => d.leave(id)}
 *     onDrop={e => d.drop(e, id, (overId, before, draggedId) => /* 最終 beforeId *\/)}
 *     onDragEnd={d.clear}>
 * 視覺：d.draggingId === id → opacity-40；
 *      d.dropTarget?.id === id → 依 before 加 border-t-2 / border-b-2 指示線。
 */
export function useDragReorder(onDrop: (info: DropInfo) => void) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)

  const start = useCallback((id: string) => (e: DragEvent) => {
    setDraggingId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id) // Firefox 需 setData 才啟動拖曳
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

  /** beforeId 由呼叫端 resolveBeforeId 算定（null = 置末） */
  const drop = useCallback((e: DragEvent, overId: string,
    resolveBeforeId: (overId: string, before: boolean, draggedId: string) => string | null) => {
    e.preventDefault()
    e.stopPropagation()
    if (draggingId && draggingId !== overId) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const before = e.clientY < rect.top + rect.height / 2
      onDrop({ draggedId: draggingId, beforeId: resolveBeforeId(overId, before, draggingId) })
    }
    setDraggingId(null)
    setDropTarget(null)
  }, [draggingId, onDrop])

  const clear = useCallback(() => { setDraggingId(null); setDropTarget(null) }, [])

  return { draggingId, dropTarget, start, over, leave, drop, clear }
}
