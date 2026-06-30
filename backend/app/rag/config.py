"""RAG 配置。通过环境变量切换后端和模型。"""

from __future__ import annotations

import os


def get_rag_backend() -> str:
    """获取 RAG 后端类型：memory | qdrant"""
    return os.getenv("RAG_BACKEND", "qdrant")


def get_embedding_model() -> str:
    """Embedding 模型名称（fastembed 支持的模型）。
    推荐中文模型：BAAI/bge-small-zh-v1.5（体积小、中文效果好）
    更强模型可选：BAAI/bge-m3（多语言，体积大）
    """
    return os.getenv("RAG_EMBEDDING_MODEL", "BAAI/bge-small-zh-v1.5")


def get_qdrant_url() -> str | None:
    """Qdrant 服务地址。为空则使用内存模式（开发/测试）。"""
    return os.getenv("RAG_QDRANT_URL") or None


def get_qdrant_api_key() -> str | None:
    """Qdrant Cloud API Key（可选）。"""
    return os.getenv("RAG_QDRANT_API_KEY") or None


def get_collection_name() -> str:
    """Qdrant collection 名称。"""
    return os.getenv("RAG_COLLECTION_NAME", "ai_workshop_docs")


def get_chunk_size() -> int:
    return int(os.getenv("RAG_CHUNK_SIZE", "380"))


def get_chunk_overlap() -> int:
    return int(os.getenv("RAG_CHUNK_OVERLAP", "60"))

