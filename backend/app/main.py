from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import APIRouter
from app.api.health import router as health_router
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
app.include_router(api_router)

# Startup event — 自动建表
@app.on_event("startup")
def on_startup():
    create_db_and_tables()
