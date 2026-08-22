import type { Project } from '@/types/project'

export const SAMPLE_PROJECTS: Omit<Project, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    name: '115學年度制服採購案',
    description: '全校學生制服採購與發包專案',
    parent_id: null,
    start_date: '2026-09-01',
    end_date: '2027-02-28',
    status: 'preparation',
    priority: 'high',
    tags: ['採購', '行政', '學校'],
    progress: 10,
  },
  {
    name: '招標準備',
    description: '制服採購招標前作業',
    parent_id: 'p001',
    start_date: '2026-09-01',
    end_date: '2026-10-31',
    status: 'in_progress',
    priority: 'high',
    tags: ['採購', '招標'],
    progress: 30,
  },
  {
    name: '契約書撰寫',
    description: '擬定採購契約書草案',
    parent_id: 'p002',
    start_date: '2026-09-01',
    end_date: '2026-09-30',
    status: 'completed',
    priority: 'medium',
    tags: ['採購', '法務'],
    progress: 100,
  },
  {
    name: '底價訂定',
    description: '評估市場行情與底價估算',
    parent_id: 'p002',
    start_date: '2026-09-15',
    end_date: '2026-10-15',
    status: 'in_progress',
    priority: 'high',
    tags: ['採購', '財務'],
    progress: 50,
  },
  {
    name: 'TOEIC 備考',
    description: '博士班申請 TOEIC 考試準備',
    parent_id: null,
    start_date: '2026-11-01',
    end_date: '2027-01-20',
    status: 'in_progress',
    priority: 'high',
    tags: ['考試', '學校'],
    progress: 45,
  },
  {
    name: '博士班申請準備',
    description: '台大/東吳經濟學博士班申請',
    parent_id: null,
    start_date: '2026-12-01',
    end_date: '2027-03-15',
    status: 'preparation',
    priority: 'medium',
    tags: ['學校', '申請'],
    progress: 0,
  },
  {
    name: '程式交易系統開發',
    description: '基於本機看盤系統的程式交易策略開發',
    parent_id: null,
    start_date: '2026-08-01',
    end_date: '2027-06-30',
    status: 'in_progress',
    priority: 'medium',
    tags: ['開發', '投資', '程式'],
    progress: 15,
  },
]

// Assign IDs and timestamps
const IDS = ['p001', 'p002', 'p003', 'p004', 'p005', 'p006', 'p007']
const NOW = new Date().toISOString()

export const SAMPLE_PROJECTS_WITH_META: Project[] = SAMPLE_PROJECTS.map((p, i) => ({
  ...p,
  id: IDS[i],
  created_at: i === 0 ? '2026-08-15T10:00:00Z' : NOW,
  updated_at: i === 0 ? '2026-08-22T14:30:00Z' : NOW,
}))
