import type {
  CommentItem,
  CommentPayload,
  MatchItem,
  MatchPayload,
  ProjectItem,
  ProjectPayload,
  RequirementItem,
  RequirementPayload,
  TagItem,
  TagPayload,
} from '../types'

const API_BASE = '/api/v1'

async function fetchJSON<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`)
  }
  return response.json()
}

// 健康检查
export const fetchHealth = () => fetchJSON<{ status: string; service: string; version: string }>('/health')

// 联调 demo 数据
export const fetchDemoData = () =>
  fetchJSON<{ id: number; name: string; description: string | null; created_at?: string }[]>('/demo')

export const fetchProjects = () => fetchJSON<ProjectItem[]>('/projects')

export const createProject = (payload: ProjectPayload) =>
  fetchJSON<ProjectItem>('/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const updateProject = (projectId: number, payload: ProjectPayload) =>
  fetchJSON<ProjectItem>(`/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

export const fetchRequirements = () => fetchJSON<RequirementItem[]>('/requirements')

export const createRequirement = (payload: RequirementPayload) =>
  fetchJSON<RequirementItem>('/requirements', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const updateRequirement = (requirementId: number, payload: RequirementPayload) =>
  fetchJSON<RequirementItem>(`/requirements/${requirementId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

export const fetchTags = () => fetchJSON<TagItem[]>('/tags')

export const createTag = (payload: TagPayload) =>
  fetchJSON<TagItem>('/tags', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const fetchMatches = () => fetchJSON<MatchItem[]>('/matches')

export const createMatch = (payload: MatchPayload) =>
  fetchJSON<MatchItem>('/matches', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const fetchComments = (targetType: CommentPayload['target_type'], targetId: number) =>
  fetchJSON<CommentItem[]>(`/comments?target_type=${targetType}&target_id=${targetId}`)

export const createComment = (payload: CommentPayload) =>
  fetchJSON<CommentItem>('/comments', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
