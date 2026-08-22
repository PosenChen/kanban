import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjects } from '@/hooks/useProjects'
import { STATUS_CONFIG, type Project } from '@/types/project'
import { dateToStr, addDays, dateToStr as fmtDate, getDaysDiff, formatMonthDay } from '@/utils/dateUtils'

interface GanttRow {
  project: Project
  depth: number
}

const DAY_WIDTH = 28
const ROW_HEIGHT = 44
const SIDEBAR_WIDTH = 200

function buildFlatList(projects: Project[]): GanttRow[] {
  const result: GanttRow[] = []

  function walk(parentId: string | null, depth: number) {
    const children = projects.filter(p => p.parent_id === parentId)
    for (const child of children) {
      result.push({ project: child, depth })
      walk(child.id, depth + 1)
    }
  }

  walk(null, 0)
  return result
}

function GanttPage() {
  const navigate = useNavigate()
  const { projects, add, remove } = useProjects()
  const flatList = useMemo(() => buildFlatList(projects), [projects])

  // View state
  const [viewStart, setViewStart] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })
  const [zoomLevel, setZoomLevel] = useState<'month' | 'week' | 'day'>('month')

  // Filter
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  // Expand state
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set())

  // Filtering
  const filteredList = useMemo(() => {
    let list = flatList

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(r =>
        r.project.name.toLowerCase().includes(q) ||
        r.project.description.toLowerCase().includes(q) ||
        r.project.tags.some(t => t.toLowerCase().includes(q))
      )
    }
    if (statusFilter) list = list.filter(r => r.project.status === statusFilter)
    if (priorityFilter) list = list.filter(r => r.project.priority === priorityFilter)
    if (selectedTags.length > 0) list = list.filter(r => r.project.tags.some(t => selectedTags.includes(t)))

    return list
  }, [flatList, searchQuery, statusFilter, priorityFilter, selectedTags])

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    projects.forEach(p => p.tags.forEach(t => tagSet.add(t)))
    return Array.from(tagSet).sort()
  }, [projects])

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }, [])

  const toggleExpand = useCallback((parentId: string) => {
    setExpandedParents(prev => {
      const next = new Set(prev)
      if (next.has(parentId)) next.delete(parentId)
      else next.add(parentId)
      return next
    })
  }, [])

  // Auto-expand root projects
  useEffect(() => {
    const rootIds = projects.filter(p => p.parent_id === null).map(p => p.id)
    setExpandedParents(new Set(rootIds))
  }, [projects])

  // View range
  const viewEnd = useMemo(() => {
    const end = new Date(viewStart)
    if (zoomLevel === 'day') end.setDate(end.getDate() + 90)
    else if (zoomLevel === 'week') end.setMonth(end.getMonth() + 3)
    else end.setFullYear(end.getFullYear() + 1)
    return end
  }, [viewStart, zoomLevel])

  // Generate date headers
  const dateHeaders = useMemo(() => {
    const headers: { label: string; dateStr: string }[] = []
    const d = new Date(viewStart)
    const endDate = new Date(viewEnd)
    // Snap to first day of month if month/week view
    if (zoomLevel !== 'day') d.setDate(1)

    while (d <= endDate) {
      headers.push({
        label: zoomLevel === 'day' ? String(d.getDate()) : String(d.getMonth() + 1),
        dateStr: dateToStr(d),
      })
      if (zoomLevel === 'day') d.setDate(d.getDate() + 1)
      else if (zoomLevel === 'week') d.setDate(d.getDate() + 7)
      else d.setMonth(d.getMonth() + 1)
    }
    return headers
  }, [viewStart, viewEnd, zoomLevel])

  const totalWidth = dateHeaders.length * DAY_WIDTH

  // Color map
  const statusColorMap: Record<string, string> = {
    preparation: '#FBBF24',
    in_progress: '#3B82F6',
    completed: '#10B981',
  }

  const handleDateClick = useCallback((dateStr: string) => {
    navigate(`/daily/${dateStr}`)
  }, [navigate])

  const handleProjectClick = useCallback((id: string) => {
    navigate(`/project/${id}`)
  }, [navigate])

  const handleAdd = useCallback(() => {
    const now = new Date().toISOString().split('T')[0]
    const next = addDays(now, 7)
    add({
      name: '新專案',
      description: '',
      parent_id: null,
      start_date: now,
      end_date: next,
      status: 'preparation',
      priority: 'medium',
      tags: [],
      progress: 0,
    })
  }, [add])

  const handleDelete = useCallback((id: string) => {
    if (confirm('確定刪除此專案？')) {
      remove(id)
    }
  }, [remove])

  const allProjectsForDropdown = useMemo(() => projects.filter(p => p.parent_id === null), [projects])

  // Render gantt bar for a single row
  const renderBar = (row: GanttRow) => {
    const startMs = new Date(row.project.start_date).getTime()
    const endMs = new Date(row.project.end_date).getTime()
    const viewStartMs = new Date(viewStart).getTime()
    const viewEndMs = new Date(viewEnd).getTime()

    if (endMs < viewStartMs || startMs > viewEndMs) return null

    const offsetMs = Math.max(0, startMs - viewStartMs)
    const barLenMs = Math.min(endMs, viewEndMs) - Math.max(startMs, viewStartMs)
    const offset = offsetMs / (1000 * 60 * 60 * 24)
    const width = barLenMs / (1000 * 60 * 60 * 24)

    return (
      <foreignObject
        x={offset}
        y={0}
        width={Math.max(width, 4)}
        height={ROW_HEIGHT - 4}
      >
        <div
          className={`h-full rounded flex items-center px-1.5 cursor-pointer group ${
            row.project.status === 'completed' ? 'opacity-60' : ''
          }`}
          style={{
            backgroundColor: statusColorMap[row.project.status] + 'CC',
            minWidth: '4px',
          }}
          onClick={() => handleProjectClick(row.project.id)}
          title={`${row.project.name} (${row.project.start_date} ~ ${row.project.end_date})`}
        >
          {width > 20 && (
            <span className="text-white text-xs truncate font-medium drop-shadow">
              {row.project.name}
            </span>
          )}
        </div>
      </foreignObject>
    )
  }

  // Build date click map for SVG
  const dateClickMap = dateHeaders.map((h, i) => ({
    dateStr: h.dateStr,
    x: i * DAY_WIDTH,
    width: DAY_WIDTH,
  }))

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-3">
        {/* Search + Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="搜尋專案、標籤..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
            />
            <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">狀態 ▾</option>
              <option value="preparation">準備中</option>
              <option value="in_progress">進行中</option>
              <option value="completed">已完成</option>
            </select>
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">優先級 ▾</option>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
            <button
              onClick={handleAdd}
              className="flex items-center gap-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              新增
            </button>
          </div>
        </div>

        {/* Tags + Legend */}
        <div className="flex items-center gap-3 flex-wrap">
          {allTags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500">標籤:</span>
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                    selectedTags.includes(tag)
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'border-gray-300 text-gray-600 hover:border-blue-400'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3 ml-auto">
            <span className="flex items-center gap-1 text-xs"><span className="w-3 h-3 rounded inline-block bg-yellow-400"></span>準備中</span>
            <span className="flex items-center gap-1 text-xs"><span className="w-3 h-3 rounded inline-block bg-blue-500"></span>進行中</span>
            <span className="flex items-center gap-1 text-xs"><span className="w-3 h-3 rounded inline-block bg-green-500"></span>已完成</span>
          </div>
        </div>
      </div>

      {/* Gantt Chart SVG */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Zoom controls */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
          <div className="text-sm text-gray-500">
            {formatMonthDay(dateToStr(viewStart))} ~ {formatMonthDay(dateToStr(viewEnd))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">縮放:</span>
            <button
              onClick={() => setZoomLevel('month')}
              className={`px-2 py-1 text-xs rounded ${zoomLevel === 'month' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >月</button>
            <button
              onClick={() => setZoomLevel('week')}
              className={`px-2 py-1 text-xs rounded ${zoomLevel === 'week' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >週</button>
            <button
              onClick={() => setZoomLevel('day')}
              className={`px-2 py-1 text-xs rounded ${zoomLevel === 'day' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >日</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <svg width={totalWidth + SIDEBAR_WIDTH} height={Math.max(flatList.length * ROW_HEIGHT, 300)}>
            {/* Sidebar header */}
            <rect x={0} y={0} width={SIDEBAR_WIDTH} height={30} fill="#f9fafb" />
            <text x={10} y={18} className="text-xs font-semibold fill-gray-600" fontSize="12">專案</text>

            {/* Date header */}
            <rect x={SIDEBAR_WIDTH} y={0} width={totalWidth} height={30} fill="#f9fafb" />
            {dateHeaders.map((h, i) => (
              <g key={i}>
                <rect
                  x={SIDEBAR_WIDTH + i * DAY_WIDTH}
                  y={0}
                  width={DAY_WIDTH}
                  height={30}
                  fill={i % 2 === 0 ? 'transparent' : '#f9fafb'}
                />
                <text
                  x={SIDEBAR_WIDTH + i * DAY_WIDTH + DAY_WIDTH / 2}
                  y={18}
                  textAnchor="middle"
                  className="fill-gray-500"
                  fontSize="10"
                >
                  {h.label}
                </text>
              </g>
            ))}

            {/* Clickable date cells */}
            {dateClickMap.map((cell, i) => (
              <rect
                key={`click-${i}`}
                x={SIDEBAR_WIDTH + cell.x}
                y={0}
                width={cell.width}
                height={30}
                fill="transparent"
                onClick={() => handleDateClick(cell.dateStr)}
                className="cursor-pointer"
              />
            ))}

            {/* Rows */}
            {filteredList.map((row, idx) => (
              <g key={row.project.id}>
                {/* Background */}
                <rect
                  x={0}
                  y={30 + idx * ROW_HEIGHT}
                  width={totalWidth + SIDEBAR_WIDTH}
                  height={ROW_HEIGHT}
                  fill={idx % 2 === 0 ? '#fff' : '#f9fafb'}
                />

                {/* Sidebar cell */}
                <g onClick={() => handleProjectClick(row.project.id)} className="cursor-pointer">
                  <rect
                    x={0}
                    y={30 + idx * ROW_HEIGHT}
                    width={SIDEBAR_WIDTH}
                    height={ROW_HEIGHT}
                  />
                  <text
                    x={10}
                    y={30 + idx * ROW_HEIGHT + 22}
                    className="fill-gray-700"
                    fontSize="11"
                  >
                    {'\u00A0'.repeat(row.depth * 2)}
                    {row.depth > 0 ? '↳ ' : ''}{row.project.name}
                  </text>
                </g>

                {/* Day-of-week indicator column (thin stripe) */}
                {dateHeaders.map((h, di) => {
                  const isWeekend = (new Date(h.dateStr).getDay() === 0 || new Date(h.dateStr).getDay() === 6)
                  return (
                    <rect
                      key={`bg-${idx}-${di}`}
                      x={SIDEBAR_WIDTH + di * DAY_WIDTH}
                      y={30 + idx * ROW_HEIGHT}
                      width={DAY_WIDTH}
                      height={ROW_HEIGHT}
                      fill={isWeekend ? '#f3f4f6' : 'transparent'}
                    />
                  )
                })}

                {/* Gantt bar */}
                {renderBar(row)}

                {/* Status dot */}
                <circle
                  cx={SIDEBAR_WIDTH - 8}
                  cy={30 + idx * ROW_HEIGHT + 20}
                  r={4}
                  fill={statusColorMap[row.project.status]}
                />

                {/* Delete button */}
                <circle
                  cx={SIDEBAR_WIDTH - 8}
                  cy={30 + idx * ROW_HEIGHT + ROW_HEIGHT - 10}
                  r={6}
                  fill="none"
                  stroke="#d1d5db"
                  strokeWidth={1}
                  className="cursor-pointer opacity-0 hover:opacity-100"
                  onClick={() => handleDelete(row.project.id)}
                />
                <text
                  x={SIDEBAR_WIDTH - 8}
                  y={30 + idx * ROW_HEIGHT + ROW_HEIGHT - 6}
                  textAnchor="middle"
                  className="fill-gray-400 hover:fill-red-500 cursor-pointer"
                  fontSize={8}
                  onClick={() => handleDelete(row.project.id)}
                >
                  ×
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </div>
  )
}

export default GanttPage
