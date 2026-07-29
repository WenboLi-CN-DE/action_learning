# AI 工坊后端

FastAPI + SQLModel 后端，负责需求、能力、关联、审核、评论、AI、RAG 和 Chatbot。

## 本地运行

```bash
uv sync
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

API 文档：<http://127.0.0.1:8000/docs>

## 验证

```bash
uv run pytest
```

当前基线：62 项后端测试通过。

## 业务模块

| Router / 模块 | 责任 |
|---------------|------|
| `projects` | 能力创建、查询、更新及知识同步 |
| `requirements` | 需求创建、查询、更新、数据质量校验及知识同步 |
| `reviews` | 审核人指派、需求状态转换和审核事件 |
| `matches` | 人工/AI 关联、技术确认、最终审核和关联历史 |
| `tags` | 行业/业务线标签 |
| `comments` | 需求与能力的协作评论 |
| `llm` | LLM 状态、自然语言结构化和图片识别 |
| `rag` | 文档入库、文件导入、检索、问答、列表、删除和重建 |
| `chat` | 基于 RAG + Qwen 的多轮助手 |
| `pilot` | v2.1 个人待办、SLA、数据质量、AI 评测和管理指标 |

v2.1 试运行 API：

- `GET /api/v1/pilot/tasks?role=<role>&actor=<name>`
- `GET /api/v1/pilot/metrics`

所有业务 API 使用 `/api/v1` 前缀，完整参数以 OpenAPI 文档为准。

## 审核规则

### 需求

- 新需求必须包含提交人和有效描述；
- 审核责任人由管理员指派；
- 只有被指派人能执行对应审核；
- 提交人不能审核自己的需求；
- 普通更新不能直接改变审核状态；
- 审核事件保存操作人、意见、前后状态和时间。

### 需求—能力关联

- 人工和 AI 关联都先进入 `technical_pending`；
- 研发技术确认后进入 `final_pending`；
- 管理员终审后才进入 `approved`；
- 创建人不能审核自己的关联；
- 技术确认人不能执行最终审核；
- 驳回必须填写意见；
- 终审通过后才更新需求的正式匹配状态。

## LLM 配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `QWEN_API_KEY` | 无 | Qwen API key |
| `QWEN_MODEL` | `qwen3.6-plus` | 默认模型 |
| `QWEN_BASE_URL` | DashScope OpenAI-compatible endpoint | 兼容接口地址 |

API key 不写入 SQLite。生产环境从 `/etc/action-learning.env` 读取。

## RAG 配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `RAG_BACKEND` | `qdrant` | `qdrant` 或测试用 `memory` |
| `RAG_EMBEDDING_MODEL` | `BAAI/bge-small-zh-v1.5` | FastEmbed 模型 |
| `RAG_QDRANT_URL` | 空 | Qdrant 地址；为空时使用客户端内存模式 |
| `RAG_QDRANT_API_KEY` | 空 | Qdrant API key |
| `RAG_COLLECTION_NAME` | `ai_workshop_docs` | Collection 名 |
| `RAG_CHUNK_SIZE` | `380` | 分块字符数 |
| `RAG_CHUNK_OVERLAP` | `60` | 重叠字符数 |

支持的文件导入类型：`.txt`、`.md`、`.csv`。图片识别支持 PNG、JPG/JPEG、WEBP。

## RAG 目录

```text
app/rag/
├── config.py          # 环境配置
├── vector_store.py    # Qdrant / memory 存储封装
├── service.py         # 入库、检索和文档生命周期
└── sync.py            # 需求与能力数据同步
```

## 数据库边界

当前使用 SQLite 作为最终试点存储，并包含对历史表字段的兼容处理。根据 v2.1 最终范围决策，不规划 PostgreSQL/Alembic 迁移。后续仅维护：

1. 现有 SQLite 数据备份和恢复；
2. 当前表结构的兼容处理；
3. 已有接口的缺陷修复；
4. 不新增企业身份、复杂数据库或系统集成能力。
