# Technology Stack

**Project:** AI工坊平台（企业信息透明化平台）
**Researched:** 2026-04-24
**Context:** 企业内部信息透明化平台，连接前端（销售/咨询）与后端（研发/产品），5个角色全透明使用，初期5-20条数据，内网部署

## Recommended Stack

### Core Framework — Backend

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **Python** | 3.12+ | 运行环境 | 团队熟悉度 + uv 官方推荐最低版本 + 类型标注语法完整支持（`X \| None`） | HIGH |
| **FastAPI** | 0.115+ | Web API 框架 | Python 现代化 API 框架首选：自动 OpenAPI 文档、类型驱动、async 支持、DI 系统；FastAPI 官方模板和社区均以 FastAPI 为标准 | HIGH |
| **Uvicorn** | 0.34+ | ASGI 服务器 | FastAPI 必需的 ASGI 服务器，生产部署标配 | HIGH |
| **uv** | latest | 环境与依赖管理 | AGENTS.md 已明确约定；10-100x 比 pip 快；FastAPI 官方文档推荐 uv；pyproject.toml + uv.lock 保证可复现性 | HIGH |

### Core Framework — Frontend

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **React** | 19 | UI 框架 | AGENTS.md 已明确约定；最新稳定版，支持 `use` hook 等 modern 特性 | HIGH |
| **Vite** | 7+ | 构建工具与开发服务器 | AGENTS.md 已明确约定；闪电般 HMR + 生产优化构建；与 FastAPI 通过 proxy 配置无缝对接 | HIGH |
| **TypeScript** | 5.x | 类型系统 | 企业级项目标配；前后端类型一致性（FastAPI 自动生成 OpenAPI → 可生成 TS 类型）；减少 runtime 错误 | HIGH |
| **React Router** | 7.x | SPA 路由 | React SPA 路由事实标准；v7 支持框架模式和库模式双用，类型安全路由 | MEDIUM |

### Database & ORM

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **SQLite** | (系统自带) | MVP 数据库 | 初期 5-20 条数据量 + 内网单机部署 + 零运维 + 单文件可备份；后期可平滑迁移到 PostgreSQL；SQLModel 官方教程即用 SQLite | HIGH |
| **SQLModel** | 0.0.22+ | ORM + 数据模型 | FastAPI 官方模板使用 SQLModel；同时是 SQLAlchemy table 和 Pydantic model，消除模型定义重复；与 FastAPI 的 Pydantic schema 体系天然融合 | MEDIUM |
| **Alembic** | 1.14+ | 数据库迁移 | SQLAlchemy 生态标配迁移工具；SQLModel 基于 SQLAlchemy，Alembic 直接兼容；后期迁移 PostgreSQL 时迁移脚本可复用 | HIGH |

> **SQLite → PostgreSQL 迁移路径：** MVP 用 SQLite（零运维、零部署复杂度），当数据量或并发写入需求增长时，仅需更换连接字符串 + 安装 `psycopg` 驱动即可迁移到 PostgreSQL。SQLModel/Alembic 的迁移脚本在两数据库间通用。

### UI Component Library

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **Ant Design** | 5.x | UI 组件库 | 企业级中后台系统首选：Table 组件功能强大（排序/筛选/分页/固定列/虚拟滚动开箱即用）；内置中文本地化（`ConfigProvider` + `zh_CN`）；50+ 组件覆盖所有企业场景；Form 组件自带表单实例管理、联动验证 | HIGH |

### State Management

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **Zustand** | 5.x | 全局状态管理 | 轻量（~1KB）、hook-based API 与 React 函数组件风格一致；无 boilerplate；2025-2026 React 生态事实标准（多个开源 full-stack template 采用）；支持 devtools/persist middleware | HIGH |

### Supporting Libraries — Backend

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| **Pydantic** | 2.x | 数据验证与配置管理 | FastAPI 内置依赖；SQLModel 基于 Pydantic v2；所有 API schema 定义 | HIGH |
| **python-dotenv** | 1.x | 环境变量管理 | 从 `.env` 文件加载配置；MVP 阶段配置管理最简方案 | HIGH |
| **aiosqlite** | 0.20+ | SQLite async 驱动 | 当启用 async 数据库操作时；SQLite 默认 sync，但 FastAPI async 模式下需要 aiosqlite 避免阻塞事件循环 | MEDIUM |
| **Pytest** | 8.x | 后端测试框架 | Python 测试标配；与 FastAPI 的 TestClient 无缝配合 | HIGH |

### Supporting Libraries — Frontend

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| **Axios** | 1.x | HTTP 请求客户端 | 与 FastAPI 后端通信；拦截器统一处理认证 token / 错误响应；比 fetch 更好的错误处理和请求取消 | MEDIUM |
| **React Hook Form** | 7.x | 表单状态管理 | 当表单复杂度超过 Ant Design Form 自带管理能力时；高性能（最小重渲染）；与 Zod 验证库配合 | MEDIUM |
| **Day.js** | 1.x | 日期处理 | Ant Design DatePicker 默认使用 dayjs；轻量（2KB）替代 moment | HIGH |
| **@ant-design/icons** | 5.x | 图标库 | Ant Design 配套图标；企业级图标体系完整 | HIGH |
| **openapi-typescript** | latest | 从 OpenAPI spec 生成 TS 类型 | 从 FastAPI 自动生成的 `/docs` OpenAPI spec 生成前端 TypeScript 类型定义，保证前后端类型一致 | MEDIUM |

### Infrastructure & DevOps

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **Docker** | — | 容器化部署 | 后期生产部署标准化；内网部署时用 Docker Compose 一键启动前后端 | MEDIUM |
| **Docker Compose** | — | 多服务编排 | SQLite MVP 阶段不需要（前后端可同机跑）；迁移 PostgreSQL 后需要编排 DB + backend + frontend | LOW |
| **Nginx** | — | 反向代理 + 静态资源 | 生产部署时 serve 前端静态文件 + 反向代理后端 API；消除 CORS 问题 | MEDIUM |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Web Framework | FastAPI | Django | Django 太重，自带 ORM/Admin/Auth 不适合轻量 MVP；团队需 Django 学习曲线 |
| Web Framework | FastAPI | Flask | Flask 无自动文档、无类型驱动、无 async-first 设计；2025 新项目已不推荐 |
| ORM | SQLModel | SQLAlchemy（纯） | 纯 SQLAlchemy 需要单独定义 Pydantic schema，模型重复；SQLModel 合二为一减少代码量；但 SQLModel maturity 较低（0.0.x），复杂场景可能需要退回 SQLAlchemy |
| ORM | SQLModel | Django ORM | Django ORM 绑定 Django 框架，与 FastAPI 不兼容 |
| Database (MVP) | SQLite | PostgreSQL | MVP 5-20 条数据不需要 PG 的并发/高级特性；PG 需要单独安装运维；SQLite 零运维 |
| Database (Future) | PostgreSQL | MySQL | PG 的 JSONB、全文搜索、扩展生态更强；FastAPI 社区更偏好 PG |
| UI Library | Ant Design | shadcn/ui | shadcn/ui 定制性好但组件数量少，企业级 Table/Form 等需要大量组装；无内置中文本地化；团队是中文团队，antd 中文文档+本地化是巨大优势 |
| UI Library | Ant Design | MUI | MUI 组件丰富但中文本地化不如 antd；企业级 Table 功能不如 antd 强；团队对 antd 认知度高 |
| State Management | Zustand | Redux Toolkit | Redux 过度工程化（action/reducer/store 三件套）；MVP 不需要 Redux 的中间件生态 |
| State Management | Zustand | React Context | Context 在跨组件频繁更新场景性能差（全树重渲染）；Zustand selector 模式避免此问题 |
| Package Manager | uv | pip + venv | AGENTS.md 已明确约定不用 pip/venv；uv 10-100x 更快 + lockfile 保证可复现 |
| Build Tool | Vite | CRA (create-react-app) | CRA 已废弃（官方不再维护）；Vite HMR 快 10-100x |
| HTTP Client | Axios | fetch | fetch 无拦截器/请求取消/错误处理标准化；Axios 更适合企业级 API 交互 |
| Routing | React Router 7 | TanStack Router | TanStack Router 类型安全更好但生态较小、文档少；React Router 是事实标准 |

## Installation

```bash
# ===== 后端 =====
# 初始化 uv 项目
cd backend
uv init --app
uv add fastapi[standard] uvicorn sqlmodel alembic python-dotenv aiosqlite
uv add --dev pytest pytest-asyncio httpx

# ===== 前端 =====
cd frontend
npm create vite@latest . -- --template react-ts
npm install antd @ant-design/icons zustand axios dayjs react-router
npm install -D @types/node openapi-typescript
```

## 项目结构

```
action_learning/
├── backend/
│   ├── pyproject.toml          # uv 项目配置
│   ├── uv.lock                 # 依赖锁文件
│   ├── alembic.ini             # Alembic 配置
│   ├── migrations/             # 数据库迁移脚本
│   │   ├── versions/
│   │   ├── env.py
│   │   └── script.py.mako
│   ├── .env                    # 环境变量
│   └── app/
│       ├── main.py             # FastAPI 入口
│       ├── core/
│       │   ├── config.py       # Pydantic Settings 配置
│       │   └── db.py           # 数据库引擎 + session
│       ├── models/             # SQLModel 数据模型
│       │   ├── project.py      # 预研项目模型
│       │   ├── demand.py       # 客户需求模型
│       │   ├── match.py        # 需求-项目匹配模型
│       │   └── tag.py          # 行业/业务线标签模型
│       ├── schemas/            # Pydantic 请求/响应 schema
│       ├── api/
│       │   ├── projects.py     # 预研项目路由
│       │   ├── demands.py      # 客户需求路由
│       │   ├── matches.py      # 匹配路由
│       │   └── tags.py         # 标签路由
│       └── services/           # 业务逻辑层
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts          # Vite 配置（含 API proxy）
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx            # React 入口
│       ├── App.tsx             # 路由配置
│       ├── api/                # Axios API 客户端
│       │   ├── client.ts       # Axios 实例配置
│       │   ├── projects.ts     # 项目 API
│       │   ├── demands.ts      # 需求 API
│       │   └── matches.ts      # 匹配 API
│       ├── stores/             # Zustand 状态
│       │   ├── projectStore.ts
│       │   ├── demandStore.ts
│       │   └── matchStore.ts
│       ├── pages/              # 页面组件
│       │   ├── Dashboard/      # 汇总面板
│       │   ├── Projects/       # 预研项目列表/详情
│       │   ├── Demands/        # 客户需求列表/详情
│       │   ├── Matches/        # 需求-项目匹配
│       │   └── Collaboration/  # 协作记录
│       ├── components/         # 共享组件
│       └── types/              # TS 类型定义
│
├── docs/                       # 设计文档与会议记录
├── AGENTS.md
└── .planning/
```

## Key Architecture Decisions

### 1. SQLite for MVP → PostgreSQL for Growth

**决策：** MVP 用 SQLite，预留 PostgreSQL 迁移路径。

**理由：**
- 初期数据量仅 5-20 条，SQLite 完全足够
- 单机内网部署，无并发写入需求
- 零运维：无需安装/配置/监控数据库服务
- 单文件数据库，备份即复制文件
- SQLModel + Alembic 的迁移脚本在 SQLite ↔ PostgreSQL 间通用

**迁移触发条件：**
- 数据量超过 1000 条 + 需要并发写入 → 迁移 PostgreSQL
- 多人同时编辑同一记录 → PostgreSQL 的 MVCC 并发控制

### 2. SQLModel vs SQLAlchemy

**决策：** 使用 SQLModel 作为 ORM。

**理由：**
- FastAPI 官方 full-stack template 使用 SQLModel
- SQLModel 合并 Pydantic model + SQLAlchemy table model，消除重复定义
- 与 FastAPI 的类型驱动设计理念一致
- 学习曲线更低（一个类既是 API schema 又是 DB model）

**风险：** SQLModel 版本仍为 0.0.x（maturity 较低），遇到复杂查询场景可能需要退回到纯 SQLAlchemy。但 MVP 数据模型简单（项目、需求、匹配、标签四张表），SQLModel 完全胜任。

### 3. Ant Design vs shadcn/ui

**决策：** 使用 Ant Design 5.x。

**理由：**
- 本项目核心 UI 是**数据汇总面板**（Table-heavy dashboard），Ant Design Table 功能强大到"离谱"（排序、筛选、分页、固定列、虚拟滚动开箱即用）
- 中文团队 + 内网中国企业场景，Ant Design 内置 `zh_CN` 本地化是巨大优势
- Form 组件自带实例管理、联动验证，适合需求录入等表单场景
- 50+ 企业级组件覆盖所有场景（Tree 选择、Tag 管理、Timeline 协作记录等）

**代价：** 包体积较大（~2MB），但内网部署对包体积不敏感；定制性不如 shadcn/ui，但本项目不需要品牌化 UI。

### 4. Zustand vs Context vs Redux

**决策：** Zustand 5.x 作为全局状态管理。

**理由：**
- React Context 在频繁更新场景会触发全树重渲染，Zustand 的 selector 模式只更新订阅组件
- MVP 状态模型简单（项目列表、需求列表、匹配关系），Zustand 一个 store 几行代码搞定
- 2025-2026 多个 full-stack template 均采用 Zustand（10xapp/core-oss, fazt/project-manager-realtime 等）
- 无 boilerplate，无 action/reducer 三件套

**策略：** 页面级局部状态用 `useState`，跨页面共享状态用 Zustand。初期不引入 persist middleware（数据来自后端 API）。

## Sources

- FastAPI 官方文档 & Context7: `/fastapi/fastapi` — Pydantic model patterns, ORM mode support
- SQLModel 官方文档 & Context7: `/websites/sqlmodel_tiangolo` — FastAPI + SQLModel integration, relationship models, CRUD patterns
- FastAPI Full-Stack Template & Context7: `/fastapi/full-stack-fastapi-template` — 项目结构参考，SQLModel 实际使用模式
- uv 官方文档 & Context7: `/astral-sh/uv` — 项目初始化、pyproject.toml 配置、FastAPI 集成指南
- Zustand & Context7: `/pmndrs/zustand` — store 创建模式、TypeScript 支持、middleware 使用
- Ant Design & Context7: `/ant-design/ant-design` — Table/Form 组件、中文本地化、企业级特性
- Vite 官方文档 & Context7: `/websites/vite_dev` — proxy 配置、React 项目设置
- SQLAlchemy & Context7: `/websites/sqlalchemy_en_20_orm` — async session、Alembic 迁移兼容性
- WebSearch: SQLite vs PostgreSQL MVP 选型对比（2025-2026 多源）
- WebSearch: FastAPI + React + Vite 项目结构最佳实践（2025 多源模板对比）
- WebSearch: Ant Design vs shadcn/ui 企业级选型（2025-2026 中文社区对比）
- 10xapp/core-oss (GitHub): 实际 full-stack 项目栈参考 — FastAPI + React + Zustand + Supabase
- fazt/project-manager-realtime (GitHub): 项目管理类产品栈参考 — FastAPI + React + Zustand + shadcn/ui + Socket.IO