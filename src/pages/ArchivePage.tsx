import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { projectStore, getArchiveDays } from '@/data/localStorageStore'
import type { Milestone, Project, Todo } from '@/types/project'

type Kind = 'project' | 'milestone' | 'todo'

interface RowData {
  id: string
  name: string
  period: string
  archivedAt: string
}

const KIND_META: { kind: Kind; label: string; icon: string }[] = [
  { kind: 'project', label: '專案', icon: '📁' },
  { kind: 'milestone', label: '活動', icon: '🚩' },
  { kind: 'todo', label: '待辦', icon: '✅' },
]

function toRows(kind: Kind, items: (Project | Milestone | Todo)[]): RowData[] {
  return items.map(it => ({
    id: it.id,
    name: it.name,
    period: 'start_date' in it && 'end_date' in it
      ? (it.start_date === it.end_date ? it.start_date : `${it.start_date} ~ ${it.end_date}`)
      : 'updated_at' in it ? it.updated_at.slice(0, 10) : '—',
    archivedAt: it.archived_at ?? '—',
  }))
}

function groupByMonth(rows: RowData[]): [string, RowData[]][] {
  const map = new Map<string, RowData[]>()
  for (const r of rows) {
    const k = r.archivedAt.slice(0, 7) || '未知'
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(r)
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
}

function ArchivePage() {
  const [, setTick] = useState(0)
  const refetch = () => setTick(t => t + 1)

  useEffect(() => {
    const h = () => refetch()
    window.addEventListener('kanban:data-change', h)
    window.addEventListener('kanban:milestone-change', h)
    window.addEventListener('kanban:todo-change', h)
    return () => {
      window.removeEventListener('kanban:data-change', h)
      window.removeEventListener('kanban:milestone-change', h)
      window.removeEventListener('kanban:todo-change', h)
    }
  }, [])

  const data = useMemo(() => projectStore.getArchived(), [])
  const days = getArchiveDays()

  const handleUnarchive = (kind: Kind, id: string) => {
    if (kind === 'project') {
      // 同時還原祖先鏈，避免還原子專案後因父仍退場而在甘特圖失去掛靠
      projectStore.unarchiveAncestry(id)
    } else {
      projectStore.unarchive(kind, id)
    }
  }

  const handlePurge = (kind: Kind, id: string, name: string) => {
    if (!confirm(`確定永久刪除「${name}」？此舉不可恢復。`)) return
    if (kind === 'project') projectStore.remove(id)
    else if (kind === 'milestone') projectStore.removeMilestone(id)
    else projectStore.removeTodo(id)
  }

  const empty = data.projects.length === 0 && data.milestones.length === 0 && data.todos.length === 0

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            🗂️ 檔案庫
            <span className="text-xs font-normal text-gray-400 dark:text-gray-500">
              完成後逾 {days} 天的項目自動退場於此，隨時可回顧或還原
            </span>
          </h1>
          <Link to="/" className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            返回總覽
          </Link>
        </div>

        {empty && (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <div className="text-4xl mb-3">🗂️</div>
            <p>檔案庫還是空的——完成的項目退場後會出現在這裡</p>
          </div>
        )}

        {KIND_META.map(({ kind, label, icon }) => {
          const rows = toRows(kind, kind === 'project' ? data.projects : kind === 'milestone' ? data.milestones : data.todos)
          if (rows.length === 0) return null
          const months = groupByMonth(rows)
          return (
            <section key={kind}>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                {icon} {label}
                <span className="bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-full px-2 py-0.5 text-xs font-normal">{rows.length}</span>
              </h3>
              <div className="space-y-4">
                {months.map(([month, mrows]) => (
                  <div key={month}>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mb-1 font-mono">{month}</div>
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
                      {mrows.map(r => (
                        <div key={r.id} className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750">
                          <span className="flex-1 text-sm text-gray-600 dark:text-gray-300 truncate">{r.name}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 font-mono whitespace-nowrap">{r.period}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">退於 {r.archivedAt}</span>
                          <button
                            onClick={() => handleUnarchive(kind, r.id)}
                            className="text-xs px-2 py-1 rounded-md border border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors whitespace-nowrap"
                          >
                            ↩ 還原
                          </button>
                          <button
                            onClick={() => handlePurge(kind, r.id, r.name)}
                            className="text-xs px-2 py-1 rounded-md border border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-red-300 hover:text-red-500 transition-colors whitespace-nowrap"
                            title="永久刪除"
                          >
                            🗑
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

export default ArchivePage
