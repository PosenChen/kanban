import { useState, useEffect, useCallback } from 'react'
import { projectStore, scheduleGitHubSync, getSyncStatus, getStorageSource, setStorageSource, getArchiveDays, pushToGitHub, getLocalCounts, fetchRemoteCounts, type SyncEventDetail } from '@/data/localStorageStore'
import { formatCountSummary } from '@/utils/syncGuardUtils'
import { isProjectTemplate } from '@/utils/exportUtils'

function SettingsPage() {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [syncInfo, setSyncInfo] = useState({ hasToken: false })
  const [archiveDays] = useState(() => getArchiveDays())

  useEffect(() => {
    setSyncInfo(getSyncStatus())
    // 自動同步（3秒去抖）的結果也反映到 UI：衝突/錯誤要讓使用者看見
    const onSync = (e: Event) => {
      const d = (e as CustomEvent<SyncEventDetail>).detail
      if (d.state === 'conflict') {
        setSyncStatus('error')
        setErrorMessage(`⚠️ 同步衝突：${d.path} 已被其他裝置更新，請先「下載」再上傳。`)
      } else if (d.state === 'error') {
        setSyncStatus('error')
        setErrorMessage('背景同步失敗：' + d.message)
      } else if (d.state === 'ok' && d.skipped.length > 0) {
        setErrorMessage(`自動同步跳過空覆蓋：${d.skipped.join(', ')}`)
      }
    }
    window.addEventListener('kanban:sync-status', onSync)
    return () => window.removeEventListener('kanban:sync-status', onSync)
  }, [])

  const handleExport = () => {
    const raw = localStorage.getItem('kanban_projects')
    const milestonesRaw = localStorage.getItem('kanban_milestones')
    const todosRaw = localStorage.getItem('kanban_todos')
    const projects = raw ? JSON.parse(raw) : []
    const milestones = milestonesRaw ? JSON.parse(milestonesRaw) : []
    const todos = todosRaw ? JSON.parse(todosRaw) : []
    const backup = { projects, milestones, todos }
    const json = JSON.stringify(backup, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kanban-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string)
          // 專案模板：偵測到 → 附加匯入（新 ID + 日期重錨定今日），不覆蓋現有資料
          if (isProjectTemplate(data)) {
            const roots = data.projects.filter(p => !p.parent_id).length
            const msg = `匯入模板「${data.projects[0].name}」？\n共 ${data.projects.length} 個專案（頂層 ${roots} 個），日期將重錨定為今天起算。\n（附加到現有資料，不會覆蓋）`
            if (!confirm(msg)) return
            const added = projectStore.importTemplate(data)
            alert(`已匯入 ${added.length} 個專案`)
            window.location.reload()
            return
          }
          // Accept { projects: [...], milestones: [...], todos: [...] } or legacy plain [... ]
          const projects = Array.isArray(data.projects) ? data.projects : data
          if (projects.length > 0 && projects[0].id && projects[0].name) {
            let confirmMsg = `匯入 ${projects.length} 個專案？`
            if (Array.isArray(data.milestones)) {
              confirmMsg += `\n匯入 ${data.milestones.length} 個活動？`
            }
            if (Array.isArray(data.todos)) {
              confirmMsg += `\n匯入 ${data.todos.length} 個待辦？`
            }
            if (!confirm(confirmMsg)) return
            localStorage.setItem('kanban_projects', JSON.stringify(projects))
            if (Array.isArray(data.milestones)) {
              localStorage.setItem('kanban_milestones', JSON.stringify(data.milestones))
            }
            if (Array.isArray(data.todos)) {
              localStorage.setItem('kanban_todos', JSON.stringify(data.todos))
            }
            window.location.reload()
          } else { alert('檔案格式不正確') }
        } catch { alert('無法讀取檔案') }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  const handleSaveToken = () => {
    const input = document.getElementById('gh-token-input') as HTMLInputElement | null
    const t = input?.value?.trim() || ''
    if (t.length < 10) { alert('請輸入有效的 GitHub Personal Access Token') }
    else {
      localStorage.setItem('kanban_github_token', t)
      setSyncInfo(getSyncStatus())
      alert('Token 已儲存！')
    }
  }

  const handleRemoveToken = () => {
    if (!confirm('移除 GitHub Token 並切回 LocalStorage？')) return
    localStorage.removeItem('kanban_github_token')
    localStorage.removeItem('kanban_storage_source')
    setSyncInfo(getSyncStatus())
    alert('已移除')
  }

  const handlePullGitHub = async () => {
    const token = localStorage.getItem('kanban_github_token')
    if (!token || token.trim().length < 10) {
      alert('尚未設定 GitHub Token')
      return
    }
    setSyncStatus('loading')
    setErrorMessage('')
    try {
      await projectStore.loadFromGitHub(token.trim())
      setSyncStatus('success')
      setTimeout(() => setSyncStatus('idle'), 3000)
    } catch (error) {
      setSyncStatus('error')
      setErrorMessage('讀取失敗：' + (error as Error).message)
      setTimeout(() => setSyncStatus('idle'), 5000)
    }
  }

  const handlePushGitHub = async () => {
    const token = localStorage.getItem('kanban_github_token')
    if (!token || token.trim().length < 10) {
      alert('尚未設定 GitHub Token')
      return
    }
    setSyncStatus('syncing')
    setErrorMessage('')
    // 上傳前先拉雲端筆數，確認對話框顯示「本地/雲端」比對，防誤清空
    const local = getLocalCounts()
    const remote = await fetchRemoteCounts(token.trim())
    const labels = ['專案', '活動', '待辦', '流水帳', '記帳', '備忘']
    const lc = [local.projects, local.milestones, local.todos, local.routines, local.ledger, local.memos]
    const rc = [remote.projects, remote.milestones, remote.todos, remote.routines, remote.ledger, remote.memos]
    const zeroOverwrite = labels.filter((_, i) => lc[i] === 0 && rc[i] > 0)
    let msg = `上傳（覆蓋）到 GitHub？\n比對 本地/雲端：\n${formatCountSummary(labels, lc, rc)}`
    if (zeroOverwrite.length > 0) {
      msg += `\n\n⚠️ 本地為空但雲端有資料：${zeroOverwrite.join('、')}——這些檔將自動跳過不上傳（空覆蓋防護）。`
    }
    if (!confirm(msg)) { setSyncStatus('idle'); return }
    const force = confirm('強制上傳全部檔案（含本地為空者）？\n選「取消」則維持防護：本地空的檔案跳過不覆蓋雲端。')
    const result = await pushToGitHub(token.trim(), force)
    if (result.state === 'ok') {
      if (result.skipped.length > 0) {
        setSyncStatus('success')
        setErrorMessage(`已上傳 ${result.uploaded.length} 檔；跳過（空覆蓋防護）：${result.skipped.join(', ')}`)
      } else {
        setSyncStatus('success')
      }
      setTimeout(() => setSyncStatus('idle'), 3000)
    } else if (result.state === 'conflict') {
      setSyncStatus('error')
      setErrorMessage(`衝突：${result.path} 已被其他裝置更新，請先「下載」合併後再上傳。`)
      setTimeout(() => setSyncStatus('idle'), 8000)
    } else {
      setSyncStatus('error')
      setErrorMessage('同步失敗：' + result.message)
      setTimeout(() => setSyncStatus('idle'), 5000)
    }
  }

  const handleSwitchToGitHub = () => {
    const token = localStorage.getItem('kanban_github_token')
    if (!token || token.trim().length < 10) {
      alert('請先輸入 GitHub Token')
      return
    }
    setStorageSource('github')
    window.location.reload()
  }

  const handleSwitchToLocal = () => {
    setStorageSource('local')
    window.location.reload()
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <button onClick={() => window.history.back()} className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200">
        ← 返回
      </button>

      <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 text-sm text-blue-700 dark:text-blue-300">
        <p><strong>數據持久化設置</strong></p>
        <p>手動同步機制：下載（讀取）從 GitHub 拉取資料，上傳（同步）推送資料到 GitHub</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        {/* 同步狀態 */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">📡 同步狀態</h3>
          {syncInfo.hasToken ? (
            <div className="space-y-2 text-sm">
              <p className="text-green-600 font-medium">✅ 已检测到 GitHub Token</p>
              <p className="text-gray-500 dark:text-gray-400">目前使用方式：LocalStorage（本地儲存）</p>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="text-orange-600 font-medium">⚠️ 未检测到 GitHub Token</p>
              <p className="text-gray-500 dark:text-gray-400">目前只使用 LocalStorage（每個瀏覽器獨立保存）</p>
            </div>
          )}
        </div>

        {/* GitHub Token 輸入 */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">🔑 GitHub Personal Access Token</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
            repo 權限 → GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
          </p>
          <div className="flex gap-2">
            <input type="text" id="gh-token-input" placeholder="ghp_..."
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <button onClick={handleSaveToken}
              className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">儲存 Token</button>
          </div>
          {syncInfo.hasToken && (
            <button onClick={handleRemoveToken}
              className="mt-2 px-3 py-1.5 text-xs border border-red-300 text-red-500 rounded hover:bg-red-50">移除 Token</button>
          )}
        </div>

        {/* 手動同步按鈕 */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">🔄 手動同步</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
            點擊「下載 GitHub」從雲端拉取最新專案資料<br/>
            修改專案後 3 秒自動「上傳（同步）」到 GitHub
          </p>
          <div className="flex gap-2 flex-wrap">
            {syncInfo.hasToken && (
              <>
                <button onClick={handlePullGitHub}
                  className="px-3 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600">
                  📥 下載 GitHub（讀取）
                </button>
                <button onClick={handlePushGitHub}
                  className="px-3 py-2 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600">
                  📤 上傳到 GitHub（同步）
                </button>
              </>
            )}
            {getStorageSource() === 'github' && (
              <button onClick={handleSwitchToLocal}
                className="px-3 py-2 bg-gray-500 text-white rounded-lg text-sm hover:bg-gray-600">
                📁 切換為 LocalStorage
              </button>
            )}
          </div>
          {syncStatus === 'error' && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">{errorMessage}</div>
          )}
          {syncStatus === 'success' && (
            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-600">✅ 同步成功！</div>
          )}
          {syncStatus === 'loading' && (
            <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded text-xs text-blue-600">⏳ 讀取中...</div>
          )}
        </div>

        {/* 備份 / 還原 */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">💾 備份 / 還原</h3>
          <div className="flex gap-3">
            <button onClick={handleExport}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:bg-gray-700">📤 匯出 JSON</button>
            <button onClick={handleImport}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:bg-gray-700">📥 匯入 JSON</button>
          </div>
        </div>

        {/* 自動退場 */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">🗂️ 自動退場</h3>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <span>完成後逾</span>
            <input
              type="number"
              min={0}
              defaultValue={archiveDays}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              onBlur={e => {
                const n = Math.max(0, parseInt(e.target.value, 10) || 0)
                e.target.value = String(n)
                localStorage.setItem('kanban_archive_days', String(n))
                projectStore.autoArchive()
              }}
              className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-center"
            />
            <span>天自動退入檔案庫（總覽不再顯示，資料保留）</span>
          </div>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">父專案連同全部子專案一併退場；可在檔案庫隨時還原。</p>
        </div>

        {/* 使用說明 */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-xs text-gray-500 dark:text-gray-400 space-y-2">
          <p><strong>📖 數據同步說明：</strong></p>
          <ol className="list-decimal list-inside space-y-1">
            <li>
              <strong>打開網頁時</strong>：不會自動讀取 GitHub，只使用本地 LocalStorage
            </li>
            <li>
              <strong>點擊「下載 GitHub」</strong>：手動從 GitHub 讀取最新專案資料（看板左上角按鈕）
            </li>
            <li>
              <strong>修改專案時</strong>：自動 3 秒後寫入 GitHub（只需設定 Token 一次）
            </li>
            <li>
              <strong>跨裝置使用</strong>：在新裝置先「下載 GitHub」→ 修改 → 自動同步
            </li>
          </ol>
          <p className="mt-1 text-blue-600">💡 建議流程：新裝置打開 → 點「下載 GitHub」→ 開始使用（修改會自動上傳）</p>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
