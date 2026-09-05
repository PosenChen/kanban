import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useProjects } from '@/hooks/useProjects'
import { projectStore, setStorageSource } from '@/data/localStorageStore'
import { STATUS_CONFIG, QUICK_TAGS, WEEKDAY_LABELS, type Project, type Milestone, type Todo, type ProjectPriority, type Routine } from '@/types/project'
import { dateToStr } from '@/utils/dateUtils'
import { getActiveRoutines, isDoneToday, todayStr } from '@/utils/routineUtils'
import { nextIdAfter } from '@/utils/reorderUtils'
import { useDragReorder } from '@/hooks/useDragReorder'
import { useTheme } from '@/utils/theme'
import ProjectForm from '@/components/ProjectForm'

// ── Constants ──
const DAY_WIDTH = 24      // 1 day = 24px
const FROZEN_COLS = 4     // freeze left 4 date columns = 96px
const FROZEN_WIDTH = FROZEN_COLS * DAY_WIDTH  // 96px
const PARENT_ROW_HEIGHT = 24  // parent row height
const SUB_ROW_HEIGHT = 18      // sub-project row height (20 - 2)
const MILESTONE_ROW_HEIGHT = 32
const SIDEBAR_WIDTH = FROZEN_WIDTH  // 96px
const SIDEBAR_EXPAND_BTN = 42
const HEADER_HEIGHT = 28

// Priority → bar saturation ladder. Legend swatches read the SAME values
// (legend = ground truth). high keeps the status color untouched; medium is
// slightly grayer; low is clearly gray. Lightness compensates with S so bars
// never glow pale-gray in dark mode.
const PRIORITY_SATURATIONS: Record<ProjectPriority, number> = { high: 100, medium: 72, low: 45 }
const LEGEND_SATURATIONS = [PRIORITY_SATURATIONS.high, PRIORITY_SATURATIONS.medium, PRIORITY_SATURATIONS.low]

// Parse a YYYY-MM-DD string as a local-date midnight (not UTC)
function localDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Convert #RRGGBB → [h, s, l] (each %). */
function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0, s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0))
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)]
}

/** Desaturate a status color (S = target saturation %). Used for BOTH legend
 *  swatches and (via PRIORITY_SATURATIONS) bar fills — legend = ground truth. */
function desaturate(hexColor: string, s: number, dark: boolean): string {
  if (s >= 100) return hexColor
  const [h, , l0] = hexToHsl(hexColor)
  // dark: clamp 52 so bars don't glow pale; light: clamp 54 so white bar labels stay legible
  const lightness = Math.round(
    dark ? Math.min(52, l0 * Math.sqrt(s / 100)) : Math.min(54, 50 + (100 - s) * 0.045)
  )
  return `hsl(${h}, ${s}%, ${lightness}%)`
}

// ── Drag-to-edit dates helpers ──
const addDays = (dateStr: string, n: number): string =>
  dateToStr(new Date(localDate(dateStr).getTime() + n * 86400000))

/** pointer clientX → fractional day index in SVG scroll space */
function pxToDay(clientX: number, svgRect: DOMRect, scrollLeft: number): number {
  return (clientX - svgRect.left + scrollLeft) / DAY_WIDTH
}

type DragKind = 'move' | 'resize-l' | 'resize-r'
interface DragState {
  kind: DragKind
  target: 'project' | 'milestone'
  id: string
  origX: number; origW: number
  newX: number; newW: number
  barY: number; barH: number      // ghost geometry passthrough
  grabbedDay: number
  moved: boolean                   // crossed 4px threshold → suppress trailing click
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
  isToday: boolean
}

function GanttPage() {
  const [theme] = useTheme()
  const dk = theme === 'dark'
  const navigate = useNavigate()
  const { projects, add, update, remove, moveProjectUp, moveProjectDown } = useProjects()
  const [milestones, setMilestones] = useState<Milestone[]>(() => projectStore.getMilestones())

  const rowGroups = useMemo(() => buildRowGroups(projects), [projects])

  // ── View state ──
  // 預設視窗自「今日 - 6 日」起：手機（約可見 11 日欄）也能同日看見今日與整週過往
  const [viewStart, setViewStart] = useState(() => addDays(dateToStr(new Date()), -6))

  // ── Filter ──
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  // Persisted in localStorage so the tree stays expanded across pages/reloads
  const [expandedParents, setExpandedParents] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('kanban_expanded')
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
    } catch {
      return new Set()
    }
  })
  const [justCopiedParentId, setJustCopiedParentId] = useState<string | null>(null)

  // Auto-expand newly copied parent so children are visible
  useEffect(() => {
    if (justCopiedParentId) {
      setExpandedParents(prev => new Set([...prev, justCopiedParentId]))
      setJustCopiedParentId(null)
    }
  }, [justCopiedParentId])

  // Listen for copy event from ProjectDetailPage
  useEffect(() => {
    const handler = (e: Event) => {
      const parentId = (e as CustomEvent).detail as string
      setJustCopiedParentId(parentId)
    }
    window.addEventListener('kanban:project-copied', handler)
    return () => window.removeEventListener('kanban:project-copied', handler)
  }, [])

  const toggleExpand = useCallback((parentId: string) => {
    setExpandedParents(prev => {
      const next = new Set(prev)
      next.has(parentId) ? next.delete(parentId) : next.add(parentId)
      try { localStorage.setItem('kanban_expanded', JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }, [])

  // ── Project reorder handlers ──
  const handleMoveProjectUp = useCallback((parentId: string | null, projectId: string) => {
    moveProjectUp(parentId, projectId)
  }, [moveProjectUp])

  const handleMoveProjectDown = useCallback((parentId: string | null, projectId: string) => {
    moveProjectDown(parentId, projectId)
  }, [moveProjectDown])

  // ── 拖曳排序：側欄專案（限同 parent_id 群組）──
  const projDnd = useDragReorder(({ draggedId, beforeId }) => {
    const dragged = projects.find(p => p.id === draggedId)
    if (!dragged) return
    projectStore.moveProjectToSlot(dragged.parent_id ?? null, draggedId, beforeId)
  })

  // ── Todo reorder handlers ──
  const handleMoveTodoUp = useCallback((todoId: string) => {
    projectStore.moveTodoUp(todoId)
    setTodos([...projectStore.getTodos()])
  }, [])

  const handleMoveTodoDown = useCallback((todoId: string) => {
    projectStore.moveTodoDown(todoId)
    setTodos([...projectStore.getTodos()])
  }, [])

  // ── 拖曳排序：待辦清單（單一群組）──
  const todoDnd = useDragReorder(({ draggedId, beforeId }) => {
    projectStore.moveTodoToSlot(draggedId, beforeId)
    setTodos([...projectStore.getTodos()])
  })

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

  const buildGroups = (list: typeof filteredList) => {
    const filteredIds = new Set(list.map(p => p.id))
    const filteredRoots = list.filter(p => p.parent_id === null && filteredIds.has(p.id))
    // Sort root projects by sort_order ascending
    filteredRoots.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const groups: { projectId: string; subProjects: typeof filteredList }[] = []
    for (const root of filteredRoots) {
      const subs = list.filter(p => p.parent_id === root.id)
      // Sort sub-projects by sort_order ascending
      subs.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      groups.push({ projectId: root.id, subProjects: subs })
    }
    return groups
  }

  const filteredGroups = useMemo(() => buildGroups(filteredList), [filteredList])

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

  // ── Routine (流水帳) state ──
  const [showRoutineModal, setShowRoutineModal] = useState(false)
  const [routineEditMode, setRoutineEditMode] = useState(false)
  const [showRoutineForm, setShowRoutineForm] = useState(false)
  const [routines, setRoutines] = useState<Routine[]>(() => projectStore.getRoutines())
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null)
  const [rName, setRName] = useState('')
  const [rWeekdays, setRWeekdays] = useState<number[]>([])
  const [rMonthDays, setRMonthDays] = useState('')
  const [rTags, setRTags] = useState<string[]>([])
  const [rCustomTag, setRCustomTag] = useState('')

  const today = todayStr()

  // 今日進行中活動的標籤集合（供流水帳標籤條件比對）
  const todayTags = useMemo(() => {
    const s = new Set<string>()
    milestones.forEach(m => {
      if (m.start_date <= today && (m.end_date || m.start_date) >= today) m.tags.forEach(t => s.add(t))
    })
    return s
  }, [milestones, today])

  const activeRoutines = useMemo(
    () => getActiveRoutines(routines, new Date(), todayTags),
    [routines, todayTags],
  )

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as Routine[] | undefined
      if (detail) setRoutines([...detail])
    }
    window.addEventListener('kanban:routine-change', handler)
    return () => window.removeEventListener('kanban:routine-change', handler)
  }, [])

  const openRoutineModal = useCallback(() => {
    setRoutineEditMode(false)
    setEditingRoutine(null)
    setShowRoutineForm(false)
    setRoutines(projectStore.getRoutines())
    setShowRoutineModal(true)
  }, [])

  const openAddRoutine = useCallback(() => {
    setEditingRoutine(null)
    setRName(''); setRWeekdays([]); setRMonthDays(''); setRTags([]); setRCustomTag('')
    setShowRoutineForm(true)
  }, [])

  const openEditRoutine = useCallback((r: Routine) => {
    setEditingRoutine(r)
    setRName(r.name)
    setRWeekdays([...r.weekdays])
    setRMonthDays(r.monthDays.join(','))
    setRTags([...r.tags])
    setRCustomTag('')
  }, [])

  const addCustomRTag = useCallback(() => {
    const t = rCustomTag.trim()
    if (t && !rTags.includes(t)) setRTags(prev => [...prev, t])
    setRCustomTag('')
  }, [rCustomTag, rTags])

  const saveRoutine = useCallback(() => {
    if (!rName.trim()) return
    const monthDays = rMonthDays.split(/[,，]/).map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n >= 1 && n <= 31)
    const payload = { name: rName.trim(), weekdays: [...rWeekdays].sort((a, b) => a - b), monthDays: [...new Set(monthDays)].sort((a, b) => a - b), tags: rTags }
    if (editingRoutine) projectStore.updateRoutine(editingRoutine.id, payload)
    else projectStore.addRoutine(payload)
    setEditingRoutine(null); setRName(''); setRWeekdays([]); setRMonthDays(''); setRTags([]); setRCustomTag('')
    setShowRoutineForm(false)
  }, [rName, rWeekdays, rMonthDays, rTags, editingRoutine])

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

  // Sorted todos by sort_order ascending
  const sortedTodos = useMemo(() => {
    return [...todos].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  }, [todos])

  // Todos respect the same priority filter as the Gantt projects
  const visibleTodos = useMemo(() => {
    return priorityFilter ? sortedTodos.filter(t => t.priority === priorityFilter) : sortedTodos
  }, [sortedTodos, priorityFilter])

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

  // ── Drag-to-edit dates ──
  const [drag, setDrag] = useState<DragState | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const suppressClickRef = useRef(false)

  const startDrag = useCallback((e: React.PointerEvent, opts: { kind: DragKind; target: 'project' | 'milestone'; id: string; x: number; w: number; y: number; h: number }) => {
    if (e.button !== 0) return
    e.stopPropagation()
    try { (e.currentTarget as Element).setPointerCapture?.(e.pointerId) } catch { /* pointer may be stale — drag still works via svg handlers */ }
    const svg = svgRef.current, sc = scrollRef.current
    const grabbedDay = svg && sc ? pxToDay(e.clientX, svg.getBoundingClientRect(), sc.scrollLeft) : 0
    setDrag({ kind: opts.kind, target: opts.target, id: opts.id, origX: opts.x, origW: opts.w, newX: opts.x, newW: opts.w, barY: opts.y, barH: opts.h, grabbedDay, moved: false })
  }, [])

  // totalWidth mirror for handler clamps (handlers are stable; view range changes)
  const totalWidthRef = useRef(0)

  const onSvgPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag) return
    const svg = svgRef.current, sc = scrollRef.current
    if (!svg || !sc) return
    const day = pxToDay(e.clientX, svg.getBoundingClientRect(), sc.scrollLeft)
    const rawDelta = (day - drag.grabbedDay) * DAY_WIDTH
    const delta = Math.round(rawDelta / DAY_WIDTH) * DAY_WIDTH
    if (!drag.moved && Math.abs(rawDelta) < 4) return
    let newX = drag.newX, newW = drag.newW
    if (drag.kind === 'move') newX = Math.min(Math.max(0, drag.origX + delta), totalWidthRef.current - drag.origW)
    else if (drag.kind === 'resize-l') {
      newX = Math.min(Math.max(0, drag.origX + delta), drag.origX + drag.origW - DAY_WIDTH)
      newW = drag.origW + (drag.origX - newX)
    } else {
      newW = Math.min(Math.max(DAY_WIDTH, drag.origW + delta), totalWidthRef.current - drag.origX)
    }
    if (newX !== drag.newX || newW !== drag.newW || drag.moved) setDrag({ ...drag, newX, newW, moved: true })
  }, [drag])

  const onSvgPointerUp = useCallback(() => {
    if (!drag) return
    if (drag.moved) {
      const s = addDays(viewStart, Math.round(drag.newX / DAY_WIDTH))
      const en = addDays(viewStart, Math.round((drag.newX + drag.newW) / DAY_WIDTH) - 1)
      if (drag.target === 'project') update(drag.id, { start_date: s, end_date: en })
      else projectStore.updateMilestone(drag.id, { start_date: s, end_date: en })
      suppressClickRef.current = true
    }
    setDrag(null)
  }, [drag, viewStart, update])

  // ── Activity add/edit modal ──
  const [showProjectForm, setShowProjectForm] = useState(false)
  const rootProjects = useMemo(() => projects.filter(p => p.parent_id === null), [projects])
  const [showActivityModal, setShowActivityModal] = useState(false)
  const [editingActivity, setEditingActivity] = useState<Milestone | null>(null)
  const [activityName, setActivityName] = useState('')
  const [activityStartDate, setActivityStartDate] = useState(dateToStr(new Date()))
  const [activityEndDate, setActivityEndDate] = useState(dateToStr(new Date()))
  const [activityTags, setActivityTags] = useState<string[]>([])
  const [activityDesc, setActivityDesc] = useState('')

  const openAddActivity = useCallback(() => {
    setEditingActivity(null)
    setActivityName('')
    const today = dateToStr(new Date())
    setActivityStartDate(today)
    setActivityEndDate(today)
    setActivityTags([])
    setActivityDesc('')
    setShowActivityModal(true)
  }, [])

  const openEditActivity = useCallback((m: Milestone) => {
    if (suppressClickRef.current) { suppressClickRef.current = false; return }
    setEditingActivity(m)
    setActivityName(m.name)
    setActivityStartDate(m.start_date)
    setActivityEndDate(m.end_date || m.start_date)
    setActivityTags(m.tags || [])
    setActivityDesc(m.description || '')
    setShowActivityModal(true)
  }, [])

  const handleSaveActivity = useCallback(() => {
    if (!activityName.trim()) return
    const start = activityStartDate || dateToStr(new Date())
    const end = activityEndDate || start
    if (editingActivity) {
      projectStore.updateMilestone(editingActivity.id, {
        name: activityName.trim(),
        start_date: start,
        end_date: end,
        tags: activityTags,
        description: activityDesc.trim() || undefined,
      })
    } else {
      projectStore.addMilestone({
        name: activityName.trim(),
        start_date: start,
        end_date: end,
        tags: activityTags,
        description: activityDesc.trim() || undefined,
      })
    }
    setActivityName('')
    const today = dateToStr(new Date())
    setActivityStartDate(today)
    setActivityEndDate(today)
    setActivityTags([])
    setActivityDesc('')
    setShowActivityModal(false)
    setEditingActivity(null)
  }, [activityName, activityStartDate, activityEndDate, activityTags, activityDesc, editingActivity])

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
    const today = dateToStr(new Date())

    while (d <= endDate) {
      headers.push({
        dateStr: dateToStr(d),
        dayNum: d.getDate(),
        month: d.getMonth() + 1,
        isMonthStart: d.getDate() === 1,
        dayOfWeek: d.getDay(),
        isToday: dateToStr(d) === today,
      })
      d.setDate(d.getDate() + 1)
    }

    return { dateHeaders: headers, viewEndStr: dateToStr(endDate) }
  }, [viewStart, projects])

  const totalWidth = dateHeaders.length * DAY_WIDTH
  totalWidthRef.current = totalWidth

  // Today offset relative to viewStart (day 0 = viewStart)
  const todayOffset = useMemo(() => {
    const today = dateToStr(new Date())
    const idx = dateHeaders.findIndex(h => h.dateStr === today)
    return idx >= 0 ? idx * DAY_WIDTH : 0
  }, [dateHeaders])

  // Status colors (full saturation = high priority)
  const statusColorMap: Record<string, string> = {
    preparation: '#FBBF24',
    in_progress: '#3B82F6',
    waiting: '#F97316',
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
    if (suppressClickRef.current) { suppressClickRef.current = false; return }
    const project = projects.find(p => p.id === id)
    console.log('[handleProjectClick] ID:', id, 'projectName:', project?.name, 'currentUrl:', window.location.href)
    navigate(`/project/${id}`)
  }, [navigate, projects])

  const handleAdd = useCallback(() => {
    setShowProjectForm(true)
  }, [])

  const handleCreateProject = useCallback((data: Omit<Project, 'id' | 'created_at' | 'updated_at'>) => {
    add(data)
    // Sub-project just created → expand its parent so it's immediately visible on the chart
    if (data.parent_id) {
      setExpandedParents(prev => {
        if (prev.has(data.parent_id as string)) return prev
        const next = new Set(prev)
        next.add(data.parent_id as string)
        try { localStorage.setItem('kanban_expanded', JSON.stringify([...next])) } catch { /* ignore */ }
        return next
      })
    }
    setShowProjectForm(false)
  }, [add])

  const handleDelete = useCallback((id: string) => {
    if (confirm('確定刪除此專案？')) {
      remove(id)
    }
  }, [remove])

  // ── Build sidebar rows list (same DOM order as right SVG) + isFirstSibling/isLastSibling ──
  // Rules:
  //   Root projects sort among OTHER root projects (parent_id === null)
  //   Sub-projects sort among sub-projects with the same parent_id
  //   Sub-projects within an expanded group: arrows based on position in root+children sibling group
  //   Root projects: arrows based on position among ALL root projects
  const sidebarRows = useMemo(() => {
    const allRoots = projects.filter(p => p.parent_id === null)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const rootIndexMap = new Map<string, number>()
    allRoots.forEach((r, i) => { rootIndexMap.set(r.id, i) })
    const totalRoots = allRoots.length

    const rows: Array<{ project: Project; isRoot: boolean; groupId: string; isFirstSibling: boolean; isLastSibling: boolean }> = []
    for (const group of filteredGroups) {
      const rootProject = projects.find(p => p.id === group.projectId)
      if (!rootProject) continue
      const rootIdx = rootIndexMap.get(rootProject.id) ?? 0
      const isRootFirst = rootIdx === 0
      const isRootLast = rootIdx === totalRoots - 1
      const isExpanded = expandedParents.has(group.projectId)

      rows.push({
        project: rootProject, isRoot: true, groupId: group.projectId,
        isFirstSibling: isRootFirst, isLastSibling: isRootLast,
      })

      if (isExpanded) {
        // Children only — root is NOT repeated (must stay in lockstep with svgRows)
        const childList = [...group.subProjects].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        const total = childList.length
        childList.forEach((child, i) => {
          rows.push({
            project: child,
            isRoot: false,
            groupId: group.projectId,
            isFirstSibling: i === 0,
            isLastSibling: i === total - 1,
          })
        })
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

  // ── SVG rows (y accumulates top-down, sidebar-compatible — change height math
  //    in BOTH this memo and totalGanttHeight together to keep left/right lockstep) ──
  const svgRows = useMemo(() => {
    const rows: Array<{ project: Project; isRoot: boolean; y: number; h: number; groupId: string; milestoneChildren?: Project[] }> = []
    let y = HEADER_HEIGHT + MILESTONE_ROW_HEIGHT
    for (const group of filteredGroups) {
      const rootProject = projects.find(p => p.id === group.projectId)
      if (!rootProject) continue
      const isExpanded = expandedParents.has(group.projectId)
      rows.push({
        project: rootProject,
        isRoot: true,
        y,
        h: PARENT_ROW_HEIGHT,
        groupId: group.projectId,
        // Collapsed: single-day children render as milestone diamonds on the parent row
        milestoneChildren: isExpanded ? [] : group.subProjects.filter(s => s.start_date === s.end_date),
      })
      y += PARENT_ROW_HEIGHT
      if (isExpanded) {
        for (const s of group.subProjects) {
          rows.push({ project: s, isRoot: false, y, h: SUB_ROW_HEIGHT, groupId: group.projectId })
          y += SUB_ROW_HEIGHT
        }
      }
    }
    return rows
  }, [filteredGroups, projects, expandedParents])

  // ── Gantt bar render helper ──
  const renderBar = (project: Project, yPos: number, rowHeight: number) => {
    const baseColor = statusColorMap[project.status] || '#3B82F6'
    const startMs = localDate(project.start_date).getTime()
    const endMs = localDate(project.end_date).getTime()
    const viewStartMs = localDate(viewStart).getTime()
    const viewEndMs = localDate(viewEndStr).getTime()

    if (endMs < viewStartMs || startMs > viewEndMs) return null

    const clampedStart = Math.max(startMs, viewStartMs)
    const clampedEnd = Math.min(endMs, viewEndMs)
    // Inclusive day count: 8/24~8/31 spans 8 day columns, not 7
    const barDays = Math.max(1, (clampedEnd - clampedStart) / 86400000 + 1)
    const offsetDays = Math.max(0, (startMs - viewStartMs) / 86400000)
    const barWidth = barDays * DAY_WIDTH
    const x = offsetDays * DAY_WIDTH
    const barY = yPos + 2
    const barH = rowHeight - 4
    // Narrow bars (single-day, 24px) show the first 2 chars; wide bars show up to 6
    const narrowBar = barWidth <= 36

    return (
      <g>
        <rect
          x={x}
          y={barY}
          width={barWidth}
          height={barH}
          rx={3} ry={3}
          fill={desaturate(baseColor, PRIORITY_SATURATIONS[project.priority] ?? 100, dk)}
          onClick={() => handleProjectClick(project.id)}
          onPointerDown={e => startDrag(e, { kind: 'move', target: 'project', id: project.id, x, w: barWidth, y: barY, h: barH })}
          style={{ pointerEvents: 'auto', cursor: drag?.id === project.id ? 'grabbing' : 'grab', touchAction: 'none' }}
        />
        <text
          x={x + (narrowBar ? 3 : 6)}
          y={barY + barH / 2 + 3}
          className="fill-white"
          fontSize={narrowBar ? '7' : '8'}
          pointerEvents="none"
        >
          {narrowBar
            ? project.name.slice(0, 2)
            : (project.name.length > 6 ? project.name.slice(0, 6) + '…' : project.name)}
        </text>
        {/* edge handles — resize start / end date (rendered last = on top) */}
        <rect
          x={x - 4} y={barY} width={8} height={barH} fill="transparent"
          onPointerDown={e => startDrag(e, { kind: 'resize-l', target: 'project', id: project.id, x, w: barWidth, y: barY, h: barH })}
          style={{ cursor: 'ew-resize', pointerEvents: 'auto', touchAction: 'none' }}
        />
        <rect
          x={x + barWidth - 4} y={barY} width={8} height={barH} fill="transparent"
          onPointerDown={e => startDrag(e, { kind: 'resize-r', target: 'project', id: project.id, x, w: barWidth, y: barY, h: barH })}
          style={{ cursor: 'ew-resize', pointerEvents: 'auto', touchAction: 'none' }}
        />
      </g>
    )
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3">
        {/* 手機：搜尋（窄）＋狀態＋優先級同一列；動作按鈕自動換行 */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[110px] md:min-w-[200px] md:max-w-sm">
            <input
              type="text"
              placeholder="搜尋..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2 py-1.5 md:pl-9 md:pr-4 md:py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
            />
            <svg className="absolute left-2.5 md:left-3 top-2 md:top-2.5 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="text-xs md:text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-1.5 md:px-2 py-1.5 md:py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 shrink-0"
            >
              <option value="">狀態</option>
              <option value="preparation">準備中</option>
              <option value="waiting">等待中</option>
              <option value="in_progress">進行中</option>
              <option value="completed">已完成</option>
            </select>
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="text-xs md:text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-1.5 md:px-2 py-1.5 md:py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 shrink-0"
            >
              <option value="">優先級</option>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
            <button
              onClick={handleAdd}
              title="新增專案"
              aria-label="新增專案"
              className="flex items-center gap-1 px-2 md:px-3 py-1.5 md:py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium"
            >
              <svg className="hidden md:block w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
              專案
            </button>
            <button
              onClick={openAddActivity}
              title="新增活動"
              aria-label="新增活動"
              className="flex items-center gap-1 px-2 md:px-3 py-1.5 md:py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm font-medium border border-purple-600 transition-colors"
            >
              <svg className="hidden md:block w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 21V4m0 0h11.5a1 1 0 01.8 1.6L14 9l3.3 3.4a1 1 0 01-.8 1.6H5" />
              </svg>
              活動
            </button>
            <button
              onClick={openAddTodo}
              className="flex items-center gap-1 px-2 md:px-3 py-1.5 md:py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 text-sm font-medium border border-teal-600 transition-colors"
            >
              <svg className="hidden md:block w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              待辦
            </button>
            {(() => {
              // 流水帳狀態提醒：未完成 → -count 徽章 + 脈動；全部完成 → 綠勾；今日無流水帳 → 原樣
              const total = activeRoutines.length
              const done = activeRoutines.filter(r => isDoneToday(r, today)).length
              const pending = total - done
              const allDone = total > 0 && pending === 0
              return (
                <button
                  onClick={openRoutineModal}
                  title={total === 0 ? '流水帳' : allDone ? '今日流水帳已全部完成' : `今日流水帳還有 ${pending} 項未完成`}
                  className="relative flex items-center gap-1 px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-sm font-medium transition-colors bg-amber-500 text-white hover:bg-amber-600 border border-amber-600"
                >
                  <svg className="hidden md:block w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  流水帳
                  {pending > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none shadow">
                      {pending}
                    </span>
                  )}
                  {allDone && <span className="text-emerald-200">✓</span>}
                </button>
              )
            })()}
            <button
              onClick={handleNavigateToSettings}
              className="flex items-center gap-1 px-2 md:px-3 py-1.5 md:py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium border border-green-600 transition-colors"
            >
              <svg className="hidden md:block w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              同步
            </button>
            <button
              onClick={handleLoadFromGitHub}
              disabled={isLoading}
              className="flex items-center gap-1 px-2 md:px-3 py-1.5 md:py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm font-medium border border-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="hidden md:block w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <span className="text-xs text-gray-500 dark:text-gray-400">標籤:</span>
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                    selectedTags.includes(tag)
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-400'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3 ml-auto">
            <Link to="/memo" className="flex items-center gap-1 px-2.5 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors" title="備忘錄">
              📝 備忘
            </Link>
            <Link to="/ledger" className="flex items-center gap-1 px-2.5 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors" title="收支記帳">
              💰 記帳
            </Link>
            <Link to="/archive" className="flex items-center gap-1 px-2.5 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors" title="已退場項目的歷史檔案">
              🗂️ 檔案庫
            </Link>
          </div>
        </div>

        {/* Priority saturation legend: same saturations as rendered bars */}
        <div className="flex items-center gap-3 flex-wrap">
            {([['#3B82F6', '進行中'], ['#F97316', '等待中'], ['#10B981', '已完成']] as const).map(([hex, label]) => (
              <span key={hex} className="flex items-center gap-1 text-xs">
                <span className="flex gap-px">
                  {LEGEND_SATURATIONS.map(s => (
                    <span key={s} className="w-2.5 h-3 rounded-sm inline-block" style={{ backgroundColor: desaturate(hex, s, dk) }} />
                  ))}
                </span>
                {label}
            </span>
          ))}
        </div>
      </div>

      {/* Gantt Chart — frozen sidebar + scrollable right */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Scroll controls bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <button onClick={handleScrollLeft} className="p-1 text-gray-500 dark:text-gray-400 hover:text-blue-500 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors" title="往前">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={handleScrollRight} className="p-1 text-gray-500 dark:text-gray-400 hover:text-blue-500 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors" title="往後">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
            <button onClick={handleScrollToToday} className="px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">今天</button>
          </div>
        </div>

        {/* Main gantt area: frozen sidebar (HTML) + scrollable right (SVG) */}
        <div className="relative" style={{ height: totalGanttHeight + HEADER_HEIGHT }}>
          {/* ══════════ FROZEN LEFT SIDEBAR (HTML, never scrolls) ══════════ */}
          <div
            className="absolute left-0 top-0 bg-white dark:bg-gray-800 overflow-hidden z-10"
            style={{ width: SIDEBAR_WIDTH, height: totalGanttHeight + HEADER_HEIGHT, borderRight: `1px solid ${dk ? '#374151' : '#e5e7eb'}` }}
          >
            {/* Date header row — no month/day numbers, just a thin strip */}
            <div
              className="flex items-center border-b border-gray-200 dark:border-gray-700"
              style={{ height: HEADER_HEIGHT }}
            >
              <div className="flex-1 flex items-center px-1">
                <span className="text-[8px] text-gray-400 dark:text-gray-500 font-medium truncate">專案名稱</span>
              </div>
              <div className="w-[42px] flex-shrink-0"></div>
            </div>

            {/* Milestone label row */}
            <div
              className="flex items-center border-b border-purple-200 dark:border-purple-900"
              style={{ height: MILESTONE_ROW_HEIGHT, backgroundColor: dk ? '#2e1065' : '#faf5ff' }}
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
                // For root projects: parentId is null (sort among roots)
                // For sub-projects: parentId is project.parent_id (sort among children of same parent)
                const sortParentId = isRoot ? null : project.parent_id
                const canMoveUp = !row.isFirstSibling
                const canMoveDown = !row.isLastSibling
                const projDropBefore = projDnd.dropTarget?.id === project.id && projDnd.dropTarget.before
                const projDropAfter = projDnd.dropTarget?.id === project.id && !projDnd.dropTarget.before

                return (
                  <div
                    key={isRoot ? `root-${project.id}` : `sub-${project.id}`}
                    draggable
                    onDragStart={projDnd.start(project.id)}
                    onDragOver={e => {
                      // 群組守則：跨群組不受理（不 preventDefault → 無指示線、不可放）
                      const dg = projects.find(p => p.id === projDnd.draggingId)
                      if (dg && (dg.parent_id ?? null) !== (project.parent_id ?? null)) return
                      projDnd.over(e, project.id)
                    }}
                    onDragLeave={() => projDnd.leave(project.id)}
                    onDrop={(e) => projDnd.drop(e, project.id, (overId, before, draggedId) => {
                      if (before) return overId
                      const sibs = projects.filter(p => (p.parent_id ?? null) === (project.parent_id ?? null) && p.id !== draggedId)
                        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                      return nextIdAfter(sibs, overId) // 無下一筆 → null（置末）
                    })}
                    onDragEnd={projDnd.clear}
                    className={`flex items-center ${projDropAfter
                      ? 'border-b-2 border-b-blue-500'
                      : 'border-b border-gray-100 dark:border-gray-700'} ${projDropBefore ? 'border-t-2 border-t-blue-500' : ''} cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950 select-none ${projDnd.draggingId === project.id ? 'opacity-40' : ''}`}
                    style={{ height: rowHeight, backgroundColor: bgEven ? (dk ? '#1f2937' : '#ffffff') : (dk ? '#111827' : '#fafafa') }}
                    onClick={() => handleProjectClick(project.id)}
                  >
                    {/* Project name — CSS text-overflow: ellipsis guarantees no overflow */}
                    <div
                      className="flex-1 min-w-0 truncate px-1 flex items-center gap-1"
                      title={project.name}
                    >
                      {/* Move up/down arrows — only show when applicable */}
                      <div className="flex flex-col gap-0 pointer-events-auto flex-shrink-0">
                        {canMoveUp && (
                          <span
                            className="cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900 w-[14px] h-[10px] flex items-center justify-center text-[8px] text-gray-300 hover:text-blue-500"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleMoveProjectUp(sortParentId, project.id)
                            }}
                            title="上移"
                          >
                            ▲
                          </span>
                        )}
                        {canMoveDown && (
                          <span
                            className="cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900 w-[14px] h-[10px] flex items-center justify-center text-[8px] text-gray-300 hover:text-blue-500"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleMoveProjectDown(sortParentId, project.id)
                            }}
                            title="下移"
                          >
                            ▼
                          </span>
                        )}
                      </div>
                      <span className={`text-[10px] truncate block leading-none pointer-events-none ${
                        isRoot ? 'font-medium text-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {isRoot
                          ? project.name
                          : `↳ ${project.name}`}
                      </span>
                    </div>

                    {/* Expand / collapse button for roots only — rightmost */}
                    <div className="w-[22px] flex-shrink-0 flex items-center justify-center pointer-events-auto">
                      {isRoot && sc > 0 && (
                        <span
                          className="cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900 w-[14px] h-[14px] flex items-center justify-center text-[10px] font-bold transition-colors bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-300 hover:text-blue-600"
                          onClick={(e) => { e.stopPropagation(); toggleExpand(project.id) }}
                          title={exp ? '收起' : '展開'}
                        >
                          {exp ? '▼' : '▶'}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ══════════ SCROLLABLE RIGHT AREA (SVG) ══════════ */}
          <div className="absolute left-[96px] top-0 right-0 overflow-x-auto overflow-y-hidden" ref={scrollRef}>
            <svg
              ref={svgRef}
              width={totalWidth}
              height={totalGanttHeight + HEADER_HEIGHT}
              className="min-w-full"
              onPointerMove={onSvgPointerMove}
              onPointerUp={onSvgPointerUp}
              onPointerCancel={onSvgPointerUp}
            >
              {/* Date header background */}
              <rect x={0} y={0} width={totalWidth} height={HEADER_HEIGHT} fill={dk ? '#1f2937' : '#f9fafb'} />

              {/* Date columns */}
              {dateHeaders.map((h, i) => {
                const xPos = i * DAY_WIDTH
                const isWeekend = h.dayOfWeek === 0 || h.dayOfWeek === 6
                const bgColor = isWeekend ? (dk ? '#111827' : '#f3f4f6') : (dk ? '#1f2937' : '#fff')
                return (
                  <g key={`col-${i}`}>
                    <rect x={xPos} y={0} width={DAY_WIDTH} height={HEADER_HEIGHT} fill={bgColor} />
                    <line
                      x1={xPos} y1={0} x2={xPos} y2={HEADER_HEIGHT}
                      stroke={h.isMonthStart ? (dk ? '#4b5563' : '#d1d5db') : (dk ? '#374151' : '#e5e7eb')}
                      strokeWidth={h.isMonthStart ? 1.5 : 0.5}
                    />
                    {/* Day number centered in column — red for today */}
                    <text
                      x={xPos + DAY_WIDTH / 2}
                      y={16}
                      textAnchor="middle"
                      fill={h.isToday ? '#ef4444' : (dk ? '#9ca3af' : '#4b5563')}
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
                        className="font-bold" fill={dk ? '#60a5fa' : '#2563eb'}
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

              {/* Milestone row — activity bars as color blocks */}
              <rect
                x={0} y={HEADER_HEIGHT}
                width={totalWidth} height={MILESTONE_ROW_HEIGHT}
                fill={dk ? '#2e1065' : '#faf5ff'}
              />
              {filteredMilestones.map((m) => {
                const startIdx = dateHeaders.findIndex(h => h.dateStr === m.start_date)
                const endIdx = dateHeaders.findIndex(h => h.dateStr === m.end_date)
                if (startIdx < 0 || endIdx < 0) return null
                const mX = startIdx * DAY_WIDTH
                const mWidth = (endIdx - startIdx + 1) * DAY_WIDTH
                // Use a purple shade that varies by name hash for visual distinction
                let hash = 0
                for (let i = 0; i < m.name.length; i++) hash = ((hash << 5) - hash) + m.name.charCodeAt(i)
                const hue = Math.abs(hash % 360)
                return (
                  <g key={m.id}>
                    {/* Activity bar — colored block spanning start to end date */}
                    <rect
                      x={mX + 2} y={HEADER_HEIGHT + 4}
                      width={Math.max(mWidth - 4, 20)} height={20} rx={4}
                      fill={`hsl(${hue}, 65%, 65%)`} opacity={0.85}
                      stroke={`hsl(${hue}, 65%, 50%)`} strokeWidth={0.5}
                      onClick={() => openEditActivity(m)}
                      onPointerDown={e => startDrag(e, { kind: 'move', target: 'milestone', id: m.id, x: mX + 2, w: Math.max(mWidth - 4, 20), y: HEADER_HEIGHT + 4, h: 20 })}
                      style={{ cursor: drag?.id === m.id ? 'grabbing' : 'grab', touchAction: 'none' }}
                    />
                    {/* edge handles — resize activity dates */}
                    <rect
                      x={mX - 2} y={HEADER_HEIGHT + 4} width={8} height={20} fill="transparent"
                      onPointerDown={e => startDrag(e, { kind: 'resize-l', target: 'milestone', id: m.id, x: mX + 2, w: Math.max(mWidth - 4, 20), y: HEADER_HEIGHT + 4, h: 20 })}
                      style={{ cursor: 'ew-resize', pointerEvents: 'auto', touchAction: 'none' }}
                    />
                    <rect
                      x={mX + 2 + Math.max(mWidth - 4, 20) - 4} y={HEADER_HEIGHT + 4} width={8} height={20} fill="transparent"
                      onPointerDown={e => startDrag(e, { kind: 'resize-r', target: 'milestone', id: m.id, x: mX + 2, w: Math.max(mWidth - 4, 20), y: HEADER_HEIGHT + 4, h: 20 })}
                      style={{ cursor: 'ew-resize', pointerEvents: 'auto', touchAction: 'none' }}
                    />
                    {/* Activity name label on the bar */}
                    {/* Activity name: full-ish label when wide, first 2 chars on 1-day (narrow) bars */}
                    <text
                      x={mX + 6} y={HEADER_HEIGHT + 17}
                      className="fill-white"
                      fontSize="7"
                      fontWeight="600"
                      pointerEvents="none"
                    >
                      {mWidth > 40 ? (m.name.length > 8 ? m.name.slice(0, 8) + '…' : m.name) : m.name.slice(0, 2)}
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
                      fill={idx % 2 === 0 ? (dk ? '#1f2937' : '#ffffff') : (dk ? '#111827' : '#fafafa')}
                      onClick={() => handleProjectClick(project.id)}
                      style={{ cursor: 'pointer' }}
                    />
                    {/* Gantt bar */}
                    {barRect}
                    {/* Collapsed group: single-day children as milestone diamonds (click to expand) */}
                    {row.milestoneChildren?.map(mc => {
                      const dIdx = dateHeaders.findIndex(h => h.dateStr === mc.start_date)
                      if (dIdx < 0) return null
                      const cx = dIdx * DAY_WIDTH + DAY_WIDTH / 2
                      const cy = row.y + row.h / 2
                      return (
                        <rect
                          key={`md-${mc.id}`}
                          x={cx - 4} y={cy - 4}
                          width={8} height={8} rx={1.5}
                          transform={`rotate(45 ${cx} ${cy})`}
                          fill={desaturate(statusColorMap[mc.status] || '#3B82F6', PRIORITY_SATURATIONS[mc.priority] ?? 100, dk)}
                          stroke={dk ? '#111827' : '#ffffff'}
                          strokeWidth={1}
                          opacity={0.95}
                          className="cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleExpand(row.groupId)
                          }}
                        >
                          <title>{`${mc.name} (${mc.start_date})`}</title>
                        </rect>
                      )
                    })}
                  </g>
                )
              })}

              {/* Today red vertical line — renders on top of all bars */}
              <line
                x1={todayOffset} y1={HEADER_HEIGHT}
                x2={todayOffset} y2={totalGanttHeight + HEADER_HEIGHT}
                stroke="#ef4444" strokeWidth={2}
                pointerEvents="none"
              />

              {/* Drag ghost — snapped preview with date range tooltip */}
              {drag && drag.moved && (
                <g pointerEvents="none">
                  <rect
                    x={drag.newX} y={drag.barY} width={drag.newW} height={drag.barH} rx={3}
                    fill={dk ? '#60a5fa' : '#3b82f6'} opacity={0.35}
                    stroke="#2563eb" strokeWidth={1} strokeDasharray="4 2"
                  />
                  <text
                    x={drag.newX + 4} y={drag.barY + 11}
                    fontSize="8" fontWeight="600"
                    fill={dk ? '#bfdbfe' : '#1d4ed8'}
                  >
                    {`${addDays(viewStart, Math.round(drag.newX / DAY_WIDTH))} ~ ${addDays(viewStart, Math.round((drag.newX + drag.newW) / DAY_WIDTH) - 1)}`}
                  </text>
                </g>
              )}

            </svg>
          </div>
        </div>

        {/* Info bar */}
        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-950 border-t border-blue-200 dark:border-blue-900 text-xs text-blue-700">
          💡 左右箭頭按鈕瀏覽時間軸 · 點擊日期進入日曆視圖 · 點擊專案進入詳細頁面 · 活動列在專案上方 · 左側為凍結欄
        </div>
      </div>

      {/* Todo list section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
            <svg className="w-4 h-4 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            待辦事項
            {visibleTodos.length > 0 && (
              <span className="bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300 px-2 py-0.5 rounded-full text-xs">
                {visibleTodos.filter(t => !t.completed).length}/{visibleTodos.length}
              </span>
            )}
          </h2>
        </div>

        {visibleTodos.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
            {priorityFilter && sortedTodos.length > 0
              ? `目前篩選條件下沒有${priorityFilter === 'high' ? '高' : priorityFilter === 'medium' ? '中' : '低'}優先級待辦事項`
              : '還沒有待辦事項，點擊上方「待辦」按鈕新增'}
          </p>
        ) : (
          <div className="space-y-2">
            {visibleTodos.map(todo => {
              const todoDropBefore = todoDnd.dropTarget?.id === todo.id && todoDnd.dropTarget.before
              const todoDropAfter = todoDnd.dropTarget?.id === todo.id && !todoDnd.dropTarget.before
              return (
              <div
                key={todo.id}
                draggable
                onDragStart={todoDnd.start(todo.id)}
                onDragOver={e => todoDnd.over(e, todo.id)}
                onDragLeave={() => todoDnd.leave(todo.id)}
                onDrop={(e) => todoDnd.drop(e, todo.id, (overId, before, draggedId) => {
                  if (before) return overId
                  const rest = visibleTodos.filter(t => t.id !== draggedId)
                  return nextIdAfter(rest, overId) // 無下一筆 → null（置末）
                })}
                onDragEnd={todoDnd.clear}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors select-none ${
                  todoDnd.draggingId === todo.id ? 'opacity-40' : ''
                } ${
                  todoDropAfter ? '!border-b-2 !border-b-blue-500'
                  : todoDropBefore ? '!border-t-2 !border-t-blue-500'
                  : ''
                } ${
                  todo.completed
                    ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:border-gray-600'
                }`}
              >
                <button
                  onClick={() => handleToggleTodo(todo.id)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    todo.completed
                      ? 'bg-teal-500 border-teal-500'
                      : 'border-gray-300 dark:border-gray-600 hover:border-teal-400'
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
                      ? 'line-through text-gray-400 dark:text-gray-500'
                      : 'text-gray-700 dark:text-gray-200 hover:text-gray-900'
                  }`}
                  onClick={() => openEditTodo(todo)}
                >
                  {todo.name}
                </span>

                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  todo.priority === 'high' ? 'text-red-600 bg-red-50' :
                  todo.priority === 'medium' ? 'text-yellow-600 bg-yellow-50' :
                  'text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900'
                }`}>
                  {todo.priority === 'high' ? '高' : todo.priority === 'medium' ? '中' : '低'}
                </span>

                {/* Reorder arrows — first: only ▼, last: only ▲, middle: both (relative to visible list) */}
                <div className="flex flex-col gap-0 pointer-events-auto">
                  {visibleTodos.indexOf(todo) > 0 && (
                    <span
                      className="cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900 w-[12px] h-[8px] flex items-center justify-center text-[6px] text-gray-400 dark:text-gray-500 hover:text-blue-600"
                      onClick={(e) => { e.stopPropagation(); handleMoveTodoUp(todo.id) }}
                      title="上移"
                    >
                      ▲
                    </span>
                  )}
                  {visibleTodos.indexOf(todo) < visibleTodos.length - 1 && (
                    <span
                      className="cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900 w-[12px] h-[8px] flex items-center justify-center text-[6px] text-gray-400 dark:text-gray-500 hover:text-blue-600"
                      onClick={(e) => { e.stopPropagation(); handleMoveTodoDown(todo.id) }}
                      title="下移"
                    >
                      ▼
                    </span>
                  )}
                </div>
              </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add/edit activity modal */}
      {showActivityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-80">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="text-purple-500">🚩</span> {editingActivity ? '編輯活動' : '新增活動'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">名稱</label>
                <input
                  type="text"
                  value={activityName}
                  onChange={e => setActivityName(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm"
                  placeholder="例：第一次開標"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">開始日期</label>
                  <input
                    type="date"
                    value={activityStartDate}
                    onChange={e => setActivityStartDate(e.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">結束日期</label>
                  <input
                    type="date"
                    value={activityEndDate}
                    onChange={e => setActivityEndDate(e.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">標籤（以逗號分隔，例如：招標,財務,開標）</label>
                <input
                  type="text"
                  value={activityTags.join('、')}
                  onChange={e => setActivityTags(e.target.value.split('、').map(t => t.trim()).filter(Boolean))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm"
                  placeholder="例：招標、財務"
                />
                {/* Quick-pick tag buttons */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {QUICK_TAGS.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setActivityTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                      className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                        activityTags.includes(tag)
                          ? 'bg-purple-500 text-white border-purple-500'
                          : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-purple-400'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">說明 / 備註</label>
                <textarea
                  value={activityDesc}
                  onChange={e => setActivityDesc(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm resize-none"
                  rows={3}
                  placeholder="輸入活動說明或備註（選填）"
                />
              </div>
              {editingActivity && (
                <div className="flex gap-2 pt-1 text-xs">
                  <button onClick={() => {
                    projectStore.addMilestone({
                      name: editingActivity.name + 'Q',
                      start_date: editingActivity.start_date,
                      end_date: editingActivity.end_date || editingActivity.start_date,
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
                <button onClick={() => { setShowActivityModal(false); setEditingActivity(null) }} className="flex-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-80">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="text-teal-500">✅</span> {editingTodo ? '編輯待辦' : '新增待辦'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">名稱</label>
                <input
                  type="text"
                  value={todoName}
                  onChange={e => setTodoName(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm"
                  placeholder="輸入待辦名稱"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">優先級</label>
                <select
                  value={todoPriority}
                  onChange={e => setTodoPriority(e.target.value as ProjectPriority)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="high">高</option>
                  <option value="medium">中</option>
                  <option value="low">低</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">說明 / 備註</label>
                <textarea
                  value={todoDesc}
                  onChange={e => setTodoDesc(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm resize-none"
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
                <button onClick={() => { setShowTodoModal(false); setEditingTodo(null) }} className="flex-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
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
      {/* 流水帳 modal */}
      {showRoutineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setShowRoutineModal(false)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-[92%] max-w-lg max-h-[85vh] overflow-y-auto p-5"
            style={{ maxWidth: 480 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-700 dark:text-gray-200">
                <span className="text-amber-500">📒</span> 今日流水帳
                <span className="text-xs font-normal text-gray-400">{today}</span>
                {activeRoutines.length > 0 && (
                  <span className="bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full text-xs">
                    {activeRoutines.filter(r => isDoneToday(r, today)).length}/{activeRoutines.length}
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setRoutineEditMode(v => !v); setEditingRoutine(null); setShowRoutineForm(false) }}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${routineEditMode ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-amber-400'}`}
                >
                  {routineEditMode ? '完成編輯' : '編輯'}
                </button>
                <button onClick={() => setShowRoutineModal(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
              </div>
            </div>

            {/* 檢視模式：今日 checklist */}
            {!routineEditMode && (
              activeRoutines.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">今天沒有符合條件的流水帳 👍</p>
              ) : (
                <div className="space-y-2">
                  {activeRoutines.map(r => {
                    const done = isDoneToday(r, today)
                    return (
                      <div
                        key={r.id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${done ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}
                      >
                        <button
                          onClick={() => projectStore.toggleRoutineDone(r.id, today)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${done ? 'bg-amber-500 border-amber-500' : 'border-gray-300 dark:border-gray-600 hover:border-amber-400'}`}
                        >
                          {done && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <span className={`flex-1 text-sm cursor-pointer ${done ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200'}`} onClick={() => projectStore.toggleRoutineDone(r.id, today)}>
                          {r.name}
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0">
                          {r.weekdays.length > 0 && r.weekdays.map(d => WEEKDAY_LABELS[d]).join('/')}
                          {r.weekdays.length > 0 && (r.monthDays.length > 0 || r.tags.length > 0) && ' · '}
                          {r.monthDays.length > 0 && `${r.monthDays.join('/')}號`}
                          {r.monthDays.length > 0 && r.tags.length > 0 && ' · '}
                          {r.tags.length > 0 && r.tags.map(t => `#${t}`).join(' ')}
                        </span>
                      </div>
                    )
                  })}
                  {activeRoutines.length > 0 && activeRoutines.every(r => isDoneToday(r, today)) && (
                    <p className="text-center text-sm text-amber-500 pt-2">🎉 今天的全部完成了！</p>
                  )}
                </div>
              )
            )}

            {/* 編輯模式：清單 + 表單 */}
            {routineEditMode && (
              <div className="space-y-2">
                {!editingRoutine && (
                  <button onClick={openAddRoutine} className="w-full py-2 border-2 border-dashed border-amber-300 dark:border-amber-700 rounded-lg text-amber-500 hover:border-amber-400 transition-colors text-sm">
                    ＋ 新增流水帳項目
                  </button>
                )}
                {routines.length === 0 && !editingRoutine && (
                  <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">尚無流水帳項目，按上方按鈕新增</p>
                )}
                {!editingRoutine && routines.map(r => (
                  <div key={r.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
                    <span className="flex-1 text-sm text-gray-700 dark:text-gray-200">{r.name}</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">
                      {r.weekdays.length > 0 ? r.weekdays.map(d => WEEKDAY_LABELS[d]).join('/') : ''}
                      {r.monthDays.length > 0 ? ` ${r.monthDays.join('/')}號` : ''}
                      {r.tags.length > 0 ? ` ${r.tags.map(t => `#${t}`).join(' ')}` : ''}
                    </span>
                    <button onClick={() => openEditRoutine(r)} className="text-xs text-blue-500 hover:text-blue-700">編輯</button>
                    <button onClick={() => { if (confirm(`確定刪除「${r.name}」？`)) projectStore.removeRoutine(r.id) }} className="text-xs text-red-500 hover:text-red-700">刪除</button>
                  </div>
                ))}

                {(editingRoutine || showRoutineForm) && (
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 space-y-3">
                    <h4 className="text-sm font-medium text-gray-600 dark:text-gray-300">{editingRoutine ? '編輯項目' : '新增項目'}</h4>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">名稱</label>
                      <input
                        type="text"
                        value={rName}
                        onChange={e => setRName(e.target.value)}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                        placeholder="例：檢查 email、澆花"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">星期（可多選；加上下方條件為「或」）</label>
                      <div className="flex gap-1">
                        {WEEKDAY_LABELS.map((lbl, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setRWeekdays(prev => prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i])}
                            className={`w-8 h-8 text-xs rounded-full border transition-colors ${rWeekdays.includes(i) ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-amber-400'}`}
                          >
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">每月幾號出現（逗號分隔，留空=不適用）</label>
                      <input
                        type="text"
                        value={rMonthDays}
                        onChange={e => setRMonthDays(e.target.value)}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                        placeholder="例：1,15"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">今日活動含以下標籤時出現</label>
                      <div className="flex flex-wrap gap-1 mb-1">
                        {QUICK_TAGS.map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setRTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                            className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${rTags.includes(t) ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-amber-400'}`}
                          >
                            {t}
                          </button>
                        ))}
                        {rTags.filter(t => !QUICK_TAGS.includes(t)).map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setRTags(prev => prev.filter(x => x !== t))}
                            className="px-2 py-0.5 text-xs rounded-full border bg-amber-500 text-white border-amber-500"
                            title="點擊移除"
                          >
                            {t} ✕
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={rCustomTag}
                        onChange={e => setRCustomTag(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomRTag() } }}
                        onBlur={addCustomRTag}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                        placeholder="其他標籤，輸入後按 Enter"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => { setEditingRoutine(null); setShowRoutineForm(false); setRName(''); setRWeekdays([]); setRMonthDays(''); setRTags([]); setRCustomTag('') }} className="flex-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        取消
                      </button>
                      <button onClick={saveRoutine} disabled={!rName.trim()} className="flex-1 px-3 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                        {editingRoutine ? '儲存' : '新增'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Add-project modal (＋新增) */}
      {showProjectForm && (
        <ProjectForm
          onClose={() => setShowProjectForm(false)}
          onSubmit={handleCreateProject}
          rootProjects={rootProjects}
          defaultStartDate={dateToStr(new Date())}
          defaultEndDate={dateToStr(new Date(Date.now() + 7 * 86400000))}
        />
      )}
    </div>
  )
}

export default GanttPage
