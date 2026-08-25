import { useParams, useNavigate } from 'react-router-dom'
import { useProjects } from '@/hooks/useProjects'
import { STATUS_CONFIG, PRIORITY_CONFIG, type Project } from '@/types/project'
import { getRemainingDays, getDaysDiff, formatMonthDay } from '@/utils/dateUtils'
import ProjectForm from '@/components/ProjectForm'
import ProjectCard from '@/components/ProjectCard'
import { useState, useCallback } from 'react'

function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  if (!id) return <div className="flex items-center justify-center h-64 text-gray-400"><p>找不到專案 ID</p></div>
  const navigate = useNavigate()
  const { getById, update, remove, getByParent, getAll, add } = useProjects()

  const project = getById(id)
  const [showForm, setShowForm] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const children = getByParent(id)

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
          <p className="text-lg mb-2">找不到此專案</p>
          <button onClick={() => navigate('/')} className="text-blue-500 hover:underline">
            返回總覽
          </button>
        </div>
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[project.status]
  const prioCfg = PRIORITY_CONFIG[project.priority]
  const remaining = getRemainingDays(project.end_date)
  const totalDays = getDaysDiff(project.start_date, project.end_date)
  const rootProjects = getAll().filter(p => p.parent_id === null)

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    if (!val) return
    update(id, { status: val as Project['status'] })
  }

  const handlePriorityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    if (!val) return
    update(id, { priority: val as Project['priority'] })
  }

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    update(id, { progress: Number(e.target.value) })
  }

  const handleDelete = () => {
    if (confirmDelete) {
      remove(id)
      navigate('/')
    } else {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000)
    }
  }

  const handleUpdate = (data: Omit<Project, 'id' | 'created_at' | 'updated_at'>) => {
    update(id, data)
    setShowForm(false)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        返回總覽
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h1 className="text-2xl font-bold text-gray-800">{project.name}</h1>
              <span className={`inline-block px-2.5 py-1 rounded-full text-sm font-medium ${statusCfg.bgColor} ${statusCfg.color}`}>
                {statusCfg.label}
              </span>
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${prioCfg.color}`}>
                優先級: {prioCfg.label}
              </span>
            </div>

            {project.description && (
              <p className="text-gray-600 mt-1">{project.description}</p>
            )}

            {/* Tags */}
            {project.tags.length > 0 && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {project.tags.map((tag: string) => (
                  <span key={tag} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 ml-4">
            <button
              onClick={() => setShowForm(true)}
              className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              編輯
            </button>
            <button
              onClick={() => {
                const copyName = project.name + 'Q'
                add({
                  name: copyName,
                  description: project.description,
                  parent_id: project.parent_id,
                  start_date: project.start_date,
                  end_date: project.end_date,
                  status: project.status,
                  priority: project.priority,
                  tags: [...project.tags],
                  progress: project.progress,
                })
              }}
              className="px-3 py-1.5 text-sm bg-gray-100 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-200"
            >
              複製
            </button>
            <button
              onClick={handleDelete}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                confirmDelete
                  ? 'bg-red-500 text-white border-red-500'
                  : 'border-gray-300 text-gray-500 hover:border-red-400 hover:text-red-500'
              }`}
            >
              {confirmDelete ? '再按確認刪除' : '刪除'}
            </button>
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-4 border-t border-gray-100">
          <div>
            <div className="text-xs text-gray-400">起始日期</div>
            <div className="text-sm font-medium mt-0.5">{formatMonthDay(project.start_date)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">結束日期</div>
            <div className="text-sm font-medium mt-0.5">{formatMonthDay(project.end_date)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">天數</div>
            <div className="text-sm font-medium mt-0.5">{totalDays} 天</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">剩餘天數</div>
            <div className={`text-sm font-medium mt-0.5 ${
              remaining < 0 && project.status !== 'completed' ? 'text-red-500' :
              remaining === 0 ? 'text-orange-500' : 'text-gray-700'
            }`}>
              {remaining < 0 && project.status !== 'completed' ? `已逾期 ${Math.abs(remaining)} 天` : remaining === 0 ? '今天到期！' : `剩 ${remaining} 天`}
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-500">進度</span>
            <span className="font-medium">{project.progress}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={project.progress}
            onChange={handleProgressChange}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      {/* Children / Sub-projects */}
      {children.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-3">子專案（{children.length}）</h2>
          <div className="space-y-3">
            {children.map((child: Project) => (
              <div key={child.id} onClick={() => navigate(`/project/${child.id}`)} className="cursor-pointer">
                <ProjectCard
                  project={child}
                  onClick={() => navigate(`/project/${child.id}`)}
                  onDelete={() => {
                    if (confirm('確定刪除此子專案？')) {
                      remove(child.id)
                    }
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Project Form Modal */}
      {showForm && (
        <ProjectForm
          onClose={() => setShowForm(false)}
          onSubmit={handleUpdate}
          editProject={project}
          rootProjects={rootProjects}
        />
      )}
    </div>
  )
}

export default ProjectDetailPage
