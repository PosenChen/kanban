import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { projectStore } from '@/data/localStorageStore'
import { LEDGER_KIND_LABELS, LEDGER_QUICK_CATEGORIES, type LedgerEntry, type LedgerKind } from '@/types/project'
import { dateToStr } from '@/utils/dateUtils'
import { monthKeyOf, sumMonth, categoryBreakdown, round2 } from '@/utils/ledgerUtils'

const fmt = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`

function LedgerPage() {
  const [entries, setEntries] = useState<LedgerEntry[]>(() => projectStore.getLedger())
  const [month, setMonth] = useState(() => monthKeyOf(dateToStr(new Date())))
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<LedgerEntry | null>(null)
  const [kind, setKind] = useState<LedgerKind>('expense')
  const [date, setDate] = useState(() => dateToStr(new Date()))
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail as LedgerEntry[] | undefined
      if (d) setEntries([...d])
    }
    window.addEventListener('kanban:ledger-change', h)
    return () => window.removeEventListener('kanban:ledger-change', h)
  }, [])

  const totals = useMemo(() => sumMonth(entries, month), [entries, month])
  const cats = useMemo(() => categoryBreakdown(entries, month), [entries, month])
  const monthEntries = useMemo(
    () => entries.filter(x => monthKeyOf(x.date) === month)
      .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)),
    [entries, month],
  )
  const maxCat = cats.length > 0 ? cats[0].total : 0

  const shiftMonth = (d: number) => {
    const [y, m] = month.split('-').map(Number)
    const dt = new Date(y, m - 1 + d, 1)
    setMonth(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`)
  }

  const openAdd = () => {
    setEditing(null); setKind('expense'); setDate(dateToStr(new Date()))
    setAmount(''); setCategory(''); setNote(''); setShowForm(true)
  }
  const openEdit = (it: LedgerEntry) => {
    setEditing(it); setKind(it.kind); setDate(it.date)
    setAmount(String(it.amount)); setCategory(it.category); setNote(it.note ?? ''); setShowForm(true)
  }
  const save = () => {
    const amt = Math.abs(parseFloat(amount))
    if (!Number.isFinite(amt) || amt <= 0 || !category.trim()) { alert('金額與類別為必填'); return }
    const payload = { date, kind, amount: round2(amt), category: category.trim(), note: note.trim() || undefined }
    if (editing) projectStore.updateLedgerEntry(editing.id, payload)
    else projectStore.addLedgerEntry(payload)
    setShowForm(false)
  }
  const remove = (it: LedgerEntry) => {
    if (!confirm(`確定刪除這筆${LEDGER_KIND_LABELS[it.kind]}「${fmt(it.amount)}｜${it.category}」？`)) return
    projectStore.removeLedgerEntry(it.id)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 max-w-3xl mx-auto">
      {/* Header: back + month nav + add */}
      <div className="flex items-center gap-2 mb-4">
        <Link to="/" className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-500">← 返回</Link>
        <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100 ml-auto">💰 記帳</h1>
        <div className="flex items-center gap-1 text-sm">
          <button onClick={() => shiftMonth(-1)} className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300">‹</button>
          <span className="min-w-[88px] text-center font-medium text-gray-700 dark:text-gray-200">{month.replace('-', '年')}月</span>
          <button onClick={() => shiftMonth(1)} className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300">›</button>
          <button onClick={() => setMonth(monthKeyOf(dateToStr(new Date())))} className="ml-1 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">本月</button>
        </div>
        <button onClick={openAdd} className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium">＋ 記一筆</button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 p-3">
          <div className="text-xs text-emerald-600 dark:text-emerald-400">收入</div>
          <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{fmt(totals.income)}</div>
        </div>
        <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-3">
          <div className="text-xs text-red-600 dark:text-red-400">支出</div>
          <div className="text-lg font-bold text-red-700 dark:text-red-300">{fmt(totals.expense)}</div>
        </div>
        <div className="rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-3">
          <div className="text-xs text-blue-600 dark:text-blue-400">淨額</div>
          <div className={`text-lg font-bold ${totals.net >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-red-700 dark:text-red-300'}`}>{fmt(totals.net)}</div>
        </div>
      </div>

      {/* Category breakdown */}
      {cats.length > 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 mb-4 space-y-1.5">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400">支出分類</div>
          {cats.map(c => (
            <div key={c.category} className="flex items-center gap-2 text-sm">
              <span className="w-16 truncate text-gray-600 dark:text-gray-300">{c.category}</span>
              <div className="flex-1 h-2 rounded bg-gray-100 dark:bg-gray-700">
                <div className="h-2 rounded bg-red-400" style={{ width: maxCat > 0 ? `${Math.max(4, (c.total / maxCat) * 100)}%` : '0%' }} />
              </div>
              <span className="w-24 text-right font-medium text-gray-700 dark:text-gray-200">{fmt(c.total)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Entries */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {monthEntries.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">這個月還沒有紀錄，點右上「＋ 記一筆」</p>
        ) : (
          monthEntries.map(it => (
            <div key={it.id} className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer" onClick={() => openEdit(it)}>
              <span className="text-xs text-gray-400 dark:text-gray-500 w-16 flex-shrink-0">{it.date.slice(5)}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${it.kind === 'income' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}>{LEDGER_KIND_LABELS[it.kind]}</span>
              <span className="text-sm text-gray-700 dark:text-gray-200 truncate">{it.category}{it.note ? <span className="text-xs text-gray-400 dark:text-gray-500">｜{it.note}</span> : null}</span>
              <span className={`ml-auto text-sm font-bold flex-shrink-0 ${it.kind === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-200'}`}>
                {it.kind === 'income' ? '+' : '−'}{fmt(it.amount)}
              </span>
              <button onClick={(e) => { e.stopPropagation(); remove(it) }} className="text-gray-300 hover:text-red-500 text-sm flex-shrink-0" title="刪除">✕</button>
            </div>
          ))
        )}
      </div>

      {/* Add/edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-80" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold mb-4 text-gray-800 dark:text-gray-100">{editing ? '編輯紀錄' : '記一筆'}</h3>
            <div className="flex gap-2 mb-3">
              {(['expense', 'income'] as LedgerKind[]).map(k => (
                <button key={k} onClick={() => setKind(k)}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${kind === k
                    ? (k === 'expense' ? 'bg-red-500 text-white border-red-500' : 'bg-emerald-500 text-white border-emerald-500')
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}>
                  {LEDGER_KIND_LABELS[k]}
                </button>
              ))}
            </div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">日期</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full mb-3 px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100" />
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">金額</label>
            <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0"
              className="w-full mb-3 px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100" />
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">類別</label>
            <input type="text" value={category} onChange={e => setCategory(e.target.value)} placeholder="如 餐飲"
              className="w-full mb-2 px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100" />
            <div className="flex flex-wrap gap-1 mb-3">
              {LEDGER_QUICK_CATEGORIES.map(c => (
                <button key={c} onClick={() => setCategory(c)}
                  className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${category === c ? 'bg-teal-500 text-white border-teal-500' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-teal-400'}`}>
                  {c}
                </button>
              ))}
            </div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">備註（選填）</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)} className="w-full mb-4 px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100" />
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

export default LedgerPage
