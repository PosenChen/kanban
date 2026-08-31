import { useState } from 'react'
import { STATUS_CONFIG, QUICK_TAGS, type Project, type ProjectStatus } from '@/types/project'
import { PRIORITY_CONFIG } from '@/types/project'
import { getRemainingDays, getDaysDiff } from '@/utils/dateUtils'

interface ProjectFormProps {
  onClose: () => void
  onSubmit: (data: Omit<Project, 'id' | 'created_at' | 'updated_at'>) => void
  editProject?: Project | null
  rootProjects: Project[]
  defaultStartDate?: string
  defaultEndDate?: string
}

function ProjectForm({ onClose, onSubmit, editProject, rootProjects, defaultStartDate, defaultEndDate }: ProjectFormProps) {
  const [name, setName] = useState(editProject?.name || '')
  const [description, setDescription] = useState(editProject?.description || '')
  const [parentId, setParentId] = useState(editProject?.parent_id || '')
  const [startDate, setStartDate] = useState(editProject?.start_date || defaultStartDate || '')
  const [endDate, setEndDate] = useState(editProject?.end_date || defaultEndDate || '')
  const [status, setStatus] = useState<ProjectStatus>(editProject?.status || 'preparation')
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>(editProject?.priority || 'medium')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>(editProject?.tags || [])

  const allRoots = rootProjects.map(r => ({ value: r.id, label: r.name }))

  const handleAddTag = () => {
    const t = tagInput.trim()
    if (t && !tags.includes(t)) {
      setTags([...tags, t])
      setTagInput('')
    }
  }

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag))
  }

  const handleToggleQuickTag = (tag: string) => {
    if (tags.includes(tag)) setTags(tags.filter(t => t !== tag))
    else setTags([...tags, tag])
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !startDate || !endDate) return
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      parent_id: parentId || null,
      sort_order: 0,
      start_date: startDate,
      end_date: endDate,
      status,
      priority,
      tags,
      progress: editProject?.progress ?? 0,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{editProject ? '編輯專案' : '新增專案'}</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">專案名稱 <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="輸入專案名稱"
              required
              autoFocus
            />
          </div>

          {/* Parent */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">父專案</label>
            <select
              value={parentId}
              onChange={e => setParentId(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">無（根專案）</option>
              {rootProjects.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">起始日期 <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">結束日期 <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                required
              />
            </div>
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">狀態</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as ProjectStatus)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="preparation">準備中</option>
                <option value="waiting">等待中</option>
                <option value="in_progress">進行中</option>
                <option value="completed">已完成</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">優先級</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as 'high' | 'medium' | 'low')}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </div>
          </div>

          {/* Progress */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              進度 {editProject ? `${editProject.progress}%` : '0%'}
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={editProject?.progress ?? 0}
              onChange={e => {}}
              disabled={!!editProject}
              className="w-full"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">標籤</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag() } }}
                className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                placeholder="輸入後按 Enter"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 text-sm"
              >
                新增
              </button>
            </div>
            {/* Quick-pick tag buttons */}
            <div className="flex flex-wrap gap-1 mt-2">
              {QUICK_TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleToggleQuickTag(tag)}
                  className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                    tags.includes(tag)
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-400'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 dark:text-blue-300 rounded-full text-xs"
                  >
                    #{tag}
                    <button type="button" onClick={() => handleRemoveTag(tag)} className="ml-0.5 text-blue-500 hover:text-red-500">
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">說明/備註</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm resize-y"
              placeholder="專案說明..."
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!name.trim() || !startDate || !endDate}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {editProject ? '儲存變更' : '建立專案'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ProjectForm
