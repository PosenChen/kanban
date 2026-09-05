import { useState, useCallback } from 'react'
import { STATUS_CONFIG } from '@/types/project'
import type { Project } from '@/types/project'
import { getRemainingDays, formatMonthDay } from '@/utils/dateUtils'

interface FilterBarProps {
  searchQuery: string
  onSearchChange: (q: string) => void
  statusFilter: string
  onStatusChange: (s: string) => void
  priorityFilter: string
  onPriorityChange: (p: string) => void
  allTags: string[]
  selectedTags: string[]
  onTagToggle: (tag: string) => void
  onCreateClick: () => void
  rootCount: number
}

function FilterBar({
  searchQuery, onSearchChange,
  statusFilter, onStatusChange,
  priorityFilter, onPriorityChange,
  allTags, selectedTags, onTagToggle,
  onCreateClick, rootCount,
}: FilterBarProps) {
  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 space-y-3">
      {/* 手機：搜尋框＋狀態＋優先級同一列（搜尋框窄化）；桌面同列Spacer拉開＋新增 */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0 md:max-w-xs">
          <input
            type="text"
            placeholder="搜尋..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
          />
          <svg className="absolute left-2.5 top-2 w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="hidden md:block flex-1" />
        <select
          value={statusFilter}
          onChange={e => onStatusChange(e.target.value)}
          aria-label="狀態篩選"
          className="text-xs md:text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-1.5 md:px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 shrink-0"
        >
          <option value="">全部狀態</option>
          <option value="preparation">準備中</option>
          <option value="in_progress">進行中</option>
          <option value="completed">已完成</option>
        </select>

        <select
          value={priorityFilter}
          onChange={e => onPriorityChange(e.target.value)}
          aria-label="優先級篩選"
          className="text-xs md:text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-1.5 md:px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 shrink-0"
        >
          <option value="">全部優先</option>
          <option value="high">高</option>
          <option value="medium">中</option>
          <option value="low">低</option>
        </select>

        <button
          onClick={onCreateClick}
          aria-label="新增專案"
          className="flex items-center gap-1 px-2.5 md:px-4 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden md:inline">新增專案</span>
        </button>
      </div>

      {/* Tag row（標籤多，獨立一列；手機單列橫向不擠） */}
      {allTags.length > 0 && (
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">標籤:</label>
        <div className="flex gap-1 flex-wrap">
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => onTagToggle(tag)}
                  className={`px-2 py-0.5 text-xs rounded-full border ${
                    selectedTags.includes(tag)
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-400'
                  }`}
                >
                  {tag}
                </button>
              ))}
        </div>
      </div>
      )}

      <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
        <span>共 {rootCount} 個專案</span>
      </div>
    </div>
  )
}

export default FilterBar
