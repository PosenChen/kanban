import { useParams, useNavigate } from 'react-router-dom'
import { useProjects } from '@/hooks/useProjects'
import { getRemainingDays, formatMonthDay, getDayOfWeek, dateToStr } from '@/utils/dateUtils'
import ProjectCard from '@/components/ProjectCard'
import { useState } from 'react'

function DailyPage() {
  const { date: dateParam } = useParams<{ date: string }>()!
  const navigate = useNavigate()
  const { getAll, remove, add } = useProjects()

  const projects = getAll()

  // Parse the date
  let targetDate = dateParam
  if (!targetDate) {
    targetDate = dateToStr(new Date())
  }

  const dayOfWeek = getDayOfWeek(targetDate)
  const nextDate = dateParam ? new Date(dateParam + 'T00:00:00') : new Date()
  nextDate.setDate(nextDate.getDate() + 1)
  const prevDate = new Date(targetDate + 'T00:00:00')
  prevDate.setDate(prevDate.getDate() - 1)

  // Categorize projects
  const inProgress = projects.filter(p => p.start_date <= targetDate && p.end_date >= targetDate && p.status === 'in_progress')
  const preparing = projects.filter(p => p.start_date <= targetDate && p.end_date >= targetDate && p.status === 'preparation')
  const completingToday = projects.filter(p => p.end_date === targetDate && p.status !== 'completed')
  const startingToday = projects.filter(p => p.start_date === targetDate)

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  const sortFn = (a: typeof projects[0], b: typeof projects[0]) => priorityOrder[a.priority] - priorityOrder[b.priority]

  return (
    <div className="max-w-2xl mx-auto space-y-6">
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

      {/* Date Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => navigate(`/daily/${dateToStr(prevDate)}`)}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div>
            <h1 className="text-2xl font-bold text-gray-800">{formatMonthDay(targetDate)}</h1>
            <p className="text-gray-500">週{dayOfWeek}</p>
          </div>

          <button
            onClick={() => navigate(`/daily/${dateToStr(nextDate)}`)}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Quick date input */}
        <input
          type="date"
          defaultValue={targetDate}
          onChange={e => navigate(`/daily/${e.target.value}`)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-blue-400 mt-2"
        />
      </div>

      {/* Active projects */}
      {inProgress.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-blue-600 mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
            進行中（{inProgress.length}）
          </h2>
          <div className="space-y-3">
            {inProgress.sort(sortFn).map(p => (
              <ProjectCard
                key={p.id}
                project={p}
                onClick={() => navigate(`/project/${p.id}`)}
                onDelete={() => {
                  if (confirm(`確定刪除「${p.name}」？`)) remove(p.id)
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Preparing */}
      {preparing.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-yellow-600 mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block"></span>
            準備中（{preparing.length}）
          </h2>
          <div className="space-y-3">
            {preparing.sort(sortFn).map(p => (
              <ProjectCard
                key={p.id}
                project={p}
                onClick={() => navigate(`/project/${p.id}`)}
                onDelete={() => {
                  if (confirm(`確定刪除「${p.name}」？`)) remove(p.id)
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Ending today */}
      {completingToday.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-orange-500 mb-2 flex items-center gap-1.5">
            🔥 今天到期（{completingToday.length}）
          </h2>
          <div className="space-y-3">
            {completingToday.sort(sortFn).map(p => (
              <ProjectCard
                key={p.id}
                project={p}
                onClick={() => navigate(`/project/${p.id}`)}
                onDelete={() => {
                  if (confirm(`確定刪除「${p.name}」？`)) remove(p.id)
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Starting today */}
      {startingToday.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-green-600 mb-2 flex items-center gap-1.5">
            🚀 今天啟動（{startingToday.length}）
          </h2>
          <div className="space-y-3">
            {startingToday.sort(sortFn).map(p => (
              <ProjectCard
                key={p.id}
                project={p}
                onClick={() => navigate(`/project/${p.id}`)}
                onDelete={() => {
                  if (confirm(`確定刪除「${p.name}」？`)) remove(p.id)
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* No projects */}
      {(inProgress.length === 0 && preparing.length === 0 && completingToday.length === 0 && startingToday.length === 0) && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <p className="text-lg mb-2">這天沒有專案活動</p>
          <p className="text-sm">在甘特圖點擊日期來查看當日專案</p>
        </div>
      )}

      {/* Add button */}
      <button
        onClick={() => {
          add({
            name: `今天新增的專案`,
            description: '',
            parent_id: null,
            start_date: targetDate,
            end_date: targetDate,
            status: 'preparation',
            priority: 'medium',
            tags: [],
            progress: 0,
          })
          navigate('/')
        }}
        className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors text-sm"
      >
        + 新增今天的專案
      </button>
    </div>
  )
}

export default DailyPage
