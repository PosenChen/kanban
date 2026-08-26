import { useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjects } from '@/hooks/useProjects'
import { projectStore, setStorageSource } from '@/data/localStorageStore'
import { STATUS_CONFIG, type Project, type Milestone, type Todo, type ProjectPriority } from '@/types/project'
import { dateToStr } from '@/utils/dateUtils'

// ── Constants ──
const DAY_WIDTH = 24      // 1 day = 24px
const FROZEN_COLS = 4     // freeze left 4 date columns = 96px
const FROZEN_WIDTH = FROZEN_COLS * DAY_WIDTH  // 96px
const PARENT_ROW_HEIGHT = 24  // parent row height
const SUB_ROW_HEIGHT = 20      // sub-project row height
const MILESTONE_ROW_HEIGHT = 32
const SIDEBAR_WIDTH = FROZEN_WIDTH  // 96px
const SIDEBAR_EXPAND_BTN = 42
const HEADER_HEIGHT = 28

// Parse a YYYY-MM-DD string as a local-date midnight (not UTC)
function localDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Group projects by parent */
function buildRowGroups(projects: Project[]): { projectId: string; subProjects: Project[] }[] {
  const roots = projects.filter(p => p.parent_id === null)
  const groups: { projectId: string; subProjects: Project[] }[] = []
  for (const root of roots) {
    const subs = projects.filter(p => p.parent_id === root.id)
    groups.push({ projectId: root.id, subProjects: subs })
  }
  return groups
}

interface DayHeader {
  dateStr: string
  dayNum: number
  month: number
  isMonthStart: boolean
  dayOfWeek: number
}

function GanttPage() {
  const navigate = useNavigate()
  const { projects, add, remove } = useProjects()
  const [milestones, setMilestones] = useState<Milestone[]>(() => projectStore.getMilestones())
  const rowGroups = useMemo(() => buildRowGroups(projects), [projects])

  // ── View state ──
  const [viewStart, setViewStart] = useState(dateToStr(new Date()))

  // Update viewStart when projects/milestones load
  useEffect(() => {
    const allDates = projects.map(p => p.start_date)
    const milestoneDates = milestones.map(m => m.date)
    const all = [...allDates, ...milestoneDates]
    const firstDate = all.reduce((min, d) => (d < min ? d : min), all[0])
    setViewStart(prev => (firstDate < prev ? firstDate : prev))
  }, [projects, milestones])

  // ── Filter ──
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set())

  const toggleExpand = useCallback((parentId: string) => {
    setExpandedParents(prev => {
      const next = new Set(prev)
      next.has(parentId) ? next.delete(parentId) : next.add(parentId)
      return next
    })
  }, [])

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
    milestones.forEach(m => m.tags.forEach(t => tagSet.add(t)))
    return Array.from(tagSet).sort()
  }, [projects, milestones])

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }, [])

  const filteredMilestones = useMemo(() => {
    let list = milestones
    if (selectedTags.length > 0) {
      list = list.filter(m => m.tags.some(t => selectedTags.includes(t)))
    }
    return list
  }, [milestones, selectedTags])

  // Listen for milestone changes
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as Milestone[] | undefined
      if (detail) setMilestones([...detail])
    }
    window.addEventListener('kanban:milestone-change', handler)
    return () => window.removeEventListener('kanban:milestone-change', handler)
  }, [])

  // ── Todo state ──
  const [todos, setTodos] = useState<Todo[]>(() => projectStore.getTodos())
  const [showTodoModal, setShowTodoModal] = useState(false)
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null)
  const [todoName, setTodoName] = useState('')
  const [todoPriority, setTodoPriority] = useState<ProjectPriority>('medium')
  const [todoDesc, setTodoDesc] = useState('')

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as Todo[] | undefined
      if (detail) setTodos([...detail])
    }
    window.addEventListener('kanban:todo-change', handler)
    return () => window.removeEventListener('kanban:todo-change', handler)
  }, [])

  const openAddTodo = useCallback(() => {
    setEditingTodo(null)
    setTodoName('')
    setTodoPriority('medium')
    setTodoDesc('')
    setShowTodoModal(true)
  }, [])

  const openEditTodo = useCallback((t: Todo) => {
    setEditingTodo(t)
    setTodoName(t.name)
    setTodoPriority(t.priority)
    setTodoDesc(t.description || '')
    setShowTodoModal(true)
  }, [])

  const handleSaveTodo = useCallback(() => {
    if (!todoName.trim()) return
    if (editingTodo) {
      projectStore.updateTodo(editingTodo.id, {
        name: todoName.trim(),
        priority: todoPriority,
        description: todoDesc.trim() || undefined,
      })
    } else {
      projectStore.addTodo({
        name: todoName.trim(),
        priority: todoPriority,
        description: todoDesc.trim() || undefined,
        completed: false,
      })
    }
    setTodoName('')
    setTodoPriority('medium')
    setTodoDesc('')
    setShowTodoModal(false)
    setEditingTodo(null)
  }, [todoName, todoPriority, todoDesc, editingTodo])

  const handleToggleTodo = useCallback((id: string) => {
    const t = todos.find(t => t.id === id)
    if (t) {
      projectStore.updateTodo(id, { completed: !t.completed })
    }
  }, [todos])

  const handleDeleteTodo = useCallback((id: string) => {
    if (confirm('確定要刪除這個待辦嗎？')) {
      projectStore.removeTodo(id)
    }
  }, [])

  const handleCopyTodo = useCallback(() => {
    if (!editingTodo) return
    projectStore.addTodo({
      name: editingTodo.name + 'Q',
      priority: editingTodo.priority,
      description: editingTodo.description,
      completed: false,
    })
    setShowTodoModal(false)
    setEditingTodo(null)
  }, [editingTodo])

  // ── Activity add/edit modal ──
  const [showActivityModal, setShowActivityModal] = useState(false)
  const [editingActivity, setEditingActivity] = useState<Milestone | null>(null)
  const [activityName, setActivityName] = useState('')
  const [activityDate, setActivityDate] = useState(dateToStr(new Date()))
  const [activityTags, setActivityTags] = useState<string[]>(['活動'])
  const [activityDesc, setActivityDesc] = useState('')

  const openAddActivity = useCallback(() => {
    setEditingActivity(null)
    setActivityName('')
    setActivityDate(dateToStr(new Date()))
    setActivityTags(['活動'])
    setActivityDesc('')
    setShowActivityModal(true)
  }, [])

  const openEditActivity = useCallback((m: Milestone) => {
    setEditingActivity(m)
    setActivityName(m.name)
    setActivityDate(m.date)
    setActivityTags(m.tags || ['活動'])
    setActivityDesc(m.description || '')
    setShowActivityModal(true)
  }, [])

  const handleSaveActivity = useCallback(() => {
    if (!activityName.trim()) return
    if (editingActivity) {
      projectStore.updateMilestone(editingActivity.id, {
        name: activityName.trim(),
        date: activityDate,
        tags: activityTags,
        description: activityDesc.trim() || undefined,
      })
    } else {
      projectStore.addMilestone({
        name: activityName.trim(),
        date: activityDate,
        tags: activityTags,
        description: activityDesc.trim() || undefined,
      })
    }
    setActivityName('')
    setActivityDate(dateToStr(new Date()))
    setActivityTags(['活動'])
    setActivityDesc('')
    setShowActivityModal(false)
    setEditingActivity(null)
  }, [activityName, activityDate, activityTags, activityDesc, editingActivity])

  const handleDeleteActivity = useCallback((id: string) => {
    if (confirm('確定要刪除這個活動嗎？')) {
      projectStore.removeMilestone(id)
    }
  }, [])

  // ── View range ──
  const { dateHeaders, viewEndStr } = useMemo(() => {
    const startDate = localDate(viewStart)
    const range = 730
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + range)

    const headers: DayHeader[] = []
    const d = new Date(startDate)

    while (d <= endDate) {
      headers.push({
        dateStr: dateToStr(d),
        dayNum: d.getDate(),
        month: d.getMonth() + 1,
        isMonthStart: d.getDate() === 1,
        dayOfWeek: d.getDay(),
      })
      d.setDate(d.getDate() + 1)
    }

    return { dateHeaders: headers, viewEndStr: dateToStr(endDate) }
  }, [viewStart, projects])

  const totalWidth = dateHeaders.length * DAY_WIDTH

  // Today offset relative to viewStart (day 0 = viewStart)
  const todayOffset = useMemo(() => {
    const today = dateToStr(new Date())
    const idx = dateHeaders.findIndex(h => h.dateStr === today)
    return idx >= 0 ? idx * DAY_WIDTH : 0
  }, [dateHeaders])

  // Status colors
  const statusColorMap: Record<string, string> = {
    preparation: '#FBBF24',
    in_progress: '#3B82F6',
    completed: '#10B981',
    milestone: '#A855F7',
  }

  // Scroll helpers
  const handleScrollLeft = useCallback(() => {
    const now = localDate(viewStart)
    now.setDate(now.getDate() - 30)
    setViewStart(dateToStr(now))
  }, [viewStart])

  const handleScrollRight = useCallback(() => {
    const now = localDate(viewStart)
    now.setDate(now.getDate() + 30)
    setViewStart(dateToStr(now))
  }, [viewStart])

  const handleScrollToToday = useCallback(() => {
    const today = new Date()
    setViewStart(dateToStr(today))
  }, [])

  const handleNavigateToSettings = useCallback(() => {
    navigate('/settings')
  }, [navigate])

  // GitHub load
  const [isLoading, setIsLoading] = useState(false)
  const handleLoadFromGitHub = useCallback(async () => {
    const token = localStorage.getItem('kanban_github_token')
    if (!token || token.trim().length < 10) {
      alert('尚未設定 GitHub Token')
      return
    }
    setIsLoading(true)
    try {
      await projectStore.loadFromGitHub(token.trim())
      setStorageSource('github')
      alert('✅ 已從 GitHub 讀取最新專案資料！')
    } catch (err: unknown) {
      alert('❌ 讀取失敗：' + (err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [])

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

  // ── Build sidebar rows list (same DOM order as right SVG) ──
  const sidebarRows = useMemo(() => {
    const rows: Array<{ project: Project; isRoot: boolean; groupId: string }> = []
    for (const group of filteredGroups) {
      const rootProject = projects.find(p => p.id === group.projectId)
      if (!rootProject) continue
      const isExpanded = expandedParents.has(group.projectId)
      rows.push({ project: rootProject, isRoot: true, groupId: group.projectId })
      if (isExpanded) {
        for (const s of group.subProjects) {
          rows.push({ project: s, isRoot: false, groupId: group.projectId })
        }
      }
    }
    return rows
  }, [filteredGroups, projects, expandedParents])

  // ── Compute y-offset for each row index ──
  const totalGanttHeight = useMemo(() => {
    let height = MILESTONE_ROW_HEIGHT
    for (const group of filteredGroups) {
      height += PARENT_ROW_HEIGHT
      if (expandedParents.has(group.projectId)) {
        height += group.subProjects.length * SUB_ROW_HEIGHT
      }
    }
    return Math.max(height, 200)
  }, [filteredGroups, expandedParents])

  // Build SVG rows with y-offsets
  const svgRows = useMemo(() => {
    const rows: Array<{ project: Project; isRoot: boolean; y: number; h: number }> = []
    let y = HEADER_HEIGHT + MILESTONE_ROW_HEIGHT
    for (const group of filteredGroups) {
      const rootProject = projects.find(p => p.id === group.projectId)
      if (!rootProject) continue
      rows.push({ project: rootProject, isRoot: true, y, h: PARENT_ROW_HEIGHT })
      y += PARENT_ROW_HEIGHT
      const isExpanded = expandedParents.has(group.projectId)
      if (isExpanded) {
        for (const s of group.subProjects) {
          rows.push({ project: s, isRoot: false, y, h: SUB_ROW_HEIGHT })
          y += SUB_ROW_HEIGHT
        }
      }
    }
    return rows
  }, [filteredGroups, projects, expandedParents])

  // ── Gantt bar render helper ──
  const renderBar = (project: Project, yPos: number, rowHeight: number) => {
    const startMs = localDate(project.start_date).getTime()
    const endMs = localDate(project.end_date).getTime()
    const viewStartMs = localDate(viewStart).getTime()
    const viewEndMs = localDate(viewEndStr).getTime()

    if (endMs < viewStartMs || startMs > viewEndMs) return null

    const clampedStart = Math.max(startMs, viewStartMs)
    const clampedEnd = Math.min(endMs, viewEndMs)
    const barDays = Math.max(0, (clampedEnd - clampedStart) / 86400000)
    const offsetDays = Math.max(0, (startMs - viewStartMs) / 86400000)
    const barWidth = Math.max(barDays * DAY_WIDTH, DAY_WIDTH)
    const x = offsetDays * DAY_WIDTH
    const barY = yPos + 2
    const barH = rowHeight - 4

    return (
      <rect
        x={x}
        y={barY}
        width={barWidth}
        height={barH}
        rx={3} ry={3}
        fill={statusColorMap[project.status] || '#3B82F6'}
        onClick={() => handleProjectClick(project.id)}
        style={{ pointerEvents: 'auto', cursor: 'pointer' }}
      />
    )
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-3">
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
              <option value="waiting">等待中</option>
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
            <button
              onClick={openAddActivity}
              className="flex items-center gap-1 px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm font-medium border border-purple-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              活動
            </button>
            <button
              onClick={openAddTodo}
              className="flex items-center gap-1 px-3 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 text-sm font-medium border border-teal-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              待辦
            </button>
            <button
              onClick={handleNavigateToSettings}
              className="flex items-center gap-1 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium border border-green-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              同步
            </button>
            <button
              onClick={handleLoadFromGitHub}
              disabled={isLoading}
              className="flex items-center gap-1 px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm font-medium border border-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {isLoading ? '讀取中...' : '下載 GitHub'}
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
            <span className="flex items-center gap-1 text-xs"><span className="w-3 h-3 rounded inline-block bg-orange-400"></span>等待中</span>
            <span className="flex items-center gap-1 text-xs"><span className="w-3 h-3 rounded inline-block bg-green-500"></span>已完成</span>
          </div>
        </div>
      </div>

      {/* Gantt Chart — frozen sidebar + scrollable right */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Scroll controls bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <button onClick={handleScrollLeft} className="p-1 text-gray-500 hover:text-blue-500 hover:bg-gray-200 rounded transition-colors" title="往前">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={handleScrollRight} className="p-1 text-gray-500 hover:text-blue-500 hover:bg-gray-200 rounded transition-colors" title="往後">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
            <button onClick={handleScrollToToday} className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100 transition-colors">今天</button>
          </div>
        </div>

        {/* Main gantt area: frozen sidebar (HTML) + scrollable right (SVG) */}
        <div className="relative" style={{ height: totalGanttHeight + HEADER_HEIGHT }}>
          {/* ══════════ FROZEN LEFT SIDEBAR (HTML, never scrolls) ══════════ */}
          <div
            className="absolute left-0 top-0 bg-white overflow-hidden z-10"
            style={{ width: SIDEBAR_WIDTH, height: totalGanttHeight + HEADER_HEIGHT, borderRight: '1px solid #e5e7eb' }}
          >
            {/* Date header row — no month/day numbers, just a thin strip */}
            <div
              className="flex items-center border-b border-gray-200"
              style={{ height: HEADER_HEIGHT }}
            >
              <div className="flex-1 flex items-center px-1">
                <span className="text-[8px] text-gray-400 font-medium truncate">專案名稱</span>
              </div>
              <div className="w-[42px] flex-shrink-0"></div>
            </div>

            {/* Milestone label row */}
            <div
              className="flex items-center border-b border-purple-200"
              style={{ height: MILESTONE_ROW_HEIGHT, backgroundColor: '#faf5ff' }}
            >
              <span className="flex-1 px-1 text-[9px] text-purple-600 font-medium truncate">活動</span>
              <div className="w-[42px] flex-shrink-0"></div>
            </div>

            {/* Project name rows — each matches right SVG row pixel-by-pixel */}
            <div>
              {sidebarRows.map((row, idx) => {
                const project = row.project
                const isRoot = row.isRoot
                const rowHeight = isRoot ? PARENT_ROW_HEIGHT : SUB_ROW_HEIGHT
                const group = filteredGroups.find(g => g.projectId === row.groupId)
                const sc = group?.subProjects.length ?? 0
                const exp = expandedParents.has(row.groupId)
                const bgEven = idx % 2 === 0

                return (
                  <div
                    key={isRoot ? `root-${project.id}` : `sub-${project.id}`}
                    className="flex items-center border-b border-gray-100"
                    style={{ height: rowHeight, backgroundColor: bgEven ? '#ffffff' : '#fafafa' }}
                  >
                    {/* Project name — CSS text-overflow: ellipsis guarantees no overflow */}
                    <div
                      className="flex-1 min-w-0 truncate px-1"
                      title={project.name}
                    >
                      <span className={`text-[10px] truncate block leading-none ${
                        isRoot ? 'font-medium text-gray-800' : 'text-gray-500'
                      }`}>
                        {isRoot
                          ? project.name
                          : `↳ ${project.name}`}
                      </span>
                    </div>

                    {/* Expand / collapse button */}
                    <div className="w-[42px] flex-shrink-0 flex items-center justify-center">
                      {isRoot && sc > 0 && (
                        <span
                          className="cursor-pointer hover:brightness-110 flex items-center gap-0.5"
                          onClick={(e) => { e.stopPropagation(); toggleExpand(project.id) }}
                        >
                          <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold transition-colors ${
                            exp ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                          }`}>
                            {exp ? '▼' : '▶'}
                          </span>
                          <span className={`text-[8px] rounded-full px-1 font-bold ${
                            exp ? 'bg-blue-600 text-white' : 'bg-gray-500 text-white'
                          }`}>
                            {sc}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ══════════ SCROLLABLE RIGHT AREA (SVG) ══════════ */}
          <div className="absolute left-[96px] top-0 right-0 overflow-x-auto overflow-y-hidden">
            <svg
              width={totalWidth}
              height={totalGanttHeight + HEADER_HEIGHT}
              className="min-w-full"
            >
              {/* Date header background */}
              <rect x={0} y={0} width={totalWidth} height={HEADER_HEIGHT} fill="#f9fafb" />

              {/* Date columns */}
              {dateHeaders.map((h, i) => {
                const xPos = i * DAY_WIDTH
                const isWeekend = h.dayOfWeek === 0 || h.dayOfWeek === 6
                const bgColor = isWeekend ? '#f3f4f6' : '#fff'
                return (
                  <g key={`col-${i}`}>
                    <rect x={xPos} y={0} width={DAY_WIDTH} height={HEADER_HEIGHT} fill={bgColor} />
                    <line
                      x1={xPos} y1={0} x2={xPos} y2={HEADER_HEIGHT}
                      stroke={h.isMonthStart ? '#d1d5db' : '#e5e7eb'}
                      strokeWidth={h.isMonthStart ? 1.5 : 0.5}
                    />
                    {/* Day number centered in column */}
                    <text
                      x={xPos + DAY_WIDTH / 2}
                      y={16}
                      textAnchor="middle"
                      className="fill-gray-600"
                      fontSize="8"
                    >
                      {h.dayNum}
                    </text>
                    {/* Month label on first day of month */}
                    {h.isMonthStart && (
                      <text
                        x={xPos}
                        y={HEADER_HEIGHT - 4}
                        textAnchor="start"
                        className="fill-blue-600 font-bold"
                        fontSize="8"
                      >
                        {h.month}/{h.dayNum}
                      </text>
                    )}
                    {/* Invisible click target */}
                    <rect
                      x={xPos} y={0} width={DAY_WIDTH} height={HEADER_HEIGHT}
                      fill="transparent"
                      onClick={() => handleDateClick(h.dateStr)}
                      className="cursor-pointer"
                    />
                  </g>
                )
              })}

              {/* Today highlight */}
              <line
                x1={todayOffset} y1={HEADER_HEIGHT}
                x2={todayOffset} y2={totalGanttHeight + HEADER_HEIGHT}
                stroke="#ef4444" strokeWidth={2.5}
              />
              <rect
                x={todayOffset} y={0}
                width={DAY_WIDTH} height={totalGanttHeight + HEADER_HEIGHT}
                fill="#fef2f2" opacity={0.6}
                pointerEvents="none"
              />
              <rect
                x={todayOffset + 2} y={HEADER_HEIGHT - 2}
                width={DAY_WIDTH - 4} height={16} rx={4} fill="#ef4444"
                pointerEvents="none"
              />
              <text
                x={todayOffset + DAY_WIDTH / 2}
                y={HEADER_HEIGHT + 10}
                textAnchor="middle"
                className="fill-white font-bold"
                fontSize="8"
                pointerEvents="none"
              >
                Today
              </text>

              {/* Milestone row */}
              <rect
                x={0} y={HEADER_HEIGHT}
                width={totalWidth} height={MILESTONE_ROW_HEIGHT}
                fill="#faf5ff"
              />
              {filteredMilestones.map((m) => {
                const mIdx = dateHeaders.findIndex(h => h.dateStr === m.date)
                if (mIdx < 0) return null
                const mX = mIdx * DAY_WIDTH
                const colRight = (mIdx + 1) * DAY_WIDTH
                return (
                  <g key={`me-${m.id}`}>
                    <rect
                      x={mX} y={HEADER_HEIGHT + 6}
                      width={20} height={16} rx={4} fill="#A855F7" opacity={0.9}
                    />
                    <polygon
                      points={`${mX + 20},${HEADER_HEIGHT + 14} ${mX + 20},${HEADER_HEIGHT + 18} ${colRight},${HEADER_HEIGHT + 16}`}
                      fill="#A855F7" opacity={0.9}
                    />
                    <text
                      x={colRight + 4}
                      y={HEADER_HEIGHT + 18}
                      className="fill-gray-700 cursor-pointer hover:underline"
                      fontSize="9"
                      onClick={() => openEditActivity(m)}
                    >
                      {m.name}
                    </text>
                  </g>
                )
              })}

              {/* Project rows with bars */}
              {svgRows.map((row, idx) => {
                const project = row.project
                const barRect = renderBar(project, row.y, row.h)
                return (
                  <g key={`row-${project.id}-${idx}`}>
                    {/* Row background — clickable to open project detail */}
                    <rect
                      x={0} y={row.y}
                      width={totalWidth} height={row.h}
                      fill={idx % 2 === 0 ? '#ffffff' : '#fafafa'}
                      onClick={() => handleProjectClick(project.id)}
                      style={{ cursor: 'pointer' }}
                    />
                    {/* Gantt bar */}
                    {barRect}
                  </g>
                )
              })}
            </svg>
          </div>
        </div>

        {/* Info bar */}
        <div className="px-4 py-2 bg-blue-50 border-t border-blue-200 text-xs text-blue-700">
          💡 左右箭頭按鈕瀏覽時間軸 · 點擊日期進入日曆視圖 · 點擊專案進入詳細頁面 · 活動列在專案上方 · 左側為凍結欄
        </div>
      </div>

      {/* Todo list section */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <svg className="w-4 h-4 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            待辦事項
            {todos.length > 0 && (
              <span className="bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full text-xs">
                {todos.filter(t => !t.completed).length}/{todos.length}
              </span>
            )}
          </h2>
        </div>

        {todos.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">還沒有待辦事項，點擊上方「待辦」按鈕新增</p>
        ) : (
          <div className="space-y-2">
            {todos.map(todo => (
              <div
                key={todo.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                  todo.completed
                    ? 'bg-gray-50 border-gray-200'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <button
                  onClick={() => handleToggleTodo(todo.id)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    todo.completed
                      ? 'bg-teal-500 border-teal-500'
                      : 'border-gray-300 hover:border-teal-400'
                  }`}
                >
                  {todo.completed && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: todo.priority === 'high' ? '#ef4444' : todo.priority === 'medium' ? '#eab308' : '#9ca3af' }}
                />

                <span
                  className={`flex-1 text-sm cursor-pointer ${
                    todo.completed
                      ? 'line-through text-gray-400'
                      : 'text-gray-700 hover:text-gray-900'
                  }`}
                  onClick={() => openEditTodo(todo)}
                >
                  {todo.name}
                </span>

                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  todo.priority === 'high' ? 'text-red-600 bg-red-50' :
                  todo.priority === 'medium' ? 'text-yellow-600 bg-yellow-50' :
                  'text-gray-500 bg-gray-50'
                }`}>
                  {todo.priority === 'high' ? '高' : todo.priority === 'medium' ? '中' : '低'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/edit activity modal */}
      {showActivityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-80">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="text-purple-500">🚩</span> {editingActivity ? '編輯活動' : '新增活動'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">名稱</label>
                <input
                  type="text"
                  value={activityName}
                  onChange={e => setActivityName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="例：第一次開標"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">日期</label>
                <input
                  type="date"
                  value={activityDate}
                  onChange={e => setActivityDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">標籤（以逗號分隔，例如：招標,財務,開標）</label>
                <input
                  type="text"
                  value={activityTags.join('、')}
                  onChange={e => setActivityTags(e.target.value.split('、').map(t => t.trim()).filter(Boolean))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="例：招標、財務"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">說明 / 備註</label>
                <textarea
                  value={activityDesc}
                  onChange={e => setActivityDesc(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                  rows={3}
                  placeholder="輸入活動說明或備註（選填）"
                />
              </div>
              {editingActivity && (
                <div className="flex gap-2 pt-1 text-xs">
                  <button onClick={() => {
                    projectStore.addMilestone({
                      name: editingActivity.name + 'Q',
                      date: editingActivity.date,
                      tags: editingActivity.tags,
                      description: editingActivity.description,
                    })
                    setShowActivityModal(false)
                    setEditingActivity(null)
                  }} className="text-blue-500 hover:text-blue-700 underline">
                    複製這個活動
                  </button>
                  <button onClick={() => handleDeleteActivity(editingActivity.id)} className="text-red-500 hover:text-red-700 underline">
                    刪除這個活動
                  </button>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button onClick={() => { setShowActivityModal(false); setEditingActivity(null) }} className="flex-1 px-3 py-2 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors">
                  取消
                </button>
                <button onClick={handleSaveActivity} disabled={!activityName.trim()} className="flex-1 px-3 py-2 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  {editingActivity ? '儲存' : '新增'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/edit todo modal */}
      {showTodoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-80">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="text-teal-500">✅</span> {editingTodo ? '編輯待辦' : '新增待辦'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">名稱</label>
                <input
                  type="text"
                  value={todoName}
                  onChange={e => setTodoName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="輸入待辦名稱"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">優先級</label>
                <select
                  value={todoPriority}
                  onChange={e => setTodoPriority(e.target.value as ProjectPriority)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="high">高</option>
                  <option value="medium">中</option>
                  <option value="low">低</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">說明 / 備註</label>
                <textarea
                  value={todoDesc}
                  onChange={e => setTodoDesc(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                  rows={3}
                  placeholder="輸入待辦說明或備註（選填）"
                />
              </div>
              {editingTodo && (
                <div className="flex gap-2 pt-1 text-xs">
                  <button onClick={handleCopyTodo} className="text-blue-500 hover:text-blue-700 underline">
                    複製這個待辦
                  </button>
                  <button onClick={() => handleDeleteTodo(editingTodo.id)} className="text-red-500 hover:text-red-700 underline">
                    刪除這個待辦
                  </button>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button onClick={() => { setShowTodoModal(false); setEditingTodo(null) }} className="flex-1 px-3 py-2 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors">
                  取消
                </button>
                <button onClick={handleSaveTodo} disabled={!todoName.trim()} className="flex-1 px-3 py-2 text-sm bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  {editingTodo ? '儲存' : '新增'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GanttPage
