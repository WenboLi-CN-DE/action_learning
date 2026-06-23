import type { MatchItem, ProjectItem, RequirementItem } from '../types'

export interface DashboardDataSet {
  projects: ProjectItem[]
  requirements: RequirementItem[]
  matches: MatchItem[]
}

export interface DashboardFilterInput extends DashboardDataSet {
  selectedTagId: number | null
}

export interface CoverageStatusCount {
  status: string
  count: number
  percentage: number
}

export interface DashboardStats {
  projectCount: number
  requirementCount: number
  matchCount: number
  matchedRequirementCount: number
  coverageRate: number
  statusCounts: CoverageStatusCount[]
}

const coverageStatuses = ['covered', 'partial', 'uncovered']

function hasTag(item: ProjectItem | RequirementItem, tagId: number) {
  return item.tags.some((tag) => tag.id === tagId)
}

export function filterDashboardDataByTag(input: DashboardFilterInput): DashboardDataSet {
  if (input.selectedTagId === null) {
    return {
      projects: input.projects,
      requirements: input.requirements,
      matches: input.matches,
    }
  }

  const projectIds = new Set(input.projects.filter((project) => hasTag(project, input.selectedTagId!)).map((project) => project.id))
  const requirementIds = new Set(
    input.requirements.filter((requirement) => hasTag(requirement, input.selectedTagId!)).map((requirement) => requirement.id),
  )

  return {
    projects: input.projects.filter((project) => projectIds.has(project.id)),
    requirements: input.requirements.filter((requirement) => requirementIds.has(requirement.id)),
    matches: input.matches.filter((match) => projectIds.has(match.project_id) || requirementIds.has(match.requirement_id)),
  }
}

export function buildDashboardStats(dataSet: DashboardDataSet): DashboardStats {
  const matchedRequirementIds = new Set(dataSet.matches.map((match) => match.requirement_id))
  const totalRequirements = dataSet.requirements.length
  const statusCounts = coverageStatuses.map((status) => {
    const count = dataSet.matches.filter((match) => match.coverage_status === status).length
    return {
      status,
      count,
      percentage: dataSet.matches.length === 0 ? 0 : Math.round((count / dataSet.matches.length) * 100),
    }
  })

  return {
    projectCount: dataSet.projects.length,
    requirementCount: totalRequirements,
    matchCount: dataSet.matches.length,
    matchedRequirementCount: matchedRequirementIds.size,
    coverageRate: totalRequirements === 0 ? 0 : Math.round((matchedRequirementIds.size / totalRequirements) * 100),
    statusCounts,
  }
}
