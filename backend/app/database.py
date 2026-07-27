import os

from sqlalchemy.pool import StaticPool
from sqlalchemy import inspect, text
from sqlmodel import SQLModel, Session, create_engine
from dotenv import load_dotenv

load_dotenv()  # 在 engine 创建前加载 .env

sqlite_url = os.getenv("DATABASE_URL", "sqlite:///./database.db")
connect_args = {"check_same_thread": False}  # SQLite 多线程必需

engine_kwargs = {"echo": True, "connect_args": connect_args}
if sqlite_url == "sqlite:///:memory:":
    engine_kwargs["poolclass"] = StaticPool

engine = create_engine(sqlite_url, **engine_kwargs)

def get_session():
    with Session(engine) as session:
        yield session

def create_db_and_tables():
    import app.models  # noqa: F401

    SQLModel.metadata.create_all(engine)
    _add_legacy_columns()


def _add_columns(table_name: str, additions: dict[str, str]) -> None:
    columns = {column["name"] for column in inspect(engine).get_columns(table_name)}
    with engine.begin() as connection:
        for name, definition in additions.items():
            if name not in columns:
                connection.execute(
                    text(f"ALTER TABLE {table_name} ADD COLUMN {name} {definition}")
                )


def _add_legacy_columns():
    """为现有 SQLite MVP 数据库补充字段；正式迁移到 PostgreSQL 前改用 Alembic。"""
    if not sqlite_url.startswith("sqlite"):
        return
    _add_columns(
        "requirement",
        {
            "submitted_by": "VARCHAR(100)",
            "assigned_reviewer": "VARCHAR(100)",
            "reviewed_by": "VARCHAR(100)",
            "reviewed_at": "DATETIME",
            "review_note": "VARCHAR(1000)",
        },
    )
    _add_columns(
        "projectrequirementmatch",
        {
            "source": "VARCHAR(20) NOT NULL DEFAULT 'manual'",
            "ai_score": "FLOAT",
            "ai_reason": "VARCHAR(2000)",
            "ai_gaps": "JSON NOT NULL DEFAULT '[]'",
            "ai_model": "VARCHAR(100)",
            "created_by": "VARCHAR(100)",
            "review_status": "VARCHAR(20) NOT NULL DEFAULT 'approved'",
            "reviewed_by": "VARCHAR(100)",
            "reviewed_at": "DATETIME",
            "review_note": "VARCHAR(1000)",
        },
    )
