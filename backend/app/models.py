from datetime import datetime, timezone
from typing import List, Optional

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
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    project: Optional[Project] = Relationship(back_populates="matches")
    requirement: Optional[Requirement] = Relationship(back_populates="matches")


class Comment(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    target_type: str = Field(max_length=50, index=True)
    target_id: int = Field(index=True)
    author: str = Field(max_length=100)
    content: str = Field(max_length=2000)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
