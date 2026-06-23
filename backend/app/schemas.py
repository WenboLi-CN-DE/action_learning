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
    status: str = "new"
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
    created_at: datetime
    updated_at: datetime
    tags: list[TagRead] = []


class MatchCreate(SQLModel):
    project_id: int
    requirement_id: int
    coverage_status: str
    note: str | None = None


class MatchUpdate(SQLModel):
    coverage_status: str | None = None
    note: str | None = None


class MatchRead(SQLModel):
    id: int
    project_id: int
    requirement_id: int
    coverage_status: str
    note: str | None
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
