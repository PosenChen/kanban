import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { projectStore } from '@/data/localStorageStore'
import { TOPIC_QUICK_TAGS, TOPIC_STATUS_LABELS, type Topic } from '@/types/project'
import { dateToStr } from '@/utils/dateUtils'
import { monthlyDoneCount, todayTopic } from '@/utils/topicUtils'

function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>(() => projectStore.getTopics())
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Topic | null>(null)
  const [title, setTitle] = useState('')
  const [outline, setOutline] = useState('')
  const [formTags, setFormTags] = useState<string[]>([])

  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail as Topic[] | undefined
      if (d) setTopics([...d])
    }
    window.addEventListener('kanban:topic-change', h)
    return () => window.removeEventListener('kanban:topic-change', h)
  }, [])

  const today = todayTopic(topics)
  const pool = useMemo(() => topics.filter(t => t.status === 'pool').sort((a, b) => a.sort_order - b.sort_order), [topics])
  const done = useMemo(() => topics.filter(t => t.status === 'done').sort((a, b) => (b.done_date ?? '').localeCompare(a.done_date ?? '')), [topics])
  const ym = dateToStr(new Date()).slice(0, 7)
  const monthCount = monthlyDoneCount(topics, ym)
  const poolCount = pool.length

  const openAdd = () => {
    setEditing(null); setTitle(''); setOutline(''); setFormTags([]); setShowForm(true)
  }
  const openEdit = (it: Topic) => {
    setEditing(it); setTitle(it.title); setOutline(it.outline ?? ''); setFormTags([...it.tags]); setShowForm(true)
  }
  const save = () => {
    if (!title.trim()) { alert('主題標題必填'); return }
    if (editing) {
      projectStore.updateTopic(editing.id, { title: title.trim(), outline: outline.trim(), tags: formTags })
    } else {
      const maxSo = pool.reduce((m, t) => Math.max(m, t.sort_order), -1)
      projectStore.addTopic({ title: title.trim(), outline: outline.trim(), tags: formTags, sort_order: maxSo + 1, added_date: dateToStr(new Date()) })
    }
    setShowForm(false)
  }
  const remove = (e: React.MouseEvent, it: Topic) => {
    e.stopPropagation()
    if (!confirm(`確定刪除選題「${it.title}」？`)) return
    projectStore.removeTopic(it.id)
  }
  const move = (e: React.MouseEvent, id: string, dir: -1 | 1) => {
    e.stopPropagation()
    projectStore.moveTopic(id, dir)
  }
  const toggleFormTag = (t: string) =>
    setFormTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Link to="/" className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-500">← 返回</Link>
        <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100 ml-auto">📚 選題庫</h1>
        <button onClick={openAdd} className="px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium">＋ 儲備</button>
      </div>

      {/* 今日題大卡 */}
      {today ? (
        <div className="mb-4 rounded-xl border-2 border-indigo-400 dark:border-indigo-500 bg-white dark:bg-gray-800 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">今日題</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">{TOPIC_STATUS_LABELS[today.status]}</span>
            <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">入庫 {today.added_date}</span>
          </div>
          <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">{today.title}</h2>
          {today.outline && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1.5 whitespace-pre-wrap">{today.outline}</p>}
          {today.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {today.tags.map(t => <span key={t} className="px-1.5 py-0.5 text-[10px] rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">#{t}</span>)}
            </div>
          )}
          <div className="flex gap-2 mt-3">
            {today.status === 'pool' && (
              <button onClick={() => projectStore.claimTopic(today.id)} className="flex-1 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium">✍️ 領題開寫</button>
            )}
            {today.status === 'writing' && (
              <>
                <button onClick={() => projectStore.completeTopic(today.id, dateToStr(new Date()))} className="flex-1 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium">✅ 交卷</button>
                <button onClick={() => projectStore.releaseTopic(today.id)} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300">↩ 放回池</button>
              </>
            )}
            <button onClick={() => openEdit(today)} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300">編輯</button>
          </div>
        </div>
      ) : (
        <div className="mb-4 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-4 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">{topics.length === 0 ? '選題池是空的——先「＋ 儲備」幾個主題吧' : '本週選題全寫完了 🎉 點右上「＋ 儲備」補貨'}</p>
          <button onClick={openAdd} className="mt-2 px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium">＋ 儲備下一題</button>
        </div>
      )}

      {/* 本月子績 + 池 */}
      <div className="flex items-center gap-2 mb-2 text-sm text-gray-500 dark:text-gray-400">
        <span className="font-medium text-gray-700 dark:text-gray-200">📥 儲備池</span>
        <span className="text-xs text-gray-400">{poolCount} 題待寫</span>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">{ym} 已交 {monthCount} 篇</span>
      </div>
      <div className="space-y-2 mb-4">
        {pool.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">池中無題</p>
        ) : (
          pool.map((t, i) => (
            <div key={t.id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer" onClick={() => openEdit(t)}>
              <div className="flex items-center gap-2">
                <span className="w-5 text-xs text-gray-400 dark:text-gray-500 text-right flex-shrink-0">{i + 1}.</span>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{t.title}</span>
                <span className="ml-auto flex-shrink-0 flex items-center gap-0.5">
                  <button onClick={(e) => move(e, t.id, -1)} disabled={i === 0} className="text-gray-300 hover:text-blue-500 disabled:opacity-30 text-sm px-0.5" title="提前">▲</button>
                  <button onClick={(e) => move(e, t.id, 1)} disabled={i === pool.length - 1} className="text-gray-300 hover:text-blue-500 disabled:opacity-30 text-sm px-0.5" title="退後">▼</button>
                  <button onClick={(e) => remove(e, t)} className="text-gray-300 hover:text-red-500 text-sm px-1" title="刪除">✕</button>
                </span>
              </div>
              {t.outline && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-7 truncate">{t.outline}</p>}
            </div>
          ))
        )}
      </div>

      {/* 歷史交卷 */}
      {done.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">✅ 已交卷</div>
          <div className="space-y-1">
            {done.map(t => (
              <div key={t.id} className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 line-through cursor-pointer" onClick={() => openEdit(t)}>
                <span className="truncate">{t.title}</span>
                <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{t.done_date}</span>
                <button onClick={(e) => remove(e, t)} className="text-gray-300 hover:text-red-500 text-xs flex-shrink-0" title="刪除">✕</button>
              </div>
            ))}
          </div>
        </>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-96" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold mb-4 text-gray-800 dark:text-gray-100">{editing ? '編輯選題' : '儲備新選題'}</h3>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">主題標題 *</label>
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="今天想寫什麼主題？"
              className="w-full mb-3 px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100" />
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">大綱／靈感（選填）</label>
            <textarea value={outline} onChange={e => setOutline(e.target.value)} rows={4}
              className="w-full mb-3 px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 resize-y" />
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">標籤</label>
            <div className="flex flex-wrap gap-1 mb-4">
              {TOPIC_QUICK_TAGS.map(t => (
                <button key={t} onClick={() => toggleFormTag(t)}
                  className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${formTags.includes(t) ? 'bg-indigo-500 text-white border-indigo-500' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-indigo-400'}`}>
                  {t}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300">取消</button>
              <button onClick={save} className="flex-1 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium">存檔</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TopicsPage
