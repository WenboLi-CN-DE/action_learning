## Backend

FastAPI + SQLModel backend for the AI workshop platform.

## Run

```bash
uv sync
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Test

```bash
uv run pytest
```

## RAG 知识检索

### API

- `POST /api/v1/rag/ingest` — 文档入库（切片 + 向量化）
- `POST /api/v1/rag/import-file` — 上传 `.txt` / `.md` / `.csv` 资料并入库
- `POST /api/v1/rag/retrieve` — 检索 top-k 相关文本块（支持 metadata 过滤）
- `POST /api/v1/rag/query` — 检索增强问答（返回答案 + 引用 + 原始 chunk）
- `POST /api/v1/llm/recognize-image` — 上传图片并提取可用于需求/能力录入的文本

### 配置（环境变量）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `RAG_BACKEND` | `qdrant` | 后端类型：`qdrant`（向量检索）或 `memory`（内存，测试用） |
| `RAG_EMBEDDING_MODEL` | `BAAI/bge-small-zh-v1.5` | fastembed 支持的 embedding 模型名 |
| `RAG_QDRANT_URL` | _(空=内存模式)_ | Qdrant 服务地址，如 `http://localhost:6333` |
| `RAG_QDRANT_API_KEY` | _(空)_ | Qdrant Cloud API Key（可选） |
| `RAG_COLLECTION_NAME` | `ai_workshop_docs` | Qdrant collection 名称 |
| `RAG_CHUNK_SIZE` | `380` | 文本分块大小（字符数） |
| `RAG_CHUNK_OVERLAP` | `60` | 分块重叠字符数 |

### 快速验证

```bash
# 使用内存 Qdrant（无需部署 Qdrant 服务，首次自动下载 ~50MB 模型）
uv run uvicorn app.main:app --reload

# 入库一条文档
curl -X POST http://localhost:8000/api/v1/rag/ingest \
  -H "Content-Type: application/json" \
  -d '{"title":"楼宇节能方案","content":"该方案支持楼宇能耗监测、告警和优化建议。","source_type":"project","tags":["楼宇","节能"]}'

# 导入一份资料
curl -X POST http://localhost:8000/api/v1/rag/import-file \
  -F "file=@docs/building-energy.md" \
  -F "source_type=manual" \
  -F "tags=楼宇,节能" \
  -F "owner_role=市场资料"

# 检索
curl -X POST http://localhost:8000/api/v1/rag/retrieve \
  -H "Content-Type: application/json" \
  -d '{"query":"楼宇能耗优化","top_k":3}'

# 问答
curl -X POST http://localhost:8000/api/v1/rag/query \
  -H "Content-Type: application/json" \
  -d '{"question":"有没有楼宇相关的能力？","top_k":5}'
```

### 架构说明

```
app/rag/
├── __init__.py
├── config.py          # 配置（环境变量）
├── vector_store.py    # Qdrant 向量存储封装
└── service.py         # 业务编排（双后端：memory / qdrant）
```

- **开发/测试**：默认使用 Qdrant 内存模式（`RAG_QDRANT_URL` 为空时），无需部署外部服务
- **生产**：设置 `RAG_QDRANT_URL=http://your-qdrant:6333` 连接远程 Qdrant
- **Embedding 模型**：默认 `BAAI/bge-small-zh-v1.5`（中文效果好、体积小）；可切换为 `BAAI/bge-m3`（多语言更强）
