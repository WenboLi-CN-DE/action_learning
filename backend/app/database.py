import os

from sqlalchemy.pool import StaticPool
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
