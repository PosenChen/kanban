import { useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjects } from '@/hooks/useProjects'
import { STATUS_CONFIG, PRIORITY_CONFIG, type Project, type ProjectStatus } from '@/types/project'
import { dateToStr, addDays, getDaysDiff } from '@/utils/dateUtils'

// ── Constants ──
const DATE_COL_WIDTH = 24 // narrow enough for "31" (2 digits)
const DAY_WIDTH = 24      // 1 day = 24px
const ROW_HEIGHT = 48
const ROW_MIN_HEIGHT = 48 // min height per sub-project group
const SUBROW_HEIGHT = 20  // height per sub-project within a group
const SIDEBAR_WIDTH = 200

// ── Helpers ──

/** Group projects by parent: root projects get their own row; sub-projects share a row group */
function buildRowGroups(projects: Project[]): { projectId: string; subProjects: Project[] }[] {
  const roots = projects.filter(p => p.parent_id === null)
  const groups: { projectId: string; subProjects: Project[] }[] = []
  for (const root of roots) {
    const subs = projects.filter(p => p.parent_id === root.id)
    groups.push({ projectId: root.id, subProjects: subs })
  }
  return groups
}

/** Get all project IDs that are milestones */
function milestoneIds(projects: Project[]): Set<string> {
  return new Set(projects.filter(p => p.status === 'milestone').map(p => p.id))
}

interface DayHeader {
  dateStr: string
  dayNum: number
  month: number
  year: number
  isMonthStart: boolean
  isWeekStart: boolean
  dayOfWeek: number // 0=Sun, 6=Sat
}

function GanttPage() {
  const navigate = useNavigate()
  const { projects, add, remove } = useProjects()
  const rowGroups = useMemo(() => buildRowGroups(projects), [projects])
  const mileIdSet = useMemo(() => milestoneIds(projects), [projects])

  // ── View state ──
  const todayStr = dateToStr(new Date())
  const [zoomLevel, setZoomLevel] = useState<'month' | 'week' | 'day'>('day')
  const [viewStart, setViewStart] = useState(() => {
    const firstDate = projects.length
      ? projects.reduce((min, p) => p.start_date < min ? p.start_date : min, projects[0].start_date)
      : todayStr
    return firstDate
  })
  const [scrollOffset, setScrollOffset] = useState(0)

  // ── Filter ──
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set())

  // ── Filtering ──
  const filteredList = useMemo(() => {
    let list = projects
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
      )
    }
    if (statusFilter) list = list.filter(p => p.status === statusFilter)
    if (priorityFilter) list = list.filter(p => p.priority === priorityFilter)
    if (selectedTags.length > 0) list = list.filter(p => p.tags.some(t => selectedTags.includes(t)))
    return list
  }, [projects, searchQuery, statusFilter, priorityFilter, selectedTags])

  // Build row groups from filtered projects
  const filteredGroups = useMemo(() => {
    const filteredIds = new Set(filteredList.map(p => p.id))
    const filteredRoots = filteredList.filter(p => p.parent_id === null && filteredIds.has(p.id))
    const groups: { projectId: string; subProjects: Project[] }[] = []
    for (const root of filteredRoots) {
      const subs = filteredList.filter(p => p.parent_id === root.id)
      groups.push({ projectId: root.id, subProjects: subs })
    }
    return groups
  }, [filteredList])

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

  // ── View range ──
  const { dateHeaders, viewEndStr } = useMemo(() => {
    const startDate = new Date(viewStart)
    startDate.setHours(0, 0, 0, 0)
    // Show enough days for scrolling
    const range = 730 // 2 years
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + range)

    const headers: DayHeader[] = []
    const d = new Date(startDate)

    while (d <= endDate) {
      const ds = dateToStr(d)
      headers.push({
        dateStr: ds,
        dayNum: d.getDate(),
        month: d.getMonth() + 1,
        year: d.getFullYear(),
        isMonthStart: d.getDate() === 1,
        isWeekStart: d.getDay() === 1,
        dayOfWeek: d.getDay(),
      })
      d.setDate(d.getDate() + 1)
    }

    return {
      dateHeaders: headers,
      viewEndStr: dateToStr(endDate),
    }
  }, [viewStart])

  const totalWidth = dateHeaders.length * DAY_WIDTH

  // Today offset
  const todayOffset = useMemo(() => {
    const idx = dateHeaders.findIndex(h => h.dateStr === todayStr)
    return idx >= 0 ? idx * DAY_WIDTH : 0
  }, [dateHeaders])

  // ── Status color ──
  const statusColorMap: Record<string, string> = {
    preparation: '#FBBF24',
    in_progress: '#3B82F6',
    completed: '#10B981',
    milestone: '#A855F7', // purple
  }

  // ── Scroll helpers ──
  const handleScrollLeft = useCallback(() => {
    const daysBack = 30
    setViewStart(addDays(viewStart, -daysBack))
    setScrollOffset(0)
  }, [viewStart])

  const handleScrollRight = useCallback(() => {
    const daysForward = 30
    setViewStart(addDays(viewStart, daysForward))
    setScrollOffset(0)
  }, [viewStart])

  const handleScrollToToday = useCallback(() => {
    setViewStart(todayStr)
    setScrollOffset(0)
  }, [])

  const handleZoomChange = useCallback((level: 'month' | 'week' | 'day') => {
    setZoomLevel(level)
    setScrollOffset(0)
  }, [])

  // ── Handlers ──
  const handleDateClick = useCallback((dateStr: string) => {
    navigate(`/daily/${dateStr}`)
  }, [navigate])

  const handleProjectClick = useCallback((id: string) => {
    navigate(`/project/${id}`)
  }, [navigate])

  const handleAdd = useCallback(() => {
    const now = new Date().toISOString().split('T')[0]
    add({
      name: '新專案',
      description: '',
      parent_id: null,
      start_date: now,
      end_date: dateToStr(new Date(new Date(now).getTime() + 7 * 86400000)),
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

  // ── Render a single gantt bar ──
  const renderBar = (project: Project, yPos: number, groupHeight: number, barHeight: number) => {
    const startMs = new Date(project.start_date).getTime()
    const endMs = new Date(project.end_date).getTime()
    const viewStartMs = new Date(viewStart).getTime()
    const viewEndMs = new Date(viewEndStr).getTime()

    if (endMs < viewStartMs || startMs > viewEndMs) return null

    const offsetDays = Math.max(0, (startMs - viewStartMs) / 86400000)
    const barDays = Math.min((endMs - viewStartMs), (viewEndMs - viewStartMs)) / 86400000
    const barWidth = Math.max(barDays * DAY_WIDTH, DAY_WIDTH) // at least 1 day width
    const x = offsetDays * DAY_WIDTH

    // Milestone is a single point — show as an arrow (L-shape)
    if (project.status === 'milestone') {
      return (
        <g key={`bar-${project.id}`}>
          {/* Arrow symbol (right-angle) at the milestone date */}
          <path
            d={`M ${x} ${yPos + 4} L ${x} ${yPos + barHeight - 2} L ${x + 8} ${yPos + barHeight - 2}`}
            fill="none"
            stroke={statusColorMap[project.status] || '#A855F7'}
            strokeWidth={2}
          />
          {/* Tooltip */}
          <foreignObject x={x + 10} y={yPos} width={160} height={barHeight}>
            <div className="text-xs text-gray-600 truncate">
              {project.name}
            </div>
          </foreignObject>
        </g>
      )
    }

    // Regular bar
    return (
      <rect
        key={`bar-${project.id}`}
        x={x}
        y={yPos + 2}
        width={barWidth}
        height={barHeight - 4}
        rx={3}
        ry={3}
        fill={statusColorMap[project.status] || '#3B82F6'}
        className="cursor-pointer hover:opacity-90 transition-opacity"
        onClick={() => handleProjectClick(project.id)}
      />
    )
  }

  // ── Render date headers ──
  const renderDateHeaders = (headerHeight: number) => (
    <g>
      {/* Background */}
      <rect x={0} y={0} width={totalWidth} height={headerHeight} fill="#f9fafb" />

      {dateHeaders.map((h, i) => {
        const xPos = i * DAY_WIDTH
        const isWeekend = h.dayOfWeek === 0 || h.dayOfWeek === 6

        return (
          <g key={i}>
            {/* Column background */}
            <rect
              x={xPos}
              y={0}
              width={DAY_WIDTH}
              height={headerHeight}
              fill={isWeekend ? '#f3f4f6' : (i % 2 === 0 ? '#fff' : 'transparent')}
            />

            {/* Vertical grid line */}
            <line
              x1={xPos}
              y1={0}
              x2={xPos}
              y2={headerHeight}
              stroke={h.isMonthStart ? '#d1d5db' : '#e5e7eb'}
              strokeWidth={h.isMonthStart ? 1.5 : 0.5}
            />

            {/* Month label (first day of month) */}
            {h.isMonthStart && (
              <text
                x={xPos}
                y={headerHeight - 6}
                textAnchor="start"
                className="fill-blue-600 font-bold"
                fontSize="9"
              >
                {h.month}月
              </text>
            )}

            {/* Day number on month start (larger) */}
            {h.isMonthStart && (
              <text
                x={xPos + DAY_WIDTH / 2}
                y={12}
                textAnchor="middle"
                className="fill-gray-800 font-bold"
                fontSize="10"
              >
                {h.dayNum}
              </text>
            )}

            {/* Week start label in day view */}
            {zoomLevel === 'day' && h.isWeekStart && (
              <text
                x={xPos}
                y={headerHeight - 14}
                textAnchor="start"
                className="fill-gray-500"
                fontSize="8"
              >
                {'一二三四五六日'[h.dayOfWeek]}
              </text>
            )}

            {/* Day number for all days in day view (small) */}
            {zoomLevel === 'day' && !h.isMonthStart && (
              <text
                x={xPos + DAY_WIDTH / 2}
                y={14}
                textAnchor="middle"
                className="fill-gray-600"
                fontSize="8"
              >
                {h.dayNum}
              </text>
            )}

            {/* Day number in week/month view (only on month start) */}
            {zoomLevel !== 'day' && h.isMonthStart && (
              <text
                x={xPos + DAY_WIDTH / 2}
                y={headerHeight - 6}
                textAnchor="end"
                className="fill-gray-400"
                fontSize="7"
              >
                {h.dayNum}
              </text>
            )}

            {/* Week label (every 7 days in day view, labeled by weekday) */}
            {zoomLevel === 'day' && h.isWeekStart && (
              <text
                x={xPos + DAY_WIDTH / 2}
                y={10}
                textAnchor="middle"
                className="fill-gray-500"
                fontSize="7"
              >
                {'一二三四五六日'[h.dayOfWeek]}
              </text>
            )}
          </g>
        )
      })}

      {/* Clickable date cells */}
      {dateHeaders.map((h, i) => (
        <rect
          key={`click-${i}`}
          x={i * DAY_WIDTH}
          y={0}
          width={DAY_WIDTH}
          height={headerHeight}
          fill="transparent"
          onClick={() => handleDateClick(h.dateStr)}
          className="cursor-pointer"
        />
      ))}

      {/* Today vertical line */}
      <line
        x1={todayOffset}
        y1={headerHeight}
        x2={todayOffset}
        y2={rowGroups.length * ROW_MIN_HEIGHT + headerHeight}
        stroke="#ef4444"
        strokeWidth={1.5}
        strokeDasharray="4 2"
      />
    </g>
  )

  const headerHeight = 28

  // ── Calculate total rows ──
  // Each root project gets its own row (ROW_MIN_HEIGHT tall)
  // Sub-projects within the same root share the same row area with subrows
  const totalRows = filteredGroups.length
  const totalGanttHeight = Math.max(totalRows * ROW_MIN_HEIGHT, 200)

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
              <option value="milestone">里程碑</option>
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
            <span className="flex items-center gap-1 text-xs"><span className="w-3 h-3 rounded inline-block bg-purple-500"></span>里程碑</span>
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
              title="往前（左）"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={handleScrollRight}
              className="p-1 text-gray-500 hover:text-blue-500 hover:bg-gray-200 rounded transition-colors"
              title="往後（右）"
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
            height={totalGanttHeight + headerHeight}
          >
            {/* Date headers */}
            {renderDateHeaders(headerHeight)}

            {/* Root project rows */}
            {filteredGroups.map((group, rowIdx) => {
              const rootProject = projects.find(p => p.id === group.projectId)
              if (!rootProject) return null
              const yPos = headerHeight + rowIdx * ROW_MIN_HEIGHT

              // Sub-project count (excluding root)
              const subCount = group.subProjects.length

              return (
                <g key={group.projectId}>
                  {/* Row background */}
                  <rect
                    x={0}
                    y={yPos}
                    width={totalWidth}
                    height={ROW_MIN_HEIGHT}
                    fill={rowIdx % 2 === 0 ? '#fff' : '#f9fafb'}
                  />

                  {/* Sidebar label (root project name) */}
                  <g
                    onClick={() => handleProjectClick(group.projectId)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={0}
                      y={yPos}
                      width={SIDEBAR_WIDTH}
                      height={ROW_MIN_HEIGHT}
                      fill="transparent"
                    />
                    {/* Root project row indicator (left border) */}
                    <rect
                      x={0}
                      y={yPos}
                      width={2}
                      height={ROW_MIN_HEIGHT}
                      fill={rowIdx % 2 === 0 ? '#3B82F6' : '#10B981'}
                    />
                    <text
                      x={6}
                      y={yPos + ROW_MIN_HEIGHT / 2 + 4}
                      className="fill-gray-800 font-medium"
                      fontSize="12"
                    >
                      {rootProject.name}
                    </text>
                    {/* Status dot */}
                    <circle
                      cx={SIDEBAR_WIDTH - 10}
                      cy={yPos + 10}
                      r={4}
                      fill={statusColorMap[rootProject.status] || '#3B82F6'}
                    />
                    {/* Delete button */}
                    <g
                      className="cursor-pointer"
                      opacity={0.3}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.3')}
                      onClick={(e) => { e.stopPropagation(); handleDelete(rootProject.id) }}
                    >
                      <circle
                        cx={SIDEBAR_WIDTH - 10}
                        cy={yPos + ROW_MIN_HEIGHT - 8}
                        r={6}
                        fill="none"
                        stroke="#d1d5db"
                        strokeWidth={1}
                      />
                      <text
                        x={SIDEBAR_WIDTH - 10}
                        y={yPos + ROW_MIN_HEIGHT - 4}
                        textAnchor="middle"
                        className="fill-gray-400 hover:fill-red-500 cursor-pointer"
                        fontSize={8}
                      >
                        ×
                      </text>
                    </g>
                  </g>

                  {/* Sub-project rows (if any) */}
                  {subCount > 0 && (() => {
                    // Calculate the sub-area within this root row
                    const subAreaTop = yPos + 4
                    const subAreaBottom = yPos + ROW_MIN_HEIGHT - 4
                    const subAreaHeight = subAreaBottom - subAreaTop
                    const subRowH = Math.min(SUBROW_HEIGHT, subAreaHeight / subCount)
                    const totalSubHeight = subRowH * subCount

                    // For each sub-project, compute its y position
                    const subBars: React.ReactNode[] = []
                    for (let i = 0; i < group.subProjects.length; i++) {
                      const sub = group.subProjects[i]
                      const subY = subAreaTop + i * subRowH

                      // Sub-project name label
                      subBars.push(
                        <text
                          key={`sublabel-${sub.id}`}
                          x={SIDEBAR_WIDTH + 4}
                          y={subY + subRowH / 2 + 3}
                          className="fill-gray-600"
                          fontSize="10"
                        >
                          ↳ {sub.name}
                        </text>
                      )

                      // Sub-project bar
                      subBars.push(
                        renderBar(sub, subY, subRowH, Math.max(subRowH - 2, 8))
                      )
                    }

                    return (
                      <g key={`subs-${group.projectId}`}>
                        {/* Sub-project area background */}
                        <rect
                          x={SIDEBAR_WIDTH}
                          y={subAreaTop}
                          width={totalWidth - SIDEBAR_WIDTH}
                          height={totalSubHeight}
                          fill="#f9fafb"
                        />
                        {/* Sub-project horizontal dividers */}
                        {group.subProjects.map((_, i) => (
                          <line
                            key={`divider-${i}`}
                            x1={SIDEBAR_WIDTH}
                            y1={subAreaTop + i * subRowH + subRowH}
                            x2={totalWidth}
                            y2={subAreaTop + i * subRowH + subRowH}
                            stroke="#e5e7eb"
                            strokeWidth={0.5}
                          />
                        ))}
                        {subBars}
                      </g>
                    )
                  })()}

                  {/* Root project bar */}
                  {renderBar(rootProject, yPos + 6, ROW_MIN_HEIGHT - 12, ROW_MIN_HEIGHT - 16)}
                </g>
              )
            })}
          </svg>
        </div>

        {/* Info bar */}
        <div className="px-4 py-2 bg-blue-50 border-t border-blue-200 text-xs text-blue-700">
          💡 箭頭左右按鈕瀏覽時間軸 · 點擊日期進入日曆視圖 · 點擊專案進入詳細頁面 · 紫色箭頭 = 里程碑
        </div>
      </div>
    </div>
  )
}

export default GanttPage
