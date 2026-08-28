import { STATUS_CONFIG, PRIORITY_CONFIG, type Project } from '@/types/project'
import { getRemainingDays, getDaysDiff, formatMonthDay, getDayOfWeek } from '@/utils/dateUtils'

interface ProjectCardProps {
  project: Project
  onClick: () => void
  onDelete: () => void
}

function ProjectCard({ project, onClick, onDelete }: ProjectCardProps) {
  const remaining = getRemainingDays(project.end_date)
  const totalDays = getDaysDiff(project.start_date, project.end_date)
  const statusCfg = STATUS_CONFIG[project.status]
  const prioCfg = PRIORITY_CONFIG[project.priority]
  const isOverdue = remaining < 0 && project.status !== 'completed'
  const isEnding = project.end_date === new Date().toISOString().split('T')[0]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow p-4 cursor-pointer group">
      <div className="flex items-start justify-between" onClick={onClick}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 truncate">{project.name}</h3>
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.bgColor} ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
            <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${prioCfg.color}`}>
              {prioCfg.label}
            </span>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{formatMonthDay(project.start_date)} ~ {formatMonthDay(project.end_date)}</p>

          {/* Tags */}
          {project.tags.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {project.tags.map(tag => (
                <span key={tag} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">#{tag}</span>
              ))}
            </div>
          )}

          {/* Meta badges */}
          <div className="flex gap-2 mt-2 text-xs">
            <span className="text-gray-400 dark:text-gray-500">{totalDays} 天</span>
            {isOverdue && <span className="text-red-500 font-medium">⚠ 已逾期 {Math.abs(remaining)} 天</span>}
            {isEnding && <span className="text-orange-500 font-medium">🔥 今日到期</span>}
            {!isOverdue && !isEnding && (
              <span className="text-gray-400 dark:text-gray-500">剩 {remaining} 天</span>
            )}
          </div>
        </div>

        {/* Delete button on hover */}
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="opacity-0 group-hover:opacity-100 text-gray-400 dark:text-gray-500 hover:text-red-500 transition-opacity p-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Progress bar */}
      <div className="mt-2 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all ${
            project.status === 'completed' ? 'bg-green-500' :
            project.status === 'in_progress' ? 'bg-blue-500' : 'bg-orange-400'
          }`}
          style={{ width: `${project.progress}%` }}
        />
      </div>
    </div>
  )
}

export default ProjectCard
