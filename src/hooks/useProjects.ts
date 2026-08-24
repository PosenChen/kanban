import { useState, useEffect, useCallback } from 'react'
import { projectStore } from '@/data/localStorageStore'
import { isFirebaseEnabled } from '@/data/localStorageStore'
import type { Project } from '@/types/project'

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>(() => projectStore.getAll())
  const [isSyncing, setIsSyncing] = useState(false)
  const [firebaseConnected, setFirebaseConnected] = useState(false)

  // 初始化 Firebase 同步
  useEffect(() => {
    if (isFirebaseEnabled()) {
      setIsSyncing(true)
      
      // 動態導入 Firebase 服務
      import('@/services/firebaseService').then(({ syncWithFirestore }) => {
        const unsubscribe = syncWithFirestore()
        setFirebaseConnected(true)
        
        // 返回清理函數
        return () => {
          unsubscribe()
          setFirebaseConnected(false)
        }
      }).catch((error) => {
        console.error('Failed to initialize Firebase sync:', error)
        setIsSyncing(false)
      })
    }
  }, [])

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

  // 監聽 Firebase 同步事件
  useEffect(() => {
    const firebaseHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail as Project[] | undefined
      if (detail) {
        setProjects([...detail])
        setIsSyncing(false)
      }
    }
    window.addEventListener('kanban:firebase-sync', firebaseHandler)
    return () => window.removeEventListener('kanban:firebase-sync', firebaseHandler)
  }, [])

  // 同步數據到 Firebase
  const syncToFirebase = useCallback(async (updatedProjects: Project[]) => {
    if (!isFirebaseEnabled() || isSyncing) return
    
    setIsSyncing(true)
    
    try {
      // 動態導入 Firebase 服務
      const firebaseService = await import('@/services/firebaseService')
      
      // 這裡應該實現 Firebase 同步邏輯
      // 由於需要完整的 Firebase 設置，這裡只展示基本結構
      
      // 實際實現應該：
      // 1. 獲取所有本地專案
      // 2. 上傳到 Firestore
      // 3. 處理衝突和同步狀態
      
      setTimeout(() => {
        setIsSyncing(false)
      }, 1000)
    } catch (error) {
      console.error('Firebase sync error:', error)
      setIsSyncing(false)
    }
  }, [isSyncing])

  // 監聽數據變更並同步到 Firebase
  useEffect(() => {
    if (isFirebaseEnabled() && !isSyncing && projects.length > 0) {
      const timer = setTimeout(() => {
        syncToFirebase(projects)
      }, 3000)
      
      return () => clearTimeout(timer)
    }
  }, [projects, isFirebaseEnabled, isSyncing, syncToFirebase])

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
    isSyncing,
    firebaseConnected,
  }
}
