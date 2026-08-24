import { useState, useEffect, useCallback } from 'react'
import { projectStore } from '@/data/localStorageStore'
import type { Project } from '@/types/project'

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>(() => projectStore.getAll())

  // 從 store 同步數據
  useEffect(() => {
    setProjects(projectStore.getAll())
  }, [])

  // 監聽數據變更事件
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as Project[] | undefined
      if (detail) setProjects([...detail])
    }
    window.addEventListener('kanban:data-change', handler)
    return () => window.removeEventListener('kanban:data-change', handler)
  }, [])

  return {
    projects,
    add: useCallback(
      (p: Omit<Project, 'id' | 'created_at' | 'updated_at'>) => {
        const newP = projectStore.add(p)
        setProjects(prev => [...prev, newP])
      },
      [],
    ),
    update: useCallback(
      (id: string, updates: Partial<Project>) => {
        const updated = projectStore.update(id, updates)
        if (updated) setProjects(prev => prev.map(p => (p.id === id ? updated : p)))
      },
      [],
    ),
    remove: useCallback((id: string) => {
      projectStore.remove(id)
      setProjects(prev => prev.filter(p => p.id !== id))
    }, []),
    getByParent: useCallback((parentId: string | null) => projectStore.getByParent(parentId), []),
    getByDate: useCallback((date: string) => projectStore.getByDate(date), []),
    getByTag: useCallback((tag: string) => projectStore.getByTag(tag), []),
    search: useCallback((q: string) => projectStore.search(q), []),
    filter: useCallback((status?: string, priority?: string) => projectStore.filter(status, priority), []),
    getRootProjects: useCallback(() => projectStore.getRootProjects(), []),
    getChildren: useCallback((projectId: string) => projectStore.getChildren(projectId), []),
    getById: useCallback((id: string) => projectStore.getById(id), []),
    getAll: useCallback(() => projectStore.getAll(), []),
  }
}
