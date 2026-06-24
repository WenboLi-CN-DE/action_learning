from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter
from app.api.comments import router as comments_router
from app.api.health import router as health_router
from app.api.llm import router as llm_router
from app.api.matches import router as matches_router
from app.api.projects import router as projects_router
from app.api.requirements import router as requirements_router
from app.api.tags import router as tags_router
from app.database import create_db_and_tables

app = FastAPI(title="AI工坊平台", version="0.1.0")

# CORS 配置 — 允许 Vite dev server 跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Router 挂载
api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health_router, tags=["health"])
api_router.include_router(projects_router)
api_router.include_router(requirements_router)
api_router.include_router(tags_router)
api_router.include_router(matches_router)
api_router.include_router(comments_router)
api_router.include_router(llm_router)
app.include_router(api_router)

create_db_and_tables()

# Startup event — 自动建表
@app.on_event("startup")
def on_startup():
    create_db_and_tables()
