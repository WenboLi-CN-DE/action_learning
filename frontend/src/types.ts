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
  submitted_by: string | null
  assigned_reviewer: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  review_note: string | null
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
  source: 'manual' | 'ai'
  ai_score: number | null
  ai_reason: string | null
  ai_gaps: string[]
  ai_model: string | null
  created_by: string | null
  review_status: 'pending' | 'technical_pending' | 'final_pending' | 'approved' | 'rejected'
  reviewed_by: string | null
  reviewed_at: string | null
  review_note: string | null
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
  submitted_by?: string
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
  source?: 'manual' | 'ai'
  ai_score?: number
  ai_reason?: string
  ai_gaps?: string[]
  ai_model?: string
  created_by?: string
}

export interface AIMatchRecommendation {
  project_id: number
  project: ProjectItem
  score: number
  coverage_status: string
  reason: string
  gaps: string[]
  dimensions: Record<string, number>
  already_confirmed: boolean
}

export interface AIMatchResult {
  requirement_id: number
  model: string
  recommendations: AIMatchRecommendation[]
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

export interface LLMImageRecognitionResult {
  text: string
  model: string
}

export interface RAGChunk {
  chunk_id: string
  doc_id: string
  score: number
  text: string
  title: string | null
  source_type: string | null
  source_id: string | null
  tags: string[]
  owner_role: string | null
}

export interface RAGCitation {
  chunk_id: string
  doc_id: string
  title: string | null
  score: number
}

export interface RAGQueryResult {
  answer: string
  citations: RAGCitation[]
  retrieved_chunks: RAGChunk[]
}

export interface RAGRetrieveResult {
  chunks: RAGChunk[]
}

export interface RAGImportResult {
  doc_id: string
  chunk_count: number
  title: string
}

export interface ReviewEventItem {
  id: number
  target_type: 'requirement' | 'match'
  target_id: number
  action: string
  actor: string
  note: string | null
  from_status: string
  to_status: string
  created_at: string
}

export interface RAGDocumentItem {
  id: number
  doc_id: string
  title: string
  source_type: string
  source_id: string | null
  tags: string[]
  owner_role: string | null
  chunk_count: number
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatResult {
  answer: string
  citations: RAGCitation[]
  model: string
}
