import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjects } from '@/hooks/useProjects'
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/types/project'
import type { Project, ProjectStatus } from '@/types/project'

// ── Kanban column configuration (excludes milestone and milestone) ──
const COLUMNS: { key: 'preparation' | 'waiting' | 'in_progress' | 'completed'; label: string; color: string; borderColor: string }[] = [
  { key: 'preparation', label: '準備中',   color: 'bg-yellow-50',   borderColor: 'border-yellow-400' },
  { key: 'waiting',     label: '等待中',   color: 'bg-orange-50',   borderColor: 'border-orange-400' },
  { key: 'in_progress', label: '進行中',   color: 'bg-blue-50',     borderColor: 'border-blue-400' },
  { key: 'completed',   label: '已完成',   color: 'bg-green-50',    borderColor: 'border-green-400' },
]

function ProjectCard({ project, onEdit }: { project: Project; onEdit: (id: string) => void }) {
  const statusConfig = STATUS_CONFIG[project.status]
  const priorityConfig = PRIORITY_CONFIG[project.priority]
  const remainingDays = (() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const target = new Date(project.end_date)
    target.setHours(0, 0, 0, 0)
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  })()

  const progressPercent = Math.min(Math.max(project.progress, 0), 100)

  return (
    <div
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-2 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group"
      onClick={() => onEdit(project.id)}
    >
      {/* Project name */}
      <h4 className="font-medium text-gray-800 mb-2 text-sm leading-tight">{project.name}</h4>
      
      {/* Priority badge */}
      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-2 ${priorityConfig.color}`}>
        {priorityConfig.label}
      </span>
      
      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
        <div
          className="bg-blue-500 h-1.5 rounded-full transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      
      {/* Dates and status */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {project.start_date} ~ {project.end_date}
        </span>
        <span className={`${statusConfig.color}`}>
          {statusConfig.label}
        </span>
      </div>
      
      {/* Remaining days indicator */}
      {remainingDays > 0 && (
        <div className="mt-1 text-xs text-orange-600">
          剩餘 {remainingDays} 天
        </div>
      )}
    </div>
  )
}

function KanbanBoard() {
  const navigate = useNavigate()
  const { projects, remove } = useProjects()
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  // Group projects by status
  const projectsByStatus = useMemo(() => {
    const groups: Record<ProjectStatus, Project[]> = {
      preparation: [],
      waiting: [],
      in_progress: [],
      completed: [],
    }
    projects.forEach(project => {
      if (groups[project.status]) {
        groups[project.status].push(project)
      }
    })
    return groups
  }, [projects])

  const handleEditProject = useCallback((id: string) => {
    navigate(`/edit/${id}`)
  }, [navigate])

  const handleDeleteProject = useCallback((id: string) => {
    if (confirm('確定刪除此專案？')) {
      remove(id)
      if (showDeleteConfirm === id) {
        setShowDeleteConfirm(null)
      }
    }
  }, [remove, showDeleteConfirm])

  // Count projects in each status
  const totalProjects = projects.length
  const activeProjects = projects.filter(p => ['in_progress', 'waiting'].includes(p.status)).length
  const completedProjects = projects.filter(p => p.status === 'completed').length

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">專案看板</h1>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>總計: {totalProjects} 個專案</span>
          <span>進行中: {activeProjects}</span>
          <span>已完成: {completedProjects}</span>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map(column => {
          const columnProjects = projectsByStatus[column.key] || []
          return (
            <div
              key={column.key}
              className={`flex-shrink-0 w-72 ${column.color} rounded-lg border ${column.borderColor} p-3`}
            >
              {/* Column header */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">{column.label}</h3>
                <span className="bg-white px-2 py-0.5 rounded-full text-xs font-medium text-gray-600">
                  {columnProjects.length}
                </span>
              </div>
              
              {/* Project cards */}
              <div className="space-y-2">
                {columnProjects.map((project: Project) => (
                  <div key={project.id} className="relative group">
                    <ProjectCard
                      project={project}
                      onEdit={handleEditProject}
                    />
                    
                    {/* Delete button */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteProject(project.id)
                        }}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="刪除專案"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Empty state */}
              {columnProjects.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  尚無專案
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default KanbanBoard
