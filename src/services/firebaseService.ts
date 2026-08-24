// Firebase 數據持久化模組
// 使用 Firebase Firestore 實現跨裝置數據同步

import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore'
import type { Project } from '@/types/project'

// Firebase 設定
const firebaseConfig = {
  apiKey: "AIzaSyDl04BiJfifzgPSmRNU3KJUwEFjzflE5No",
  authDomain: "kanban-board-8c1f0.firebaseapp.com",
  projectId: "kanban-board-8c1f0",
  storageBucket: "kanban-board-8c1f0.firebasestorage.app",
  messagingSenderId: "664205156011",
  appId: "1:664205156011:web:17b38841c6ad531e94e1ee"
}

// 初始化 Firebase
const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)

// 集合名稱
export const PROJECTS_COLLECTION = 'projects'

// 監聽 Firestore 數據變化
export function syncWithFirestore(): (() => void) {
  const projectsRef = collection(db, PROJECTS_COLLECTION)
  const q = query(projectsRef, orderBy('created_at', 'asc'))
  
  return onSnapshot(q, (snapshot) => {
    const projects: Project[] = []
    snapshot.forEach((doc) => {
      const data = doc.data()
      projects.push({
        id: doc.id,
        ...data,
        actual_start_date: data.actual_start_date || undefined,
        actual_end_date: data.actual_end_date || undefined
      } as Project)
    })
    
    // 更新本地狀態
    window.dispatchEvent(new CustomEvent('kanban:firebase-sync', { detail: projects }))
  }, (error) => {
    console.error('Firebase sync error:', error)
  })
}

// 新增專案到 Firestore
export async function addProjectToFirestore(project: Omit<Project, 'id'>): Promise<Project> {
  try {
    const now = new Date().toISOString()
    const projectWithTimestamp = {
      ...project,
      created_at: now,
      updated_at: now
    }
    
    const docRef = await addDoc(collection(db, PROJECTS_COLLECTION), projectWithTimestamp)
    
    return {
      ...project,
      id: docRef.id,
      created_at: now,
      updated_at: now
    } as Project
  } catch (error) {
    console.error('Error adding project:', error)
    throw error
  }
}

// 更新 Firestore 中的專案
export async function updateProjectInFirestore(id: string, updates: Partial<Project>): Promise<void> {
  try {
    const docRef = doc(db, PROJECTS_COLLECTION, id)
    await updateDoc(docRef, {
      ...updates,
      updated_at: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error updating project:', error)
    throw error
  }
}

// 刪除 Firestore 中的專案
export async function deleteProjectFromFirestore(id: string): Promise<void> {
  try {
    const docRef = doc(db, PROJECTS_COLLECTION, id)
    await deleteDoc(docRef)
  } catch (error) {
    console.error('Error deleting project:', error)
    throw error
  }
}
