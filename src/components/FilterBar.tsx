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
      {/* Top row: search + actions */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="搜尋專案、標籤..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
          />
          <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <button
          onClick={onCreateClick}
          className="flex items-center gap-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新增專案
        </button>
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">狀態:</label>
        <select
          value={statusFilter}
          onChange={e => onStatusChange(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">全部</option>
          <option value="preparation">準備中</option>
          <option value="in_progress">進行中</option>
          <option value="completed">已完成</option>
        </select>

        <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">優先級:</label>
        <select
          value={priorityFilter}
          onChange={e => onPriorityChange(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">全部</option>
          <option value="high">高</option>
          <option value="medium">中</option>
          <option value="low">低</option>
        </select>

        {allTags.length > 0 && (
          <>
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
          </>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
        <span>共 {rootCount} 個專案</span>
      </div>
    </div>
  )
}

export default FilterBar
