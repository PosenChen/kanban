import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { projectStore } from '@/data/localStorageStore'
import { MEMO_QUICK_TAGS, type Memo } from '@/types/project'
import { dateToStr } from '@/utils/dateUtils'
import { filterMemos } from '@/utils/memoUtils'

const SNIPPET = 80

function MemoPage() {
  const [memos, setMemos] = useState<Memo[]>(() => projectStore.getMemos())
  const [keyword, setKeyword] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Memo | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [date, setDate] = useState(() => dateToStr(new Date()))
  const [formTags, setFormTags] = useState<string[]>([])

  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail as Memo[] | undefined
      if (d) setMemos([...d])
    }
    window.addEventListener('kanban:memo-change', h)
    return () => window.removeEventListener('kanban:memo-change', h)
  }, [])

  const allTags = useMemo(() => [...new Set(memos.flatMap(x => x.tags))].sort(), [memos])
  const visible = useMemo(() => filterMemos(memos, keyword, tags), [memos, keyword, tags])

  const openAdd = () => {
    setEditing(null); setTitle(''); setContent('')
    setDate(dateToStr(new Date())); setFormTags([]); setShowForm(true)
  }
  const openEdit = (it: Memo) => {
    setEditing(it); setTitle(it.title); setContent(it.content)
    setDate(it.date); setFormTags([...it.tags]); setShowForm(true)
  }
  const save = () => {
    if (!title.trim() && !content.trim()) { alert('標題與內文至少填一項'); return }
    const payload = {
      title: title.trim() || content.trim().slice(0, 20),
      content: content.trim(), tags: formTags, date,
    }
    if (editing) projectStore.updateMemo(editing.id, payload)
    else projectStore.addMemo(payload)
    setShowForm(false)
  }
  const togglePin = (e: React.MouseEvent, it: Memo) => {
    e.stopPropagation()
    projectStore.updateMemo(it.id, { pinned: !it.pinned })
  }
  const remove = (e: React.MouseEvent, it: Memo) => {
    e.stopPropagation()
    if (!confirm(`確定刪除備忘「${it.title}」？`)) return
    projectStore.removeMemo(it.id)
  }
  const toggleTagFilter = (t: string) =>
    setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  const toggleFormTag = (t: string) =>
    setFormTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Link to="/" className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-500">← 返回</Link>
        <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100 ml-auto">📝 備忘錄</h1>
        <input
          value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="搜尋標題／內文／標籤"
          className="px-2.5 py-1.5 w-48 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100"
        />
        <button onClick={openAdd} className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium">＋ 記一則</button>
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {allTags.map(t => (
            <button key={t} onClick={() => toggleTagFilter(t)}
              className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${tags.includes(t) ? 'bg-teal-500 text-white border-teal-500' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-teal-400'}`}>
              #{t}
            </button>
          ))}
          {tags.length > 0 && (
            <button onClick={() => setTags([])} className="px-2 py-0.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">清除篩選</button>
          )}
        </div>
      )}

      <div className="space-y-2">
        {visible.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">
            {memos.length === 0 ? '還沒有備忘，點右上「＋ 記一則」' : '符合條件的備忘為零'}
          </p>
        ) : (
          visible.map(it => (
            <div key={it.id}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer"
              onClick={() => openEdit(it)}>
              <div className="flex items-center gap-2">
                {it.pinned && <span title="已置頂">📌</span>}
                <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{it.title}</span>
                <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{it.date}</span>
                <button onClick={(e) => togglePin(e, it)} className="text-gray-300 hover:text-amber-500 text-sm flex-shrink-0" title={it.pinned ? '取消置頂' : '置頂'}>📌</button>
                <button onClick={(e) => remove(e, it)} className="text-gray-300 hover:text-red-500 text-sm flex-shrink-0" title="刪除">✕</button>
              </div>
              {it.content && (
                it.content.length > SNIPPET ? (
                  <details className="mt-1">
                    <summary className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer">{it.content.slice(0, SNIPPET)}…</summary>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-wrap">{it.content}</p>
                  </details>
                ) : (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-wrap">{it.content}</p>
                )
              )}
              {it.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {it.tags.map(t => (
                    <span key={t} className="px-1.5 py-0.5 text-[10px] rounded-full bg-teal-50 text-teal-700 dark:bg-teal-900 dark:text-teal-300">#{t}</span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-96" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold mb-4 text-gray-800 dark:text-gray-100">{editing ? '編輯備忘' : '記一則備忘'}</h3>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">標題</label>
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="簡短標題"
              className="w-full mb-3 px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100" />
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">內文</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={4}
              className="w-full mb-3 px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 resize-y" />
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">日期</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full mb-3 px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100" />
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">標籤</label>
            <div className="flex flex-wrap gap-1 mb-4">
              {MEMO_QUICK_TAGS.map(t => (
                <button key={t} onClick={() => toggleFormTag(t)}
                  className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${formTags.includes(t) ? 'bg-teal-500 text-white border-teal-500' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-teal-400'}`}>
                  {t}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300">取消</button>
              <button onClick={save} className="flex-1 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium">存檔</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MemoPage
