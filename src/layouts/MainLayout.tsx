import { Outlet, useLocation, Link } from 'react-router-dom'
import { useState } from 'react'

function MainLayout() {
  const location = useLocation()

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-xl font-bold text-gray-800 dark:text-gray-100 hover:text-blue-600 transition-colors">
              📋 專案看板
            </Link>
            <nav className="flex items-center gap-1">
              <Link to="/" className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${isActive('/') ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 font-medium' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200'}`}>
                甘特圖
              </Link>
              <Link to="/board" className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${location.pathname === '/board' ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 font-medium' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200'}`}>
                看板
              </Link>
              <Link to="/daily" className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${isActive('/daily') ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 font-medium' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200'}`}>
                日曆
              </Link>
              <Link to="/archive" className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${location.pathname === '/archive' ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 font-medium' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200'}`}>
                檔案庫
              </Link>
              <Link to="/settings" className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${location.pathname === '/settings' ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 font-medium' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200'}`}>
                設定
              </Link>
            </nav>
          </div>
          <div className="text-sm text-gray-400 dark:text-gray-500">Posen Chen</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-4">
        <Outlet />
      </main>
    </div>
  )
}

export default MainLayout
