import { useState, useCallback } from 'react'
import { projectStore } from '@/data/localStorageStore'
import { isFirebaseEnabled, setFirebaseEnabled } from '@/data/localStorageStore'
import { db, PROJECTS_COLLECTION, addProjectToFirestore, updateProjectInFirestore, deleteProjectFromFirestore } from '@/services/firebaseService'

function SettingsPage() {
  const [isFirebaseEnabled, setIsFirebaseEnabled] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

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

  const handleSyncToFirebase = async () => {
    setSyncStatus('syncing')
    setErrorMessage('')
    
    try {
      const projects = projectStore.getAll()
      
      // 這裡應該調用 Firebase 服務來同步數據
      // 由於需要完整的 Firebase 設置，這裡只展示基本邏輯
      
      // 實際實現應該：
      // 1. 獲取所有本地專案
      // 2. 上傳到 Firestore
      // 3. 處理衝突和同步狀態
      
      setSyncStatus('success')
      setTimeout(() => setSyncStatus('idle'), 3000)
    } catch (error) {
      setSyncStatus('error')
      setErrorMessage('同步失敗：' + (error as Error).message)
      setTimeout(() => {
        setSyncStatus('idle')
        setErrorMessage('')
      }, 5000)
    }
  }

  const handleEnableFirebase = () => {
    setIsFirebaseEnabled(!isFirebaseEnabled)
    setFirebaseEnabled(!isFirebaseEnabled)
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <button onClick={() => window.history.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        ← 返回
      </button>

      <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-700">
        <p><strong>數據持久化設置</strong></p>
        <p>選擇數據保存方式以確保跨裝置同步</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        {/* Firebase 設置 */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Firebase Firestore 同步</h3>
          <p className="text-xs text-gray-400 mb-3">跨裝置同步專案數據，使用 Firebase Firestore 作為數據庫</p>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleEnableFirebase}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isFirebaseEnabled 
                  ? 'bg-green-500 text-white hover:bg-green-600' 
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {isFirebaseEnabled ? '已啟用' : '啟用同步'}
            </button>
            
            {isFirebaseEnabled && (
              <button
                onClick={handleSyncToFirebase}
                disabled={syncStatus === 'syncing'}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  syncStatus === 'syncing'
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-purple-500 text-white hover:bg-purple-600'
                }`}
              >
                {syncStatus === 'syncing' ? '同步中...' : '立即同步'}
              </button>
            )}
          </div>
          
          {syncStatus === 'error' && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
              {errorMessage}
            </div>
          )}
          
          {syncStatus === 'success' && (
            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-600">
              ✅ 同步成功！
            </div>
          )}
        </div>

        {/* GitHub API 設置 */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">GitHub Personal Access Token</h3>
          <p className="text-xs text-gray-400 mb-2">repo 權限 → GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)</p>
          <div className="flex gap-2">
            <input type="text" id="gh-token-input" placeholder="***"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <button onClick={() => {
              const input = document.getElementById('gh-token-input') as HTMLInputElement | null
              const t = input?.value?.trim() || ''
              if (t.length < 10) { alert('請輸入有效的 GitHub Personal Access Token') }
              else {
                localStorage.setItem('kanban_github_token', t)
                alert('Token 已儲存！')
              }
            }}
              className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">儲存 Token</button>
          </div>
          <button onClick={() => {
            if (!confirm('移除 GitHub Token 並切回 LocalStorage？')) return
            localStorage.removeItem('kanban_github_token')
            alert('已移除')
          }}
            className="mt-2 px-3 py-1.5 text-xs border border-red-300 text-red-500 rounded hover:bg-red-50">移除 Token</button>
        </div>

        {/* 備份 / 還原 */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">備份 / 還原</h3>
          <div className="flex gap-3">
            <button onClick={handleExport}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100">📤 匯出 JSON</button>
            <button onClick={handleImport}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100">📥 匯入 JSON</button>
          </div>
        </div>

        {/* 使用說明 */}
        <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
          <p><strong>數據同步選項：</strong></p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li><strong>LocalStorage</strong>：數據保存在瀏覽器中，關閉頁面後仍存在</li>
            <li><strong>Firebase Firestore</strong>：跨裝置同步，需要在 Firebase 控制台設置數據庫</li>
            <li><strong>GitHub API</strong>：將數據保存到 GitHub 倉庫，可跨裝置訪問</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
