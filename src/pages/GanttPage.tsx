import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjects } from '@/hooks/useProjects'
import { STATUS_CONFIG, type Project } from '@/types/project'
import { dateToStr, addDays, dateToStr as fmtDate, getDaysDiff, formatMonthDay } from '@/utils/dateUtils'

// ── Constants ──
const DAY_WIDTH = 48        // wider for daily view readability
const ROW_HEIGHT = 44
const SIDEBAR_WIDTH = 200
const SCROLL_SENSITIVITY = 0.8 // pixels scrolled → pixels moved

// ── Helpers ──

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

/** How many days to show when user scrolls far enough left/right */
function scrollableDayRange(zoomLevel: 'month' | 'week' | 'day'): number {
  if (zoomLevel === 'day') return 365 * 2
  if (zoomLevel === 'week') return 365 * 3
  return 365 * 10
}

/** Snap a Date to the start of the week (Monday) */
function snapToWeekStart(d: Date): Date {
  const result = new Date(d)
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7))
  result.setHours(0, 0, 0, 0)
  return result
}

/** Snap a Date to the start of the month */
function snapToMonthStart(d: Date): Date {
  const result = new Date(d)
  result.setDate(1)
  result.setHours(0, 0, 0, 0)
  return result
}

interface GanttRow {
  project: Project
  depth: number
}

function GanttPage() {
  const navigate = useNavigate()
  const { projects, add, remove } = useProjects()
  const flatList = useMemo(() => buildFlatList(projects), [projects])

  // ── View state ──
  // Default: start at first project's start date or today, zoom = 'day'
  const todayStr = dateToStr(new Date())
  const [zoomLevel, setZoomLevel] = useState<'month' | 'week' | 'day'>('day')
  const [viewStart, setViewStart] = useState(() => {
    const firstDate = projects.length
      ? projects.reduce((min, p) => p.start_date < min ? p.start_date : min, projects[0].start_date)
      : todayStr
    const d = new Date(firstDate)
    if (zoomLevel === 'week') return snapToWeekStart(d).toISOString().split('T')[0]
    if (zoomLevel === 'month') return snapToMonthStart(d).toISOString().split('T')[0]
    return firstDate
  })
  const [scrollOffset, setScrollOffset] = useState(0) // pixel offset for infinite scroll

  // ── Filter ──
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set())

  // ── Filtering ──
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
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
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

  // ── View range calculation (infinite scroll) ──
  const { dateHeaders, viewStartStr, viewEndStr } = useMemo(() => {
    const startDate = new Date(viewStart)
    startDate.setHours(0, 0, 0, 0)
    const range = scrollableDayRange(zoomLevel)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + range)

    const headers: { label: string; dateStr: string; isWeekStart: boolean; isMonthStart: boolean }[] = []
    const d = new Date(startDate)

    while (d <= endDate) {
      const month = d.getMonth() + 1
      const day = d.getDate()
      const dateStr = dateToStr(d)
      const isWeekStart = zoomLevel === 'day' ? (d.getDay() === 1) : (d.getDate() === 1)
      const isMonthStart = zoomLevel !== 'day' ? (d.getDate() === 1) : (day === 1)

      let label: string
      if (zoomLevel === 'day') {
        label = `${month}/${day}`
      } else if (zoomLevel === 'week') {
        label = `${month}/${day}`
      } else {
        label = `${month}`
      }

      headers.push({ label, dateStr, isWeekStart, isMonthStart })
      d.setDate(d.getDate() + 1)
    }

    return {
      dateHeaders: headers,
      viewStartStr: dateToStr(startDate),
      viewEndStr: dateToStr(endDate),
    }
  }, [viewStart, zoomLevel])

  const totalWidth = dateHeaders.length * DAY_WIDTH

  // Current day highlight offset
  const currentDayOffset = useMemo(() => {
    const today = dateToStr(new Date())
    const idx = dateHeaders.findIndex(h => h.dateStr === today)
    return idx >= 0 ? idx * DAY_WIDTH : 0
  }, [dateHeaders])

  // ── Status color ──
  const statusColorMap: Record<string, string> = {
    preparation: '#FBBF24',
    in_progress: '#3B82F6',
    completed: '#10B981',
  }

  // ── Scroll helpers ──
  const handleScrollLeft = useCallback(() => {
    const daysBack = zoomLevel === 'day' ? 7 : zoomLevel === 'week' ? 14 : 30
    const newStart = addDays(viewStart, -daysBack)
    setViewStart(newStart)
    setScrollOffset(0)
  }, [viewStart, zoomLevel])

  const handleScrollRight = useCallback(() => {
    const daysForward = zoomLevel === 'day' ? 7 : zoomLevel === 'week' ? 14 : 30
    const newStart = addDays(viewStart, daysForward)
    setViewStart(newStart)
    setScrollOffset(0)
  }, [viewStart, zoomLevel])

  const handleScrollToToday = useCallback(() => {
    setViewStart(todayStr)
    setScrollOffset(0)
  }, [])

  // ── Handlers ──
  const handleDateClick = useCallback((dateStr: string) => {
    navigate(`/daily/${dateStr}`)
  }, [navigate])

  const handleProjectClick = useCallback((id: string) => {
    navigate(`/project/${id}`)
  }, [navigate])

  const handleZoomChange = useCallback((level: 'month' | 'week' | 'day') => {
    setZoomLevel(level)
    setScrollOffset(0)
    const d = new Date(viewStart)
    if (level === 'week') {
      setViewStart(snapToWeekStart(d).toISOString().split('T')[0])
    } else if (level === 'month') {
      setViewStart(snapToMonthStart(d).toISOString().split('T')[0])
    } else {
      // day view — snap to nearest 7 days from today if we haven't scrolled yet
      if (Math.abs(getDaysDiff(viewStart, todayStr)) < 7) {
        setViewStart(todayStr)
      }
    }
  }, [viewStart, todayStr])

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

  // ── Render gantt bar ──
  const renderBar = (row: GanttRow) => {
    const startMs = new Date(row.project.start_date).getTime()
    const endMs = new Date(row.project.end_date).getTime()
    const viewStartMs = new Date(viewStart).getTime()
    const viewEndMs = new Date(viewEndStr) ? new Date(viewEndStr).getTime() : viewStartMs + 90 * 86400000

    if (endMs < viewStartMs || startMs > viewEndMs) return null

    const offsetDays = Math.max(0, (startMs - viewStartMs) / 86400000)
    const barDays = Math.min((endMs - viewStartMs), (viewEndMs - viewStartMs)) / 86400000

    return (
      <foreignObject
        x={offsetDays * DAY_WIDTH + 6}
        y={14}
        width={Math.max(barDays * DAY_WIDTH - 12, 4)}
        height={ROW_HEIGHT - 18}
      >
        <div
          className={`h-full rounded flex items-center px-1.5 cursor-pointer group transition-all hover:shadow-md ${
            row.project.status === 'completed' ? 'opacity-60' : ''
          }`}
          style={{
            backgroundColor: statusColorMap[row.project.status] + 'DD',
            minWidth: '4px',
          }}
          onClick={() => handleProjectClick(row.project.id)}
          title={`${row.project.name}\n${row.project.start_date} ~ ${row.project.end_date}\n進度: ${row.project.progress}%`}
        >
          {(barDays * DAY_WIDTH - 12) > 40 && (
            <span className="text-white text-xs truncate font-medium drop-shadow">
              {row.project.name}
            </span>
          )}
        </div>
      </foreignObject>
    )
  }

  // ── Date click map for SVG cells ──
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
        {/* Toolbar: scroll controls + zoom */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            {/* Scroll buttons */}
            <button
              onClick={handleScrollLeft}
              className="p-1 text-gray-500 hover:text-blue-500 hover:bg-gray-200 rounded transition-colors"
              title="往左 scroll（往前）"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={handleScrollRight}
              className="p-1 text-gray-500 hover:text-blue-500 hover:bg-gray-200 rounded transition-colors"
              title="往右 scroll（往後）"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              onClick={handleScrollToToday}
              className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100 transition-colors"
              title="跳到今天"
            >
              今天
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">縮放:</span>
            <button
              onClick={() => handleZoomChange('day')}
              className={`px-2 py-1 text-xs rounded ${zoomLevel === 'day' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >日</button>
            <button
              onClick={() => handleZoomChange('week')}
              className={`px-2 py-1 text-xs rounded ${zoomLevel === 'week' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >週</button>
            <button
              onClick={() => handleZoomChange('month')}
              className={`px-2 py-1 text-xs rounded ${zoomLevel === 'month' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >月</button>
          </div>
        </div>

        {/* Gantt SVG */}
        <div className="overflow-x-auto">
          <svg
            width={totalWidth}
            height={Math.max(flatList.length * ROW_HEIGHT, 300)}
          >
            {/* Date header */}
            {dateHeaders.map((h, i) => {
              const xPos = i * DAY_WIDTH
              // Show month label on month-start and week-start headers
              const showMonthLabel = h.isMonthStart
              const showWeekLabel = zoomLevel === 'day' && h.isWeekStart

              return (
                <g key={i}>
                  {/* Column background with alternating weekend shading */}
                  <rect
                    x={xPos}
                    y={0}
                    width={DAY_WIDTH}
                    height={30}
                    fill={
                      ((new Date(h.dateStr).getDay() === 0 || new Date(h.dateStr).getDay() === 6)
                        ? '#f9fafb'
                        : (i % 4 === 0 ? '#fff' : 'transparent'))
                    }
                  />
                  {/* Vertical grid line */}
                  <line
                    x1={xPos}
                    y1={0}
                    x2={xPos}
                    y2={30}
                    stroke="#e5e7eb"
                    strokeWidth={h.isMonthStart ? 1.5 : 0.5}
                  />
                  {/* Month label (large, at month start) */}
                  {showMonthLabel && (
                    <text
                      x={xPos}
                      y={20}
                      textAnchor="start"
                      className="fill-blue-600"
                      fontSize="10"
                      fontWeight="bold"
                    >
                      {`${new Date(h.dateStr).toLocaleDateString('zh-TW', { year: '2-digit' })}年${new Date(h.dateStr).toLocaleDateString('zh-TW', { month: 'short' })}`}
                    </text>
                  )}
                  {/* Week label in day view */}
                  {showWeekLabel && (
                    <text
                      x={xPos}
                      y={28}
                      textAnchor="start"
                      className="fill-gray-500"
                      fontSize="8"
                    >
                      {'日一二三四五六'[new Date(h.dateStr).getDay()]}
                    </text>
                  )}
                  {/* Day number (only on month start or every week in week view) */}
                  {(h.isMonthStart || (zoomLevel === 'week' && i % 4 === 0)) && (
                    <text
                      x={xPos + DAY_WIDTH / 2}
                      y={12}
                      textAnchor="middle"
                      className="fill-gray-700"
                      fontSize="9"
                      fontWeight={zoomLevel === 'day' ? 'normal' : 'bold'}
                    >
                      {new Date(h.dateStr).getDate()}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Clickable date cells */}
            {dateClickMap.map((cell, i) => (
              <rect
                key={`click-${i}`}
                x={cell.x}
                y={0}
                width={cell.width}
                height={30}
                fill="transparent"
                onClick={() => handleDateClick(cell.dateStr)}
                className="cursor-pointer"
              />
            ))}

            {/* Today vertical line */}
            <line
              x1={currentDayOffset}
              y1={0}
              x2={currentDayOffset}
              y2={flatList.length * ROW_HEIGHT}
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="4 2"
            />

            {/* Rows */}
            {filteredList.map((row, idx) => (
              <g key={row.project.id}>
                {/* Row background */}
                <rect
                  x={0}
                  y={30 + idx * ROW_HEIGHT}
                  width={totalWidth}
                  height={ROW_HEIGHT}
                  fill={idx % 2 === 0 ? '#fff' : '#f9fafb'}
                />
                {/* Vertical grid lines */}
                {dateHeaders.map((h, di) => (
                  <line
                    key={`grid-${idx}-${di}`}
                    x1={di * DAY_WIDTH}
                    y1={30 + idx * ROW_HEIGHT}
                    x2={di * DAY_WIDTH}
                    y2={30 + (idx + 1) * ROW_HEIGHT}
                    stroke="#f3f4f6"
                    strokeWidth={0.5}
                  />
                ))}
                {/* Sidebar label */}
                <g
                  onClick={() => handleProjectClick(row.project.id)}
                  className="cursor-pointer"
                >
                  <text
                    x={SIDEBAR_WIDTH - 8}
                    y={30 + idx * ROW_HEIGHT + 24}
                    className="fill-gray-700"
                    fontSize="11"
                  >
                    {'\u00A0'.repeat(row.depth * 2)}
                    {row.depth > 0 ? '↳ ' : ''}{row.project.name}
                  </text>
                  {/* Status dot */}
                  <circle
                    cx={SIDEBAR_WIDTH - 8}
                    cy={30 + idx * ROW_HEIGHT + 6}
                    r={4}
                    fill={statusColorMap[row.project.status]}
                  />
                </g>
                {/* Gantt bar */}
                {renderBar(row)}
                {/* Delete button (appears on hover) */}
                <g
                  className="cursor-pointer"
                  opacity={0.3}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.3')}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(row.project.id)
                  }}
                >
                  <circle
                    cx={SIDEBAR_WIDTH - 8}
                    cy={30 + idx * ROW_HEIGHT + ROW_HEIGHT - 8}
                    r={6}
                    fill="none"
                    stroke="#d1d5db"
                    strokeWidth={1}
                  />
                  <text
                    x={SIDEBAR_WIDTH - 8}
                    y={30 + idx * ROW_HEIGHT + ROW_HEIGHT - 4}
                    textAnchor="middle"
                    className="fill-gray-400 hover:fill-red-500 cursor-pointer"
                    fontSize={8}
                  >
                    ×
                  </text>
                </g>
              </g>
            ))}
          </svg>
        </div>

        {/* Info bar */}
        <div className="px-4 py-2 bg-blue-50 border-t border-blue-200 text-xs text-blue-700">
          💡 直接拖拉 SVG 或按左右箭頭瀏覽時間軸 · 點擊日期進入日曆視圖 · 點擊專案進入詳細頁面
        </div>
      </div>
    </div>
  )
}

export default GanttPage
