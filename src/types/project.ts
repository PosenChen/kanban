export type ProjectStatus = 'preparation' | 'in_progress' | 'completed' | 'milestone'

export type ProjectPriority = 'high' | 'medium' | 'low'

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
  completed:   { key: 'completed',   label: '已完成', color: 'text-green-700', bgColor: 'bg-green-500' },
  milestone:   { key: 'milestone',   label: '里程碑', color: 'text-purple-700', bgColor: 'bg-purple-500' },
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
