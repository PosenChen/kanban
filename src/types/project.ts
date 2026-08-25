export type ProjectStatus = 'preparation' | 'in_progress' | 'waiting' | 'completed'

export type ProjectPriority = 'high' | 'medium' | 'low'

export interface Milestone {
  id: string
  name: string
  date: string // YYYY-MM-DD
  tags: string[]
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  name: string
  description: string
  parent_id: string | null
  start_date: string // YYYY-MM-DD
  end_date: string   // YYYY-MM-DD
  status: ProjectStatus
  priority: ProjectPriority
  tags: string[]
  progress: number // 0-100
  created_at: string // ISO-8601
  updated_at: string // ISO-8601
  actual_start_date?: string
  actual_end_date?: string
}

export type ProjectStatusLabel = {
  key: ProjectStatus
  label: string
  color: string
  bgColor: string
}

export const STATUS_CONFIG: Record<ProjectStatus, ProjectStatusLabel> = {
  preparation: { key: 'preparation', label: '準備中', color: 'text-yellow-700', bgColor: 'bg-yellow-400' },
  in_progress: { key: 'in_progress', label: '進行中', color: 'text-blue-700', bgColor: 'bg-blue-500' },
  waiting:     { key: 'waiting',     label: '等待中', color: 'text-orange-700', bgColor: 'bg-orange-400' },
  completed:   { key: 'completed',   label: '已完成', color: 'text-green-700', bgColor: 'bg-green-500' },
}

export type PriorityLabel = {
  key: ProjectPriority
  label: string
  color: string
}

export const PRIORITY_CONFIG: Record<ProjectPriority, PriorityLabel> = {
  high:    { key: 'high',    label: '高',    color: 'text-red-600 bg-red-100' },
  medium:  { key: 'medium',  label: '中',    color: 'text-yellow-600 bg-yellow-100' },
  low:     { key: 'low',     label: '低',    color: 'text-gray-500 bg-gray-100' },
}
