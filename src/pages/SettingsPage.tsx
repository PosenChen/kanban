import { useState } from 'react'

function SettingsPage() {
  const handleExport = () => {
    const raw = localStorage.getItem('kanban_projects')
    if (!raw) return
    const data = JSON.parse(raw)
    const json = JSON.stringify(data, null, 2)
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
          if (Array.isArray(data) && data.length > 0 && data[0].id && data[0].name) {
            if (!confirm(`匯入 ${data.length} 個專案？這會覆蓋現有資料。`)) return
            localStorage.setItem('kanban_projects', JSON.stringify(data))
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
      alert('Token 已儲存！')
    }
  }

  const handleClearToken = () => {
    if (!confirm('移除 GitHub Token 並切回 LocalStorage？')) return
    localStorage.removeItem('kanban_github_token')
    alert('已移除')
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <button onClick={() => window.history.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        ← 返回
      </button>

      <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-700">
        <p><strong>Step 8：GitHub API 持久化</strong></p>
        <p>跨裝置同步功能已實作完成。需要 GitHub Personal Access Token (repo 權限) 來啟用。</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">GitHub Personal Access Token</h3>
          <p className="text-xs text-gray-400 mb-2">repo 權限 → GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)</p>
          <div className="flex gap-2">
            <input type="text" id="gh-token-input" placeholder="ghp_xxxxxxxxxxxx"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <button onClick={handleSaveToken}
              className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">儲存 Token</button>
          </div>
          <button onClick={handleClearToken}
            className="mt-2 px-3 py-1.5 text-xs border border-red-300 text-red-500 rounded hover:bg-red-50">移除 Token</button>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">備份 / 還原</h3>
          <div className="flex gap-3">
            <button onClick={handleExport}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100">📤 匯出 JSON</button>
            <button onClick={handleImport}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100">📥 匯入 JSON</button>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
          <p><strong>啟用 GitHub 同步的步驟：</strong></p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>建立 GitHub 倉庫 <code className="bg-gray-200 px-1 rounded">PosenChen/kanban-data</code>（私有）</li>
            <li>在倉庫中建立 <code className="bg-gray-200 px-1 rounded">data/projects.json</code> 空檔案</li>
            <li>產生 Personal Access Token（repo 權限）</li>
            <li>在上方輸入 Token 並儲存即可開始同步</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
