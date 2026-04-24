# Architecture Patterns

**Domain:** 企业信息透明化/内部协作平台（内网部署）
**Researched:** 2026-04-24
**Confidence:** HIGH（基于 Context7 官方文档、GitHub 开源模板验证、多源交叉验证）

## Recommended Architecture

**风格：单体三层架构（Three-Layer Monolith）**

本平台初期数据量极小（5-20条），团队人力有限，无需微服务拆分。采用经典三层架构：前端 UI 层 → 后端 API 层 → 数据存储层，单体部署在公司内网一台服务器上即可运行。

```
┌──────────────────────────────────────────────────────────┐
│                     浏览器（内网用户）                      │
│  销售 | 咨询 | 研发 | 技术支持 | 解决方案工程师            │
└──────────────────────┬───────────────────────────────────┘
                       │ HTTP REST API
                       ▼
┌──────────────────────────────────────────────────────────┐
│              前端层（React + Vite SPA）                    │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │ Dashboard │  │ Projects │  │ Demands  │               │
│  │   Panel   │  │   Page   │  │   Page   │               │
│  └──────────┘  └──────────┘  └──────────┘               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │ Matching  │  │Collabor- │  │ Feedback │               │
│  │   View    │  │ ations   │  │   Form   │               │
│  └──────────┘  └──────────┘  └──────────┘               │
│                                                          │
│  API Service Layer ← fetch/axios → 后端                  │
└──────────────────────┬───────────────────────────────────┘
                       │ REST JSON /api/v1/*
                       ▼
┌──────────────────────────────────────────────────────────┐
│              后端层（FastAPI 单体应用）                     │
│                                                          │
│  ┌─────────────────┐  ┌─────────────────┐               │
│  │  API Router 层   │  │  业务逻辑层      │               │
│  │  /projects      │  │  CRUD 操作       │               │
│  │  /demands       │  │  匹配计算       │               │
│  │  /tags          │  │  状态变更       │               │
│  │  /collaborations│  │  数据聚合       │               │
│  │  /dashboard     │  │                 │               │
│  └─────────────────┘  └─────────────────┘               │
│                                                          │
│  ┌─────────────────────────────────────────┐             │
│  │  数据模型层（SQLModel ORM）              │             │
│  │  Project | Demand | Tag | Collaboration │             │
│  │  DemandProjectLink | DemandTagLink      │             │
│  └─────────────────────────────────────────┘             │
└──────────────────────┬───────────────────────────────────┘
                       │ SQLModel Engine
                       ▼
┌──────────────────────────────────────────────────────────┐
│              数据存储层（SQLite 文件数据库）                 │
│                                                          │
│  database.db  ← 单文件，零运维，内网部署极简                │
│  自动建表（SQLModel.metadata.create_all）                  │
└──────────────────────────────────────────────────────────┘
```

### Architecture 决策理由

| 决策 | 选择 | 理由 | 置信度 |
|------|------|------|---------|
| 架构风格 | 单体三层 | 数据量5-20条、管培生团队、内网部署——拆分微服务纯属过度工程 | HIGH |
| ORM | SQLModel | 同一模型同时是 SQLAlchemy 表定义和 Pydantic 验证模型，消除 FastAPI+Pydantic+SQLAlchemy 三层重复定义 | HIGH（Context7 + 官方模板验证） |
| 数据库 | SQLite | 单机、内网、5-20条数据量。SQLite 零运维、单文件拷贝即部署。正式的 full-stack-fastapi-template 社区模板在单机场景也推荐 SQLite | HIGH |
| API风格 | REST JSON | 非 WebSocket/实时推送（MVP 无推送需求）。标准 REST CRUD 最简单直接 | HIGH |
| 前端路由 | SPA + React Router | 内部工具不需要 SEO，SPA 交互体验流畅 | HIGH |
| 开发代理 | Vite proxy `/api` | 开发时前端 5173 → 8000 代理，避免 CORS 问题。Context7 Vite 官方文档明确支持此模式 | HIGH |

---

## Component Boundaries

### 后端组件

| 组件 | Responsibility | Communicates With | 关键文件 |
|------|---------------|-------------------|---------|
| **main.py** | 应用入口、启动配置、中间件注册、路由挂载 | 所有 Router | `backend/app/main.py` |
| **models.py** | 数据模型定义（SQLModel table=True + schema 模型） | CRUD 层、Router 层 | `backend/app/models.py` |
| **database.py** | 数据库引擎、session 管理、建表 | models.py、CRUD 层 | `backend/app/database.py` |
| **crud.py** | 业务逻辑 CRUD 操作（查询、创建、更新、删除） | models.py、Router 层 | `backend/app/crud.py` |
| **api/projects.py** | 预研项目 REST API 路由 | crud.py、models.py | `backend/app/api/projects.py` |
| **api/demands.py** | 客户需求 REST API 路由 | crud.py、models.py | `backend/app/api/demands.py` |
| **api/tags.py** | 行业/业务线标签 CRUD 路由 | crud.py、models.py | `backend/app/api/tags.py` |
| **api/collaborations.py** | 协作记录 REST API 路由 | crud.py、models.py | `backend/app/api/collaborations.py` |
| **api/matching.py** | 需求-项目匹配查询路由 | crud.py（聚合查询） | `backend/app/api/matching.py` |
| **api/dashboard.py** | 汇总面板聚合数据路由 | crud.py（跨表聚合） | `backend/app/api/dashboard.py` |

### 前端组件

| 组件 | Responsibility | Communicates With | 关键文件 |
|------|---------------|-------------------|---------|
| **App.jsx** | 全局布局、路由注册、全局状态 | 所有页面组件 | `frontend/src/App.jsx` |
| **DashboardPage** | 汇总面板——显示项目+需求概览、匹配统计 | API service → `/api/dashboard` | `frontend/src/pages/DashboardPage.jsx` |
| **ProjectsPage** | 预研项目列表 + 详情 + 状态编辑 | API service → `/api/projects` | `frontend/src/pages/ProjectsPage.jsx` |
| **DemandsPage** | 客户需求列表 + 详情 + 需求提交表单 | API service → `/api/demands` | `frontend/src/pages/DemandsPage.jsx` |
| **MatchingPage** | 需求-项目匹配视图，按行业标签筛选 | API service → `/api/matching` | `frontend/src/pages/MatchingPage.jsx` |
| **CollaborationsPage** | 协作记录列表 + 新增记录 | API service → `/api/collaborations` | `frontend/src/pages/CollaborationsPage.jsx` |
| **api.js** | 统一 API 请求层（fetch/axios封装） | 后端 REST API | `frontend/src/services/api.js` |

### 数据存储组件

| 组件 | Responsibility | 关键说明 |
|------|---------------|---------|
| **SQLite database.db** | 所有业务数据持久化 | 单文件、零配置、随代码拷贝部署 |
| **SQLModel engine** | ORM 连接管理、建表 | `create_engine` + `metadata.create_all` |

---

## Data Flow

### 核心数据流方向

```
信息录入流：
  用户（前端表单） → React Page → API service → FastAPI Router → CRUD → SQLModel → SQLite

信息查询流：
  用户（浏览/筛选） → React Page → API service → FastAPI Router → CRUD → SQLModel → SQLite → JSON Response → React 渲染

匹配聚合流：
  用户（查看匹配） → MatchingPage → API service → `/api/matching` → 聚合 CRUD → SQLModel 跨表查询 → SQLite → JSON → React 渲染

汇总面板流：
  用户（打开首页） → DashboardPage → API service → `/api/dashboard` → 聚合 CRUD → 多表统计 → SQLite → JSON → React 渲染
```

### 数据模型关系图

```
┌─────────────┐     ┌───────────────────┐     ┌─────────────┐
│   Project    │     │ DemandProjectLink │     │   Demand    │
│ (预研项目)   │────←│  (匹配关联)        │←────│ (客户需求)  │
│              │     │  project_id (FK)  │     │             │
│ id           │     │  demand_id (FK)   │     │ id          │
│ name         │     │  match_type       │     │ title       │
│ description  │     │  match_note       │     │ description │
│ status       │     └───────────────────┘     │ customer    │
│ business_line│                               │ submitter   │
│ created_at   │                               │ priority    │
│ updated_at   │                               │ status      │
└─────────────┘                               │ created_at  │
       │                                       │ updated_at  │
       │                                       └─────────────┘
       │                                              │
       │    ┌──────────────────┐                      │
       │    │   DemandTagLink   │                      │
       │    │  (需求标签关联)    │                      │
       │    │  demand_id (FK)  │←─────────────────────│
       │    │  tag_id (FK)     │←─────────┐           │
       │    └──────────────────┘          │           │
       │                                  │           │
       │    ┌──────────────────┐          │           │
       │    │ ProjectTagLink   │          │           │
       │    │  (项目标签关联)   │          │           │
       │    │  project_id (FK) │←─────────│           │
       │    │  tag_id (FK)     │←─────┐   │           │
       │    └──────────────────┘      │   │           │
       │                              │   │           │
       └──────────────────────┬───────┘   │           │
                              │           │           │
                    ┌─────────▼─────────┐ │           │
                    │      Tag          │ │           │
                    │ (行业/业务线标签)  │←─┘           │
                    │                   │             │
                    │ id                │             │
                    │ name              │             │
                    │ category          │             │
                    └───────────────────┘             │
                                                      │
┌───────────────────────────┐                         │
│     Collaboration         │                         │
│   (协作记录)              │                         │
│                           │                         │
│ id                        │                         │
│ title                     │                         │
│ content                   │                         │
│ related_demand_id (FK)    │←────────────────────────│
│ related_project_id (FK)   │←────────────────────────│
│ participants              │                         │
│ decision_summary          │                         │
│ created_at                │                         │
│ updated_at                │                         │
└───────────────────────────┘
```

### API 端点设计

```python
# 路由结构（遵循 FastAPI APIRouter 最佳实践）

api_router = APIRouter(prefix="/api/v1")

# 项目 CRUD
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
#   GET    /api/v1/projects          — 项目列表（支持 business_line 篮选）
#   GET    /api/v1/projects/{id}     — 项目详情
#   POST   /api/v1/projects          — 新增项目
#   PATCH  /api/v1/projects/{id}     — 更新项目（含状态变更）
#   DELETE /api/v1/projects/{id}     — 删除项目

# 需求 CRUD
api_router.include_router(demands.router, prefix="/demands", tags=["demands"])
#   GET    /api/v1/demands           — 需求列表（支持 tag 篮选）
#   GET    /api/v1/demands/{id}      — 需求详情
#   POST   /api/v1/demands           — 新增需求（前端反馈通道核心）
#   PATCH  /api/v1/demands/{id}      — 更新需求（含状态变更）
#   DELETE /api/v1/demands/{id}      — 删除需求

# 标签 CRUD
api_router.include_router(tags.router, prefix="/tags", tags=["tags"])
#   GET    /api/v1/tags              — 标签列表
#   POST   /api/v1/tags              — 新增标签
#   PATCH  /api/v1/tags/{id}         — 更新标签
#   DELETE /api/v1/tags/{id}         — 删除标签

# 匹配关联
api_router.include_router(matching.router, prefix="/matching", tags=["matching"])
#   GET    /api/v1/matching          — 所有匹配列表
#   GET    /api/v1/matching/by-demand/{id} — 某需求匹配的项目
#   GET    /api/v1/matching/by-project/{id} — 某项目匹配的需求
#   POST   /api/v1/matching          — 创建/更新匹配关联
#   DELETE /api/v1/matching/{id}     — 删除匹配

# 协作记录
api_router.include_router(collaborations.router, prefix="/collaborations", tags=["collaborations"])
#   GET    /api/v1/collaborations    — 协作记录列表
#   POST   /api/v1/collaborations    — 新增协作记录
#   PATCH  /api/v1/collaborations/{id} — 更新协作记录
#   DELETE /api/v1/collaborations/{id} — 删除协作记录

# 汇总面板（聚合查询，非独立数据实体）
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
#   GET    /api/v1/dashboard/overview      — 全局概览统计
#   GET    /api/v1/dashboard/by-business-line — 按业务线分组统计
#   GET    /api/v1/dashboard/match-coverage — 需求覆盖度统计
```

---

## Patterns to Follow

### Pattern 1: SQLModel 多层模型模式（消除重复定义）

**What:** 用 SQLModel 的 Base/Create/Public/Update 四层继承模式，一个实体一套模型同时服务 ORM 和 API 验证。
**When:** 所有数据实体定义时。
**Why:** 避免 Pydantic schema + SQLAlchemy model 双份维护。SQLModel 是这两者的统一层（Context7 官方文档 + full-stack-fastapi-template 实际使用验证）。

**Example:**
```python
from sqlmodel import Field, Relationship, SQLModel
from datetime import datetime, timezone

# ---- 预研项目模型 ----

class ProjectBase(SQLModel):
    """共享字段定义"""
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    status: str = Field(default="调研中", max_length=50)  # 调研中/已完成/暂停
    business_line: str | None = Field(default=None, max_length=100)

class Project(ProjectBase, table=True):
    """ORM 表模型 — 对应数据库表"""
    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime | None = Field(default=None)

    # 关系
    tags: list["Tag"] = Relationship(back_populates="projects", link_model=ProjectTagLink)
    demands: list["Demand"] = Relationship(back_populates="projects", link_model=DemandProjectLink)
    collaborations: list["Collaboration"] = Relationship(back_populates="project")

class ProjectCreate(ProjectBase):
    """API 请求体 — 创建时用"""
    tag_ids: list[int] | None = Field(default=None)  # 关联标签 ID

class ProjectPublic(ProjectBase):
    """API 响应体 — 返回给前端"""
    id: int
    created_at: datetime
    updated_at: datetime | None
    tags: list["TagPublic"] = []
    demands: list["DemandPublic"] = []

class ProjectUpdate(SQLModel):
    """API 请求体 — 更新时用（所有字段可选）"""
    name: str | None = None
    description: str | None = None
    status: str | None = None
    business_line: str | None = None
    tag_ids: list[int] | None = None
```

### Pattern 2: FastAPI 依赖注入获取 Session

**What:** 通过 `Depends(get_session)` 在每个路由函数中获取数据库 session，请求结束自动关闭。
**When:** 所有需要数据库操作的 API 端点。
**Why:** FastAPI 依赖注入是官方推荐模式，避免手动 session 管理，确保每个请求独立 session（Context7 SQLModel 官方教程验证）。

**Example:**
```python
from fastapi import Depends, FastAPI
from sqlmodel import Session, create_engine

sqlite_url = "sqlite:///./database.db"
connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, echo=True, connect_args=connect_args)

def get_session():
    with Session(engine) as session:
        yield session

# 在路由中使用
@router.get("/projects/", response_model=list[ProjectPublic])
def read_projects(session: Session = Depends(get_session)):
    projects = session.exec(select(Project)).all()
    return projects
```

### Pattern 3: APIRouter 按领域分组

**What:** 每个业务领域（项目/需求/标签/协作/匹配/面板）一个独立 Router 文件，在 main.py 中统一挂载。
**When:** 定义 API 端点时。
**Why:** 单文件路由在6个领域时已难以维护。按领域分组是 full-stack-fastapi-template 和社区标准实践。

**Example:**
```python
# backend/app/main.py
from fastapi import FastAPI
from app.api import projects, demands, tags, collaborations, matching, dashboard

app = FastAPI(title="AI工坊平台", version="0.1.0")

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(demands.router, prefix="/demands", tags=["demands"])
api_router.include_router(tags.router, prefix="/tags", tags=["tags"])
api_router.include_router(collaborations.router, prefix="/collaborations", tags=["collaborations"])
api_router.include_router(matching.router, prefix="/matching", tags=["matching"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])

app.include_router(api_router)

@app.on_event("startup")
def on_startup():
    create_db_and_tables()
```

### Pattern 4: Vite 开发代理消除 CORS

**What:** 在 `vite.config.js` 配置 `/api` 代理到 FastAPI 后端（8000端口），开发时前端和后端在同一域。
**When:** 开发环境配置时。
**Why:** CORS 是前后端分离开发最常见的坑。Vite proxy 是官方推荐方案（Context7 Vite 文档验证），简单有效。

**Example:**
```javascript
// frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})
```

### Pattern 5: 前端统一 API Service 层

**What:** 所有 HTTP 请求封装在一个 `services/api.js` 文件中，组件不直接调用 fetch。
**When:** 前端需要与后端通信时。
**Why:** 统一处理错误、请求路径、数据转换。组件层只关心渲染，不关心 API 细节。

**Example:**
```javascript
// frontend/src/services/api.js
const API_BASE = '/api/v1';  // 开发时 Vite 代理，部署时同域

async function fetchJSON(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// 项目相关
export const getProjects = (filters = {}) => 
  fetchJSON(`/projects?${new URLSearchParams(filters)}`);
export const getProject = (id) => fetchJSON(`/projects/${id}`);
export const createProject = (data) => fetchJSON('/projects', { method: 'POST', body: JSON.stringify(data) });
export const updateProject = (id, data) => fetchJSON(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

// 需求相关
export const getDemands = (filters = {}) => fetchJSON(`/demands?${new URLSearchParams(filters)}`);
export const createDemand = (data) => fetchJSON('/demands', { method: 'POST', body: JSON.stringify(data) });

// ... 其他领域类似
```

### Pattern 6: 多对多关联用 Link Model + Relationship

**What:** 项目↔标签、需求↔标签、需求↔项目 这三个多对多关系，用显式 Link Model（中间表）+ SQLModel Relationship 的 `link_model` 参数。
**When:** 定义多对多关系时。
**Why:** 多对多必须显式中间表——因为匹配关联（DemandProjectLink）需要额外字段（match_type、match_note），不能只用隐式关联。SQLModel 的 `link_model` 参数是官方支持的多对多模式（Context7 SQLModel 教程验证）。

**Example:**
```python
class ProjectTagLink(SQLModel, table=True):
    """项目-标签中间表"""
    project_id: int = Field(foreign_key="project.id", primary_key=True)
    tag_id: int = Field(foreign_key="tag.id", primary_key=True)

class DemandProjectLink(SQLModel, table=True):
    """需求-项目匹配中间表（有额外字段）"""
    demand_id: int = Field(foreign_key="demand.id", primary_key=True)
    project_id: int = Field(foreign_key="project.id", primary_key=True)
    match_type: str = Field(default="手动关联", max_length=50)  # 手动关联/部分覆盖/完全匹配
    match_note: str | None = Field(default=None, max_length=500)

class Tag(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True, max_length=100)
    category: str = Field(default="行业", max_length=50)  # 行业/业务线

    projects: list[Project] = Relationship(back_populates="tags", link_model=ProjectTagLink)
    demands: list[Demand] = Relationship(back_populates="tags", link_model=DemandTagLink)
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: 过早引入权限系统

**What:** 在 MVP 阶段就设计角色权限、数据隔离。
**Why bad:** 增加每个 CRUD 操作的复杂度（过滤、校验），拖延上线时间。项目需求明确"全透明无权限区分"。
**Instead:** MVP 全透明。只在模型里预留 `created_by` 字段记录录入人（纯信息用途），不做权限过滤。后续需要权限时再加 middleware。

### Anti-Pattern 2: 分离 Pydantic Schema 和 SQLAlchemy Model

**What:** 在 models.py 定义 SQLAlchemy 表类，在 schemas.py 定义 Pydantic 请求/响应类，两者字段重复维护。
**Why bad:** 双份定义、字段容易不一致、修改时漏改一处。SQLModel 的存在就是为了消除这个问题。
**Instead:** 用 SQLModel 的 Base/Create/Public/Update 继承模式，一套定义服务 ORM + API 验证。

### Anti-Pattern 3: 用 PostgreSQL 替代 SQLite

**What:** MVP 就部署 PostgreSQL。
**Why bad:** 需要安装、配置、运维、连接池。数据量5-20条，SQLite 完全足够。内网单机部署场景 SQLite 是最佳选择（多个 FastAPI 社区模板在单机场景使用 SQLite）。
**Instead:** MVP 用 SQLite。如果后续数据量增长到 1万+或需要并发写入，再迁移到 PostgreSQL（SQLModel 的迁移只需改 `sqlite_url` 为 `postgresql_url`，模型代码零修改）。

### Anti-Pattern 4: 前端组件直接 fetch

**What:** 每个组件里写 `fetch('/api/v1/projects')`，到处散落 API 调用代码。
**Why bad:** URL 管理分散、错误处理不一致、改动 API 时要搜遍所有组件。
**Instead:** 统一 API service 层（Pattern 5），组件只调用 service 函数。

### Anti-Pattern 5: 实时推送（WebSocket/SSE）

**What:** MVP 就实现 WebSocket 实时推送通知。
**Why bad:** 数据量5-20条、更新频率极低（手动录入）、团队人力有限。WebSocket 增加前后端复杂度，但收益为零。
**Instead:** MVP 手动刷新即可。预留接口设计空间，后续按需添加。

### Anti-Pattern 6: 微服务拆分

**What:** 项目/需求/标签各做独立微服务。
**Why bad:** 数据量极小、团队人力有限、内网单机部署。微服务引入服务发现、网络通信、数据一致性等复杂度，完全不需要。
**Instead:** 单体 FastAPI 应用，按 Router 分组（Pattern 3），逻辑清晰但不物理拆分。

---

## 项目目录结构（推荐）

```
action_learning/
├── backend/
│   ├── pyproject.toml          # uv 管理的项目配置和依赖
│   ├── database.db             # SQLite 数据文件（运行时生成）
│   └── app/
│       ├── main.py             # FastAPI 入口：创建 app、挂载路由、启动建表
│       ├── database.py         # 数据库引擎、session 依赖、建表函数
│       ├── models.py           # 所有 SQLModel 模型定义
│       ├── crud.py             # 所有业务逻辑 CRUD 函数
│       └── api/
│           ├── __init__.py     # 导出所有 router
│           ├── projects.py     # 预研项目 API 路由
│           ├── demands.py      # 客户需求 API 路由
│           ├── tags.py         # 标签 API 路由
│           ├── collaborations.py # 协作记录 API 路由
│           ├── matching.py     # 匹配关联 API 路由
│           └── dashboard.py    # 汇总面板聚合 API 路由
├── frontend/
│   ├── package.json            # 前端依赖配置
│   ├── vite.config.js          # Vite 配置（含 API 代理）
│   ├── index.html              # SPA 入口 HTML
│   └── src/
│       ├── main.jsx            # React 入口
│       ├── App.jsx             # 全局布局 + React Router
│       ├── services/
│       │   └── api.js          # 统一 API 请求层
│       ├── pages/
│       │   ├── DashboardPage.jsx  # 汇总面板
│       │   ├── ProjectsPage.jsx   # 预研项目页
│       │   ├── DemandsPage.jsx    # 客户需求页
│       │   ├── MatchingPage.jsx   # 匹配视图页
│       │   └── CollaborationsPage.jsx # 协作记录页
│       ├── components/
│       │   ├── ProjectCard.jsx    # 项目卡片组件
│       │   ├── DemandCard.jsx     # 需求卡片组件
│       │   ├── MatchRow.jsx       # 匹配行组件
│       │   ├── TagFilter.jsx      # 标签筛选组件
│       │   └── StatusBadge.jsx    # 状态徽标组件
│       └── styles/
│           └── index.css          # 全局样式（可考虑 Tailwind）
├── docs/                       # 设计文档与会议记录
├── AGENTS.md                   # Agent 全局配置
└── .planning/                  # 项目规划文件
```

---

## Scalability Considerations

| Concern | MVP阶段(5-20条) | 中期(100-500条) | 远期(1000+条) |
|---------|-----------------|-----------------|---------------|
| 数据库 | SQLite 单文件 | SQLite 仍然足够 | 切换 PostgreSQL（改 URL 即可） |
| API 并发 | 无需考虑 | 单机足够 | FastAPI 支持 async，加 uvicorn workers |
| 前端列表渲染 | 直接渲染 | 加简单分页/筛选 | 虚拟滚动 + 服务端分页 |
| 标签筛选 | 前端内存筛选 | 后端 query 参数筛选 | 后端筛选 + 缓存 |
| 匹配聚合 | 实时 SQL 查询 | 实时 SQL 查询（加索引） | 预计算缓存 + 定时更新 |
| 权限 | 全透明 | 加 role middleware | JWT + RBAC middleware |
| 推送 | 手动刷新 | 可考虑 SSE | WebSocket / SSE |
| 搜索 | 内存搜索 | SQL LIKE 搜索 | 全文搜索 / ElasticSearch |

---

## Build Order（组件依赖和推荐构建顺序）

### 依赖关系图

```
Phase 0: 项目骨架
  ├─→ backend/ 目录结构 + uv init
  ├─→ frontend/ Vite + React 初始化
  └─→ Vite proxy 配置

Phase 1: 数据基础层
  ├─→ database.py (引擎 + session + 建表)
  ├─→ models.py (Tag → Project → Demand → Link Models → Collaboration)
  │   （Tag 最简单先建，其他模型依赖 Tag）
  └─→ crud.py (基础 CRUD 函数)

Phase 2: 核心 API 层
  ├─→ api/tags.py (标签 CRUD — 最简单，用于验证整个链路)
  ├─→ api/projects.py (项目 CRUD — 核心数据实体)
  ├─→ api/demands.py (需求 CRUD — 核心数据实体)
  └─→ api/collaborations.py (协作记录 CRUD)

Phase 3: 匹配与聚合层（依赖 Phase 2 的数据）
  ├─→ api/matching.py (匹配关联 — 依赖 project + demand 数据存在)
  └─→ api/dashboard.py (面板聚合 — 依赖所有 CRUD 可用)

Phase 4: 前端展示层（依赖 Phase 2+ 的 API）
  ├─→ services/api.js (API 请求层)
  ├─→ DashboardPage (汇总面板 — 依赖 dashboard API)
  ├─→ ProjectsPage (项目页 — 依赖 projects API)
  ├─→ DemandsPage (需求页 — 依赖 demands API + 前端反馈表单)
  └─→ MatchingPage (匹配视图 — 依赖 matching API)
  └─→ CollaborationsPage (协作记录 — 依赖 collaborations API)

Phase 5: 联调与优化
  ├─→ 前后端联调测试
  ├─→ 样式打磨
  └─→ 种子数据录入
```

### 构建顺序关键原则

1. **先验证全链路再扩展功能**：Phase 2 用 tags（最简单实体）打通 database → model → CRUD → router → API 的完整链路，确认架构可行后再做项目/需求。

2. **数据层先于 API 层**：没有 models.py 就无法写 CRUD；没有 CRUD 就无法写路由。这是硬依赖。

3. **后端 API 先于前端页面**：前端页面依赖 API service → 后端 API。前端开发需要可调用的 API。

4. **聚合查询最后**：dashboard 和 matching 依赖多个实体的 CRUD 可用，否则无法聚合。

5. **前端骨架可并行**：Phase 0 的前端初始化和 Phase 1 的后端数据层可以并行做，因为它们不互相依赖。但 Phase 4 的前端页面必须等 Phase 2 的 API 完成。

---

## Sources

- **Context7 FastAPI 官方文档** (`/fastapi/fastapi`)：Pydantic 模型、路由结构、依赖注入 — HIGH
- **Context7 SQLModel 官方教程** (`/websites/sqlmodel_tiangolo`)：多对多 Relationship、Base/Create/Public/Update 模式、FastAPI 集成 — HIGH
- **Context7 Vite 官方文档** (`/vitejs/vite`)：server proxy 配置 — HIGH
- **fastapi/full-stack-fastapi-template** (GitHub)：项目结构、模型分层、CRUD 模式、路由组织 — HIGH
- **Exa WebSearch：企业信息透明化平台架构**：内部协作系统常见组件（CMS、搜索、标签分类、协作记录） — MEDIUM
- **Exa WebSearch：FastAPI + React + SQLite 小型内部工具**：三层架构、单体部署、SQLite 在小数据量场景的优势 — MEDIUM
- **GitHub 代码搜索：SQLModel 多对多模型**：Link Model + Relationship 实际用法 — HIGH