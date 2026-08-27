import { useParams, useNavigate } from 'react-router-dom'
import { useProjects } from '@/hooks/useProjects'
import { projectStore } from '@/data/localStorageStore'
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
  const target = new Date(targetDate + 'T00:00:00')

  const dayOfWeek = getDayOfWeek(targetDate)

  // ── Categories ──
  const inProgress = projects.filter(p => p.start_date <= targetDate && p.end_date >= targetDate && p.status === 'in_progress')
  const preparing = projects.filter(p => p.start_date <= targetDate && p.end_date >= targetDate && p.status === 'preparation')
  const completingToday = projects.filter(p => p.end_date === targetDate && p.status !== 'completed')
  const startingToday = projects.filter(p => p.start_date === targetDate)

  const priorityOrder = { high: 0, medium: 1, low: 2 }
  const sortFn = (a: typeof projects[0], b: typeof projects[0]) => priorityOrder[a.priority] - priorityOrder[b.priority]

  // ── Todos: today's incomplete ones ──
  const todayTodos = projectStore.getTodos().filter(t => !t.completed).sort((a, b) => a.sort_order - b.sort_order)

  // ── Milestones: today + next 14 days ──
  const twoWeeksLater = new Date(target)
  twoWeeksLater.setDate(twoWeeksLater.getDate() + 14)
  const futureMilestones = projectStore.getMilestones().filter(m => {
    const mDate = new Date(m.date + 'T00:00:00')
    return mDate >= target && mDate <= twoWeeksLater
  }).sort((a, b) => a.date.localeCompare(b.date))

  // ── Render helpers ──
  const remaining = getRemainingDays(targetDate)
  const remainingLabel = remaining === 0 ? '今天' : remaining > 0 ? `剩 ${remaining} 天` : `已過 ${Math.abs(remaining)} 天`

  return (
    <div className="space-y-4 md:flex md:gap-4 md:items-start">
      {/* Date Header — spans full width */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => {
              const prev = new Date(target)
              prev.setDate(prev.getDate() - 1)
              navigate(`/daily/${dateToStr(prev)}`)
            }}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div>
            <h1 className="text-2xl font-bold text-gray-800">{formatMonthDay(targetDate)}</h1>
            <p className="text-gray-500">
              週{dayOfWeek}
              {' · '}
              <span className={`font-medium ${
                remaining === 0 ? 'text-orange-500' :
                remaining > 0 ? 'text-green-500' :
                'text-red-500'
              }`}>
                {remainingLabel}
              </span>
            </p>
          </div>

          <button
            onClick={() => {
              const next = new Date(target)
              next.setDate(next.getDate() + 1)
              navigate(`/daily/${dateToStr(next)}`)
            }}
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

      {/* Three-column layout: Todos | Projects | Milestones */}
      <div className="flex flex-col gap-4 md:flex md:gap-4 md:items-start">
        {/* ── Left column: Todos ── */}
        <div className="md:w-64 flex-shrink-0 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-3">
              <svg className="w-4 h-4 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              待辦事項
              {todayTodos.length > 0 && (
                <span className="bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full text-xs">
                  {todayTodos.filter(t => !t.completed).length}/{todayTodos.length}
                </span>
              )}
            </h2>
            {todayTodos.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">暫無待辦事項</p>
            ) : (
              <div className="space-y-2">
                {todayTodos.map(todo => (
                  <div
                    key={todo.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                      todo.completed ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      todo.priority === 'high' ? 'text-red-600 bg-red-100' :
                      todo.priority === 'medium' ? 'text-yellow-600 bg-yellow-100' :
                      'text-gray-500 bg-gray-100'
                    }`}>
                      {todo.priority === 'high' ? '高' : todo.priority === 'medium' ? '中' : '低'}
                    </span>
                    <span className={`text-sm truncate ${todo.completed ? 'line-through' : ''}`}>
                      {todo.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add todo quick action */}
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 border-2 border-dashed border-teal-300 rounded-xl text-teal-400 hover:border-teal-500 hover:text-teal-600 transition-colors text-sm"
          >
            + 新增待辦事項
          </button>
        </div>

        {/* ── Middle column: Projects (wide) ── */}
        <div className="flex-1 min-w-0">
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

          {/* No projects placeholder */}
          {inProgress.length === 0 && preparing.length === 0 && completingToday.length === 0 && startingToday.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              <p className="text-sm">這天沒有專案活動</p>
            </div>
          )}
        </div>

        {/* ── Right column: Milestones / Activities ── */}
        <div className="md:w-64 flex-shrink-0">
          {futureMilestones.length > 0 ? (
            <div className="bg-white rounded-xl border border-purple-200">
              <h2 className="text-sm font-semibold text-purple-600 px-4 pt-4 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                近期活動
              </h2>
              <div className="space-y-2 px-4 pb-4">
                {futureMilestones.map(milestone => {
                  const mRemaining = getRemainingDays(milestone.date)
                  const mLabel = mRemaining === 0 ? '今天' : mRemaining > 0 ? `剩 ${mRemaining} 天` : `已過 ${Math.abs(mRemaining)} 天`
                  return (
                    <div key={milestone.id} className="flex items-start gap-2 py-2 border-b border-gray-100 last:border-b-0">
                      <div className="text-xs font-mono text-gray-400 w-11 flex-shrink-0 mt-0.5">{milestone.date.slice(5)}</div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-medium ${
                          mRemaining < 0 ? 'text-gray-400 line-through' : 'text-gray-800'
                        }`}>
                          {milestone.name}
                        </div>
                        {milestone.tags && milestone.tags.length > 0 && (
                          <div className="flex gap-0.5 mt-0.5">
                            {milestone.tags.map(tag => (
                              <span key={tag} className="text-[10px] text-purple-400 bg-purple-50 px-1 rounded">{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap ${
                        mRemaining < 0 ? 'bg-gray-100 text-gray-400' :
                        mRemaining <= 3 ? 'bg-red-100 text-red-600' :
                        'bg-purple-100 text-purple-600'
                      }`}>
                        {mLabel}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center text-gray-400">
              <p className="text-xs">近期無活動</p>
            </div>
          )}

          {/* Add activity quick action */}
          <button
            onClick={() => {
              projectStore.addMilestone({
                name: `今天新增的活動`,
                date: targetDate,
                tags: ['活動'],
                description: '',
              })
              navigate('/')
            }}
            className="w-full mt-3 py-3 border-2 border-dashed border-purple-300 rounded-xl text-gray-400 hover:border-purple-400 hover:text-purple-500 transition-colors text-sm"
          >
            + 新增活動
          </button>
        </div>
      </div>

      {/* Bottom: Add project button — spans full width */}
      <button
        onClick={() => {
          add({
            name: `今天新增的專案`,
            description: '',
            parent_id: null,
            sort_order: 0,
            start_date: targetDate,
            end_date: targetDate,
            status: 'preparation',
            priority: 'medium',
            tags: [],
            progress: 0,
          })
          navigate('/')
        }}
        className="w-full md:max-w-md self-center py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors text-sm"
      >
        + 新增今天的專案
      </button>
    </div>
  )
}

export default DailyPage
