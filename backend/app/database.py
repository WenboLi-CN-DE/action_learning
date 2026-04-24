from sqlmodel import SQLModel, Session, create_engine
from dotenv import load_dotenv

load_dotenv()  # 在 engine 创建前加载 .env

sqlite_url = "sqlite:///./database.db"
connect_args = {"check_same_thread": False}  # SQLite 多线程必需

engine = create_engine(sqlite_url, echo=True, connect_args=connect_args)

def get_session():
    with Session(engine) as session:
        yield session

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
