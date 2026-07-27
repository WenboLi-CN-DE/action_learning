from __future__ import annotations

from datetime import datetime

from sqlmodel import SQLModel


class TagCreate(SQLModel):
    name: str
    category: str = "general"


class TagUpdate(SQLModel):
    name: str | None = None
    category: str | None = None


class TagRead(SQLModel):
    id: int
    name: str
    category: str
    created_at: datetime
    updated_at: datetime


class ProjectCreate(SQLModel):
    name: str
    description: str | None = None
    owner: str
    status: str = "researching"
    tag_ids: list[int] = []


class ProjectUpdate(SQLModel):
    name: str | None = None
    description: str | None = None
    owner: str | None = None
    status: str | None = None
    tag_ids: list[int] | None = None


class ProjectRead(SQLModel):
    id: int
    name: str
    description: str | None
    owner: str
    status: str
    created_at: datetime
    updated_at: datetime
    tags: list[TagRead] = []


class RequirementCreate(SQLModel):
    title: str
    description: str
    customer: str
    contact: str | None = None
    urgency: str = "medium"
    status: str = "draft"
    submitted_by: str | None = None
    tag_ids: list[int] = []


class RequirementUpdate(SQLModel):
    title: str | None = None
    description: str | None = None
    customer: str | None = None
    contact: str | None = None
    urgency: str | None = None
    status: str | None = None
    tag_ids: list[int] | None = None


class RequirementRead(SQLModel):
    id: int
    title: str
    description: str
    customer: str
    contact: str | None
    urgency: str
    status: str
    submitted_by: str | None
    assigned_reviewer: str | None
    reviewed_by: str | None
    reviewed_at: datetime | None
    review_note: str | None
    created_at: datetime
    updated_at: datetime
    tags: list[TagRead] = []


class MatchCreate(SQLModel):
    project_id: int
    requirement_id: int
    coverage_status: str
    note: str | None = None
    source: str = "manual"
    ai_score: float | None = None
    ai_reason: str | None = None
    ai_gaps: list[str] = []
    ai_model: str | None = None
    created_by: str | None = None


class MatchUpdate(SQLModel):
    coverage_status: str | None = None
    note: str | None = None


class MatchRead(SQLModel):
    id: int
    project_id: int
    requirement_id: int
    coverage_status: str
    note: str | None
    source: str
    ai_score: float | None
    ai_reason: str | None
    ai_gaps: list[str]
    ai_model: str | None
    created_by: str | None
    review_status: str
    reviewed_by: str | None
    reviewed_at: datetime | None
    review_note: str | None
    created_at: datetime
    updated_at: datetime
    project: ProjectRead
    requirement: RequirementRead


class CommentCreate(SQLModel):
    target_type: str
    target_id: int
    author: str
    content: str


class CommentRead(SQLModel):
    id: int
    target_type: str
    target_id: int
    author: str
    content: str
    created_at: datetime
    updated_at: datetime


class ReviewRequest(SQLModel):
    action: str
    reviewer: str
    note: str | None = None


class ReviewerAssignmentRequest(SQLModel):
    reviewer: str
    actor: str


class RequirementTransitionRequest(SQLModel):
    target_status: str
    actor: str
    note: str | None = None


class ReviewEventRead(SQLModel):
    id: int
    target_type: str
    target_id: int
    action: str
    actor: str
    note: str | None
    from_status: str
    to_status: str
    created_at: datetime


class LLMStatusRead(SQLModel):
    configured: bool
    model: str


class LLMOverride(SQLModel):
    api_key: str | None = None
    model: str | None = None
    base_url: str | None = None


class LLMStructureRequest(LLMOverride):
    raw_text: str


class LLMStructureResult(SQLModel):
    fields: dict[str, str | None] = {}
    missing_fields: list[str] = []
    follow_up_questions: list[str] = []
    warnings: list[str] = []
    model: str


class LLMImageRecognitionResult(SQLModel):
    text: str
    model: str


class AIMatchRequest(LLMOverride):
    top_k: int = 5


class AIMatchRecommendation(SQLModel):
    project_id: int
    project: ProjectRead
    score: float
    coverage_status: str
    reason: str
    gaps: list[str] = []
    dimensions: dict[str, float] = {}
    already_confirmed: bool = False


class AIMatchResult(SQLModel):
    requirement_id: int
    model: str
    recommendations: list[AIMatchRecommendation] = []


class RAGIngestRequest(SQLModel):
    title: str
    content: str
    source_type: str = "manual"
    source_id: str | None = None
    tags: list[str] = []
    owner_role: str | None = None


class RAGIngestResult(SQLModel):
    doc_id: str
    chunk_count: int


class RAGImportResult(SQLModel):
    doc_id: str
    chunk_count: int
    title: str


class RAGRetrieveRequest(SQLModel):
    query: str
    top_k: int = 5
    filters: dict[str, str | list[str] | None] = {}


class RAGQueryRequest(SQLModel):
    question: str
    top_k: int = 5
    filters: dict[str, str | list[str] | None] = {}


class RAGChunkRead(SQLModel):
    chunk_id: str
    doc_id: str
    score: float
    text: str
    title: str | None = None
    source_type: str | None = None
    source_id: str | None = None
    tags: list[str] = []
    owner_role: str | None = None


class RAGCitationRead(SQLModel):
    chunk_id: str
    doc_id: str
    title: str | None = None
    score: float


class RAGRetrieveResult(SQLModel):
    chunks: list[RAGChunkRead] = []


class RAGQueryResult(SQLModel):
    answer: str
    citations: list[RAGCitationRead] = []
    retrieved_chunks: list[RAGChunkRead] = []


class RAGDocumentRead(SQLModel):
    id: int
    doc_id: str
    title: str
    source_type: str
    source_id: str | None
    tags: list[str]
    owner_role: str | None
    chunk_count: int
    created_at: datetime
    updated_at: datetime


class RAGRebuildResult(SQLModel):
    document_count: int
    chunk_count: int


class ChatMessage(SQLModel):
    role: str
    content: str


class ChatRequest(LLMOverride):
    messages: list[ChatMessage]
    top_k: int = 5


class ChatResult(SQLModel):
    answer: str
    citations: list[RAGCitationRead] = []
    model: str
