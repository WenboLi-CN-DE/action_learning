import type {
  AIMatchResult,
  ChatMessage,
  ChatResult,
  CommentItem,
  CommentPayload,
  LLMImageRecognitionResult,
  LLMSettings,
  LLMStatus,
  LLMStructureResult,
  MatchItem,
  MatchPayload,
  PilotMetrics,
  PilotTaskResponse,
  ProjectItem,
  ProjectPayload,
  RAGDocumentItem,
  RAGImportResult,
  RAGQueryResult,
  RAGRetrieveResult,
  RequirementItem,
  RequirementPayload,
  ReviewEventItem,
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
    const payload = await response.json().catch(() => null)
    const detail = typeof payload?.detail === 'string' ? payload.detail : null
    throw new Error(detail ?? `API Error: ${response.status} ${response.statusText}`)
  }
  if (response.status === 204) return undefined as T
  return response.json()
}

async function fetchFormData<T>(path: string, formData: FormData): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    body: formData,
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const detail = typeof payload?.detail === 'string' ? payload.detail : null
    throw new Error(detail ?? `API Error: ${response.status} ${response.statusText}`)
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

export const fetchLatestRequirementMatches = (requirementId: number) =>
  fetchJSON<AIMatchResult | null>(`/requirements/${requirementId}/ai-matches/latest`)

export const fetchPilotTasks = (role: PilotTaskResponse['role'], actor: string) => {
  const params = new URLSearchParams({ role, actor })
  return fetchJSON<PilotTaskResponse>(`/pilot/tasks?${params.toString()}`)
}

export const fetchPilotMetrics = () => fetchJSON<PilotMetrics>('/pilot/metrics')

export const createMatch = (payload: MatchPayload) =>
  fetchJSON<MatchItem>('/matches', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const reviewRequirement = (
  requirementId: number,
  payload: { action: 'approve' | 'return'; reviewer: string; note?: string },
) =>
  fetchJSON<RequirementItem>(`/requirements/${requirementId}/review`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const assignRequirementReviewer = (
  requirementId: number,
  payload: { reviewer: string; actor: string },
) =>
  fetchJSON<RequirementItem>(`/requirements/${requirementId}/assign-reviewer`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const transitionRequirement = (
  requirementId: number,
  payload: { target_status: string; actor: string; note?: string },
) =>
  fetchJSON<RequirementItem>(`/requirements/${requirementId}/transition`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const reviewMatch = (
  matchId: number,
  payload: {
    action: 'technical_approve' | 'technical_reject' | 'final_approve' | 'final_reject'
    reviewer: string
    note?: string
  },
) =>
  fetchJSON<MatchItem>(`/matches/${matchId}/review`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const fetchReviewEvents = (targetType: 'requirement' | 'match', targetId: number) =>
  fetchJSON<ReviewEventItem[]>(`/review-events?target_type=${targetType}&target_id=${targetId}`)

export const analyzeRequirementMatches = (
  requirementId: number,
  topK: number,
  settings: LLMSettings | null,
) =>
  fetchJSON<AIMatchResult>(`/requirements/${requirementId}/ai-matches`, {
    method: 'POST',
    body: JSON.stringify({ top_k: topK, ...(settings ?? {}) }),
  })

type AIMatchStreamEvent =
  | { type: 'progress'; message: string }
  | { type: 'content'; text: string }
  | { type: 'result'; result: AIMatchResult }

function parseAIMatchStreamEvent(block: string): AIMatchStreamEvent | null {
  const event = block.match(/^event: (.+)$/m)?.[1]
  const data = block.match(/^data: (.+)$/m)?.[1]
  if (!event || !data) return null
  const payload = JSON.parse(data) as Record<string, unknown>
  if (event === 'progress' && typeof payload.message === 'string') return { type: 'progress', message: payload.message }
  if (event === 'content' && typeof payload.text === 'string') return { type: 'content', text: payload.text }
  if (event === 'result') return { type: 'result', result: payload as unknown as AIMatchResult }
  return null
}

export async function analyzeRequirementMatchesStream(
  requirementId: number,
  topK: number,
  settings: LLMSettings | null,
  onEvent: (event: AIMatchStreamEvent) => void,
): Promise<AIMatchResult> {
  const response = await fetch(`${API_BASE}/requirements/${requirementId}/ai-matches/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ top_k: topK, ...(settings ?? {}) }),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const detail = typeof payload?.detail === 'string' ? payload.detail : null
    throw new Error(detail ?? `API Error: ${response.status} ${response.statusText}`)
  }
  if (!response.body) throw new Error('AI 匹配未返回流式响应')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let pending = ''
  let result: AIMatchResult | null = null
  while (true) {
    const { value, done } = await reader.read()
    pending += decoder.decode(value, { stream: !done })
    const blocks = pending.split('\n\n')
    pending = blocks.pop() ?? ''
    for (const block of blocks) {
      const event = parseAIMatchStreamEvent(block)
      if (!event) continue
      onEvent(event)
      if (event.type === 'result') result = event.result
    }
    if (done) break
  }
  if (!result) throw new Error('AI 匹配未返回最终结果')
  return result
}

export const fetchComments = (targetType: CommentPayload['target_type'], targetId: number) =>
  fetchJSON<CommentItem[]>(`/comments?target_type=${targetType}&target_id=${targetId}`)

export const createComment = (payload: CommentPayload) =>
  fetchJSON<CommentItem>('/comments', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const fetchLLMStatus = () => fetchJSON<LLMStatus>('/llm/status')

export const structureRequirement = (rawText: string, settings: LLMSettings | null) =>
  fetchJSON<LLMStructureResult>('/llm/structure-requirement', {
    method: 'POST',
    body: JSON.stringify({ raw_text: rawText, ...(settings ?? {}) }),
  })

export const structureProject = (rawText: string, settings: LLMSettings | null) =>
  fetchJSON<LLMStructureResult>('/llm/structure-project', {
    method: 'POST',
    body: JSON.stringify({ raw_text: rawText, ...(settings ?? {}) }),
  })

export const recognizeImage = (file: File, prompt: string, settings: LLMSettings | null) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('prompt', prompt)
  if (settings?.api_key) formData.append('api_key', settings.api_key)
  if (settings?.model) formData.append('model', settings.model)
  if (settings?.base_url) formData.append('base_url', settings.base_url)
  return fetchFormData<LLMImageRecognitionResult>('/llm/recognize-image', formData)
}

// RAG 知识检索
export const ragQuery = (question: string, topK = 5, filters: Record<string, unknown> = {}) =>
  fetchJSON<RAGQueryResult>('/rag/query', {
    method: 'POST',
    body: JSON.stringify({ question, top_k: topK, filters }),
  })

export const ragRetrieve = (query: string, topK = 5, filters: Record<string, unknown> = {}) =>
  fetchJSON<RAGRetrieveResult>('/rag/retrieve', {
    method: 'POST',
    body: JSON.stringify({ query, top_k: topK, filters }),
  })

export const importRAGFile = (
  file: File,
  options: { source_type?: string; source_id?: string; tags?: string; owner_role?: string },
) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('source_type', options.source_type ?? 'manual')
  if (options.source_id) formData.append('source_id', options.source_id)
  if (options.tags) formData.append('tags', options.tags)
  if (options.owner_role) formData.append('owner_role', options.owner_role)
  return fetchFormData<RAGImportResult>('/rag/import-file', formData)
}

export const fetchRAGDocuments = () => fetchJSON<RAGDocumentItem[]>('/rag/documents')

export const deleteRAGDocument = (documentId: number) =>
  fetchJSON<void>(`/rag/documents/${documentId}`, { method: 'DELETE' })

export const rebuildRAGIndex = () =>
  fetchJSON<{ document_count: number; chunk_count: number }>('/rag/rebuild', {
    method: 'POST',
    body: JSON.stringify({}),
  })

export const chatWithKnowledge = (messages: ChatMessage[], settings: LLMSettings | null) =>
  fetchJSON<ChatResult>('/chat', {
    method: 'POST',
    body: JSON.stringify({ messages, ...(settings ?? {}) }),
  })
