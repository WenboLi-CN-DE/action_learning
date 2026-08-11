from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import Column, JSON, Text
from sqlmodel import Field, Relationship, SQLModel

class DemoItem(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=200)
    description: str | None = Field(default=None, max_length=500)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ProjectTagLink(SQLModel, table=True):
    project_id: int | None = Field(default=None, foreign_key="project.id", primary_key=True)
    tag_id: int | None = Field(default=None, foreign_key="tag.id", primary_key=True)


class RequirementTagLink(SQLModel, table=True):
    requirement_id: int | None = Field(default=None, foreign_key="requirement.id", primary_key=True)
    tag_id: int | None = Field(default=None, foreign_key="tag.id", primary_key=True)


class Tag(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=100)
    category: str = Field(default="general", max_length=50)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    projects: List["Project"] = Relationship(back_populates="tags", link_model=ProjectTagLink)
    requirements: List["Requirement"] = Relationship(back_populates="tags", link_model=RequirementTagLink)


class Project(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    owner: str = Field(max_length=100)
    status: str = Field(default="researching", max_length=50)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    tags: List[Tag] = Relationship(back_populates="projects", link_model=ProjectTagLink)
    matches: List["ProjectRequirementMatch"] = Relationship(back_populates="project")


class Requirement(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    title: str = Field(max_length=200)
    description: str = Field(max_length=2000)
    customer: str = Field(max_length=200)
    contact: str | None = Field(default=None, max_length=100)
    urgency: str = Field(default="medium", max_length=50)
    status: str = Field(default="new", max_length=50)
    submitted_by: str | None = Field(default=None, max_length=100)
    assigned_reviewer: str | None = Field(default=None, max_length=100)
    reviewed_by: str | None = Field(default=None, max_length=100)
    reviewed_at: datetime | None = Field(default=None)
    review_note: str | None = Field(default=None, max_length=1000)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    tags: List[Tag] = Relationship(back_populates="requirements", link_model=RequirementTagLink)
    matches: List["ProjectRequirementMatch"] = Relationship(back_populates="requirement")


class ProjectRequirementMatch(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    requirement_id: int = Field(foreign_key="requirement.id", index=True)
    coverage_status: str = Field(max_length=50)
    note: str | None = Field(default=None, max_length=1000)
    source: str = Field(default="manual", max_length=20)
    ai_score: float | None = Field(default=None)
    ai_reason: str | None = Field(default=None, max_length=2000)
    ai_gaps: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    ai_model: str | None = Field(default=None, max_length=100)
    created_by: str | None = Field(default=None, max_length=100)
    review_status: str = Field(default="technical_pending", max_length=20)
    reviewed_by: str | None = Field(default=None, max_length=100)
    reviewed_at: datetime | None = Field(default=None)
    review_note: str | None = Field(default=None, max_length=1000)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    project: Optional[Project] = Relationship(back_populates="matches")
    requirement: Optional[Requirement] = Relationship(back_populates="matches")


class RequirementAIMatchRun(SQLModel, table=True):
    """一次 AI 匹配运行；候选结果持久化但不等同于正式关联。"""

    id: int | None = Field(default=None, primary_key=True)
    requirement_id: int = Field(foreign_key="requirement.id", index=True)
    model: str = Field(max_length=100)
    fallback_used: bool = Field(default=False)
    warnings: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=utc_now)


class RequirementAIMatchCandidate(SQLModel, table=True):
    """AI 匹配运行中的候选能力，不进入正式关联审核状态机。"""

    id: int | None = Field(default=None, primary_key=True)
    run_id: int = Field(foreign_key="requirementaimatchrun.id", index=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    score: float = Field(default=0.0)
    coverage_status: str = Field(max_length=50)
    reason: str = Field(default="", max_length=2000)
    gaps: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    dimensions: dict[str, float] = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=utc_now)


class Comment(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    target_type: str = Field(max_length=50, index=True)
    target_id: int = Field(index=True)
    author: str = Field(max_length=100)
    content: str = Field(max_length=2000)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class ReviewEvent(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    target_type: str = Field(max_length=30, index=True)
    target_id: int = Field(index=True)
    action: str = Field(max_length=30)
    actor: str = Field(max_length=100)
    note: str | None = Field(default=None, max_length=1000)
    from_status: str = Field(max_length=50)
    to_status: str = Field(max_length=50)
    created_at: datetime = Field(default_factory=utc_now)


class KnowledgeDocument(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    doc_id: str = Field(max_length=100, index=True)
    title: str = Field(max_length=300)
    content: str = Field(sa_column=Column(Text))
    source_type: str = Field(default="manual", max_length=50)
    source_id: str | None = Field(default=None, max_length=100)
    tags: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    owner_role: str | None = Field(default=None, max_length=100)
    chunk_count: int = Field(default=0)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
