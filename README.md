# AI 工坊平台

> 行动学习课题产物 — 打通前端（销售/咨询）与后端（研发/产品）的信息透明化平台。

## 项目简介

本平台旨在解决公司内部前后端信息不对称问题：

- **后端预研项目可见化**：研发预研的项目对前端团队可见，方便匹配客户需求
- **前端需求反馈通道**：销售/咨询可提交客户需求，研发可直接获取一手信息
- **智能匹配**：自动匹配需求与预研项目，发现潜在合作机会
- **信息汇总与透明化**：统一平台展示项目状态、需求进展、匹配关系

团队角色覆盖：销售、咨询、研发、技术支持、解决方案工程师

## 技术栈

| 层级 | 技术选型 |
|------|---------|
| 后端 | FastAPI + SQLModel + SQLite (MVP) |
| 前端 | React 19 + Vite + TypeScript + Ant Design 6 |
| 状态管理 | Zustand |
| 环境管理 | uv (Python) / npm (Node.js) |
| 部署 | Docker Compose |

## 项目结构

```
action_learning/
├── backend/              # Python 后端服务
│   ├── app/
│   │   ├── api/          # API 路由 (projects, requirements, matches, tags, comments, stats)
│   │   ├── models.py     # SQLModel 数据模型
│   │   ├── schemas.py    # Pydantic 请求/响应 Schema
│   │   ├── database.py   # 数据库配置
│   │   └── main.py       # FastAPI 应用入口
│   ├── tests/            # 测试
│   └── pyproject.toml    # Python 依赖配置
├── frontend/             # React 前端应用
│   ├── src/
│   │   ├── pages/        # 页面组件 (Dashboard, Projects, Requirements, Matches, Tags)
│   │   ├── components/   # 通用组件
│   │   ├── services/     # API 服务层
│   │   └── types/        # TypeScript 类型定义
│   └── package.json      # Node.js 依赖配置
├── deploy/               # 部署配置
├── docs/                 # 设计文档与演示材料
└── AGENTS.md             # AI Agent 配置
```

## 快速开始

### 前置条件

- Python >= 3.10
- Node.js >= 18
- [uv](https://docs.astral.sh/uv/) (Python 包管理)

### 后端启动

```bash
cd backend
uv sync                    # 安装依赖
uv run uvicorn app.main:app --reload --port 8000
```

API 文档：http://localhost:8000/docs

### 前端启动

```bash
cd frontend
npm install                # 安装依赖
npm run dev                # 启动开发服务器
```

访问：http://localhost:5173

## 核心功能模块

| 模块 | 说明 |
|------|------|
| 项目管理 | 预研项目的创建、编辑、状态跟踪 |
| 需求管理 | 客户需求录入、分类、优先级管理 |
| 智能匹配 | 需求与项目的自动/手动匹配 |
| 标签系统 | 统一的标签分类体系 |
| 评论协作 | 项目与需求的评论交流 |
| 数据统计 | Dashboard 数据汇总展示 |

## 开发指南

### 运行测试

```bash
cd backend
uv run pytest              # 单元测试
uv run python test_e2e.py  # 端到端测试
```

### 代码风格

- Python: PEP 8 + 类型标注
- TypeScript: ESLint + 严格模式
- 注释语言：中文优先

## License

Internal use only - Schneider Electric
