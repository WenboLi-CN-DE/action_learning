"""Qdrant 向量存储封装。支持内存模式与远程连接。"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from typing import Any

from qdrant_client import QdrantClient, models

from app.rag import config

logger = logging.getLogger(__name__)


@dataclass
class ChunkPayload:
    """存入 Qdrant 的 payload 结构。"""
    chunk_id: str
    doc_id: str
    title: str
    text: str
    source_type: str
    source_id: str | None
    tags: list[str]
    owner_role: str | None
    chunk_index: int


@dataclass
class SearchHit:
    payload: ChunkPayload
    score: float


class QdrantStore:
    """Qdrant 向量存储。支持 fastembed 自动 embedding。"""

    def __init__(self, *, url: str | None = None, api_key: str | None = None, collection_name: str | None = None, embedding_model: str | None = None):
        self._collection_name = collection_name or config.get_collection_name()
        self._embedding_model = embedding_model or config.get_embedding_model()

        if url:
            self._client = QdrantClient(url=url, api_key=api_key)
        else:
            # 内存模式（开发/测试）
            self._client = QdrantClient(":memory:")

        self._ensure_collection()

    def _ensure_collection(self) -> None:
        """确保 collection 存在。使用 fastembed 集成时由 client 自动推断维度。"""
        collections = self._client.get_collections().collections
        existing_names = {c.name for c in collections}
        if self._collection_name not in existing_names:
            # 使用 set_model 让 qdrant-client 记住 embedding 模型
            self._client.set_model(self._embedding_model)
            # 创建 collection（通过 fastembed 自动推断维度）
            self._client.create_collection(
                collection_name=self._collection_name,
                vectors_config=self._client.get_fastembed_vector_params(),
            )
            logger.info(f"创建 Qdrant collection: {self._collection_name}, 模型: {self._embedding_model}")
        else:
            self._client.set_model(self._embedding_model)

    def add_chunks(self, chunks: list[ChunkPayload]) -> None:
        """批量写入文本块。使用 fastembed 自动生成向量。"""
        if not chunks:
            return

        documents = [chunk.text for chunk in chunks]
        metadata = [
            {
                "chunk_id": chunk.chunk_id,
                "doc_id": chunk.doc_id,
                "title": chunk.title,
                "text": chunk.text,
                "source_type": chunk.source_type,
                "source_id": chunk.source_id or "",
                "tags": chunk.tags,
                "owner_role": chunk.owner_role or "",
                "chunk_index": chunk.chunk_index,
            }
            for chunk in chunks
        ]

        ids = [str(uuid.uuid5(uuid.NAMESPACE_DNS, chunk.chunk_id)) for chunk in chunks]

        self._client.add(
            collection_name=self._collection_name,
            documents=documents,
            metadata=metadata,
            ids=ids,
        )

    def search(self, query: str, top_k: int, filters: dict[str, Any] | None = None) -> list[SearchHit]:
        """向量检索 + metadata 过滤。"""
        qdrant_filter = self._build_filter(filters) if filters else None

        results = self._client.query(
            collection_name=self._collection_name,
            query_text=query,
            query_filter=qdrant_filter,
            limit=top_k,
        )

        hits: list[SearchHit] = []
        for point in results:
            meta = point.metadata
            payload = ChunkPayload(
                chunk_id=meta.get("chunk_id", ""),
                doc_id=meta.get("doc_id", ""),
                title=meta.get("title", ""),
                text=meta.get("text", ""),
                source_type=meta.get("source_type", ""),
                source_id=meta.get("source_id") or None,
                tags=meta.get("tags", []),
                owner_role=meta.get("owner_role") or None,
                chunk_index=meta.get("chunk_index", 0),
            )
            hits.append(SearchHit(payload=payload, score=point.score))

        return hits

    def delete_by_doc_id(self, doc_id: str) -> None:
        """按 doc_id 删除所有相关 chunk。"""
        self._client.delete(
            collection_name=self._collection_name,
            points_selector=models.FilterSelector(
                filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="doc_id",
                            match=models.MatchValue(value=doc_id),
                        )
                    ]
                )
            ),
        )

    def count(self) -> int:
        """返回 collection 中的点数。"""
        info = self._client.get_collection(self._collection_name)
        return info.points_count or 0

    def clear(self) -> None:
        """清空 collection（测试用）。"""
        self._client.delete_collection(self._collection_name)
        self._ensure_collection()

    @staticmethod
    def _build_filter(filters: dict[str, Any]) -> models.Filter | None:
        """将简单的 filters dict 转为 Qdrant Filter 对象。"""
        conditions: list[models.Condition] = []

        source_type = filters.get("source_type")
        if isinstance(source_type, str) and source_type:
            conditions.append(
                models.FieldCondition(key="source_type", match=models.MatchValue(value=source_type))
            )

        source_id = filters.get("source_id")
        if isinstance(source_id, str) and source_id:
            conditions.append(
                models.FieldCondition(key="source_id", match=models.MatchValue(value=source_id))
            )

        owner_role = filters.get("owner_role")
        if isinstance(owner_role, str) and owner_role:
            conditions.append(
                models.FieldCondition(key="owner_role", match=models.MatchValue(value=owner_role))
            )

        tags = filters.get("tags")
        if isinstance(tags, list):
            valid_tags = [tag for tag in tags if isinstance(tag, str) and tag.strip()]
            if valid_tags:
                conditions.append(
                    models.FieldCondition(key="tags", match=models.MatchAny(any=valid_tags))
                )

        if not conditions:
            return None
        return models.Filter(must=conditions)

