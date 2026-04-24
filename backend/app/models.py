from __future__ import annotations
from datetime import datetime, timezone
from sqlmodel import SQLModel, Field

class DemoItem(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=200)
    description: str | None = Field(default=None, max_length=500)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
