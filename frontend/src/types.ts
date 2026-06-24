export interface TagItem {
  id: number
  name: string
  category: string
  created_at: string
  updated_at: string
}

export interface ProjectItem {
  id: number
  name: string
  description: string | null
  owner: string
  status: string
  created_at: string
  updated_at: string
  tags: TagItem[]
}

export interface RequirementItem {
  id: number
  title: string
  description: string
  customer: string
  contact: string | null
  urgency: string
  status: string
  created_at: string
  updated_at: string
  tags: TagItem[]
}

export interface MatchItem {
  id: number
  project_id: number
  requirement_id: number
  coverage_status: string
  note: string | null
  created_at: string
  updated_at: string
  project: ProjectItem
  requirement: RequirementItem
}

export interface ProjectPayload {
  name: string
  description?: string
  owner: string
  status: string
  tag_ids: number[]
}

export interface RequirementPayload {
  title: string
  description: string
  customer: string
  contact?: string
  urgency: string
  status: string
  tag_ids: number[]
}

export interface TagPayload {
  name: string
  category: string
}

export interface MatchPayload {
  project_id: number
  requirement_id: number
  coverage_status: string
  note?: string
}

export type CommentTargetType = 'project' | 'requirement'

export interface CommentItem {
  id: number
  target_type: CommentTargetType
  target_id: number
  author: string
  content: string
  created_at: string
  updated_at: string
}

export interface CommentPayload {
  target_type: CommentTargetType
  target_id: number
  author: string
  content: string
}

export interface LLMSettings {
  api_key?: string
  model?: string
  base_url?: string
}

export interface LLMStatus {
  configured: boolean
  model: string
}

export interface LLMStructureRequest extends LLMSettings {
  raw_text: string
}

export interface LLMStructureResult {
  fields: Record<string, string | null>
  missing_fields: string[]
  follow_up_questions: string[]
  warnings: string[]
  model: string
}
