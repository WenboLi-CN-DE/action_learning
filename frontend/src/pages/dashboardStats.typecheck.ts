import type { MatchItem, ProjectItem, RequirementItem, TagItem } from '../types'
import { buildDashboardStats, filterDashboardDataByTag } from './dashboardStats'

const industryTag: TagItem = {
  id: 1,
  name: '数据中心',
  category: 'industry',
  created_at: '2026-06-23T00:00:00Z',
  updated_at: '2026-06-23T00:00:00Z',
}

const project: ProjectItem = {
  id: 10,
  name: '能效预研',
  description: null,
  owner: '研发',
  status: 'researching',
  created_at: '2026-06-23T00:00:00Z',
  updated_at: '2026-06-23T00:00:00Z',
  tags: [industryTag],
}

const requirement: RequirementItem = {
  id: 20,
  title: '客户节能需求',
  description: '需要节能方案',
  customer: '示例客户',
  contact: null,
  urgency: 'high',
  status: 'new',
  created_at: '2026-06-23T00:00:00Z',
  updated_at: '2026-06-23T00:00:00Z',
  tags: [industryTag],
}

const match: MatchItem = {
  id: 30,
  project_id: project.id,
  requirement_id: requirement.id,
  coverage_status: 'covered',
  note: null,
  created_at: '2026-06-23T00:00:00Z',
  updated_at: '2026-06-23T00:00:00Z',
  project,
  requirement,
}

const scopedData = filterDashboardDataByTag({
  selectedTagId: industryTag.id,
  projects: [project],
  requirements: [requirement],
  matches: [match],
})

export const dashboardStatsSmoke = buildDashboardStats(scopedData)
