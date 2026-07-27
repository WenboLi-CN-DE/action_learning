"""RAG 服务层。统一 ingest/retrieve/query 逻辑，支持 memory 和 qdrant 双后端。"""

from __future__ import annotations

import math
import re
import uuid
from dataclasses import dataclass
from threading import Lock
from typing import Any, Protocol

from app.rag import config


# ===== 公共数据结构 =====


@dataclass
class RagChunk:
    chunk_id: str
    doc_id: str
    title: str
    text: str
    source_type: str
    source_id: str | None
    tags: list[str]
    owner_role: str | None


@dataclass
class RagSearchResult:
    chunk: RagChunk
    score: float


# ===== 后端接口协议 =====


class RagBackend(Protocol):
    def ingest(self, *, title: str, content: str, source_type: str, source_id: str | None, tags: list[str], owner_role: str | None) -> tuple[str, int]:
        ...

    def retrieve(self, query: str, top_k: int, filters: dict[str, Any]) -> list[RagSearchResult]:
        ...

    def clear(self) -> None:
        ...

    def delete_document(self, doc_id: str) -> None:
        ...


# ===== Memory 后端（轻量，测试用）=====


class MemoryBackend:
    """内存后端，BM25-like 打分，适合单元测试和快速验证。"""

    def __init__(self) -> None:
        self._lock = Lock()
        self._chunks: list[RagChunk] = []

    def clear(self) -> None:
        with self._lock:
            self._chunks.clear()

    def delete_document(self, doc_id: str) -> None:
        with self._lock:
            self._chunks = [
                chunk for chunk in self._chunks if chunk.doc_id != doc_id
            ]

    def ingest(self, *, title: str, content: str, source_type: str, source_id: str | None, tags: list[str], owner_role: str | None) -> tuple[str, int]:
        chunk_size = config.get_chunk_size()
        overlap = config.get_chunk_overlap()

        doc_id = f"doc-{uuid.uuid4().hex}"
        pieces = split_text(content, chunk_size=chunk_size, overlap=overlap)
        with self._lock:
            for piece in pieces:
                chunk = RagChunk(
                    chunk_id=f"chunk-{uuid.uuid4().hex}",
                    doc_id=doc_id,
                    title=title,
                    text=piece,
                    source_type=source_type,
                    source_id=source_id,
                    tags=[tag.strip() for tag in tags if tag.strip()],
                    owner_role=owner_role,
                )
                self._chunks.append(chunk)

        return doc_id, len(pieces)

    def retrieve(self, query: str, top_k: int, filters: dict[str, Any]) -> list[RagSearchResult]:
        query_tokens = tokenize(query)
        if not query_tokens:
            return []

        normalized_top_k = max(1, min(top_k, 20))
        filtered = [chunk for chunk in self._chunks if _matches_filters(chunk, filters)]
        scored: list[RagSearchResult] = []
        for chunk in filtered:
            score = _compute_score(query_tokens, tokenize(chunk.text))
            if score > 0:
                scored.append(RagSearchResult(chunk=chunk, score=score))

        scored.sort(key=lambda item: item.score, reverse=True)
        return scored[:normalized_top_k]


# ===== Qdrant 后端（向量检索）=====


class QdrantBackend:
    """Qdrant + fastembed 向量检索后端。"""

    def __init__(self) -> None:
        from app.rag.vector_store import QdrantStore, ChunkPayload
        self._ChunkPayload = ChunkPayload

        url = config.get_qdrant_url()
        api_key = config.get_qdrant_api_key()
        self._store = QdrantStore(url=url, api_key=api_key)
        self._lock = Lock()

    def clear(self) -> None:
        with self._lock:
            self._store.clear()

    def delete_document(self, doc_id: str) -> None:
        self._store.delete_by_doc_id(doc_id)

    def ingest(self, *, title: str, content: str, source_type: str, source_id: str | None, tags: list[str], owner_role: str | None) -> tuple[str, int]:
        chunk_size = config.get_chunk_size()
        overlap = config.get_chunk_overlap()

        doc_id = f"doc-{uuid.uuid4().hex}"
        pieces = split_text(content, chunk_size=chunk_size, overlap=overlap)
        payloads = []
        for idx, piece in enumerate(pieces):
            payloads.append(self._ChunkPayload(
                chunk_id=f"chunk-{uuid.uuid4().hex}",
                doc_id=doc_id,
                title=title,
                text=piece,
                source_type=source_type,
                source_id=source_id,
                tags=[tag.strip() for tag in tags if tag.strip()],
                owner_role=owner_role,
                chunk_index=idx,
            ))

        self._store.add_chunks(payloads)
        return doc_id, len(pieces)

    def retrieve(self, query: str, top_k: int, filters: dict[str, Any]) -> list[RagSearchResult]:
        normalized_top_k = max(1, min(top_k, 20))
        hits = self._store.search(query=query, top_k=normalized_top_k, filters=filters or None)

        results: list[RagSearchResult] = []
        for hit in hits:
            chunk = RagChunk(
                chunk_id=hit.payload.chunk_id,
                doc_id=hit.payload.doc_id,
                title=hit.payload.title,
                text=hit.payload.text,
                source_type=hit.payload.source_type,
                source_id=hit.payload.source_id,
                tags=hit.payload.tags,
                owner_role=hit.payload.owner_role,
            )
            results.append(RagSearchResult(chunk=chunk, score=hit.score))

        return results


# ===== 工具函数 =====


def split_text(text: str, *, chunk_size: int, overlap: int) -> list[str]:
    if len(text) <= chunk_size:
        return [text]

    step = max(1, chunk_size - overlap)
    parts: list[str] = []
    start = 0
    while start < len(text):
        end = min(len(text), start + chunk_size)
        piece = text[start:end].strip()
        if piece:
            parts.append(piece)
        if end >= len(text):
            break
        start += step
    return parts


def tokenize(text: str) -> set[str]:
    lowered = text.lower().strip()
    if not lowered:
        return set()
    return set(re.findall(r"[a-z0-9]+|[\u4e00-\u9fff]", lowered))


def _compute_score(query_tokens: set[str], chunk_tokens: set[str]) -> float:
    if not query_tokens or not chunk_tokens:
        return 0.0
    overlap_count = len(query_tokens & chunk_tokens)
    if overlap_count == 0:
        return 0.0
    return overlap_count / math.sqrt(len(query_tokens) * len(chunk_tokens))


def _matches_filters(chunk: RagChunk, filters: dict[str, Any]) -> bool:
    if not filters:
        return True

    source_type = filters.get("source_type")
    if isinstance(source_type, str) and source_type and chunk.source_type != source_type:
        return False

    source_id = filters.get("source_id")
    if isinstance(source_id, str) and source_id and chunk.source_id != source_id:
        return False

    owner_role = filters.get("owner_role")
    if isinstance(owner_role, str) and owner_role and chunk.owner_role != owner_role:
        return False

    tags = filters.get("tags")
    if isinstance(tags, list):
        required_tags = {tag for tag in tags if isinstance(tag, str) and tag.strip()}
        if required_tags and not required_tags.intersection(set(chunk.tags)):
            return False

    return True


def synthesize_answer(question: str, results: list[RagSearchResult]) -> str:
    """基于检索结果合成回答。优先使用 LLM 生成，降级为拼接摘要。"""
    if not results:
        return "未检索到可回答该问题的资料。"
    try:
        return _llm_synthesize(question, results)
    except Exception:
        return _fallback_synthesize(question, results)


def _llm_synthesize(question: str, results: list[RagSearchResult]) -> str:
    """调用 Qwen LLM 基于检索结果生成回答。"""
    import httpx
    from app import llm_service

    api_key, model, base_url = llm_service.resolve_qwen_config(None, None, None)

    context_parts: list[str] = []
    for idx, result in enumerate(results[:5], start=1):
        snippet = result.chunk.text.strip()
        context_parts.append(f"[{idx}] 标题：{result.chunk.title}\n内容：{snippet}")
    context_block = "\n\n".join(context_parts)

    system_prompt = (
        "你是施耐德电气 AI 工坊平台的知识检索助手。"
        "根据提供的参考资料回答用户问题。"
        "回答要简洁、专业，使用中文。"
        "必须在回答中标注引用来源（用 [1] [2] 等编号）。"
        "如果参考资料不足以回答问题，请如实说明。"
    )
    user_prompt = f"参考资料：\n{context_block}\n\n用户问题：{question}"

    response = httpx.post(
        f"{base_url}/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.3,
            "max_tokens": 800,
        },
        timeout=30.0,
    )
    response.raise_for_status()
    content: str = response.json()["choices"][0]["message"]["content"]
    # 清理 Qwen think 标签
    content = re.sub(r"<think>[\s\S]*?</think>", "", content).strip()
    return content


def _fallback_synthesize(question: str, results: list[RagSearchResult]) -> str:
    """LLM 不可用时的降级摘要拼接。"""
    lines = ["根据知识库检索，以下资料可能与您的问题相关："]
    for index, result in enumerate(results[:5], start=1):
        snippet = result.chunk.text.replace("\n", " ").strip()
        if len(snippet) > 150:
            snippet = f"{snippet[:147]}..."
        lines.append(f"\n**{index}. {result.chunk.title}**（相关度：{result.score:.2f}）")
        lines.append(f"   {snippet}")
    return "\n".join(lines)


# ===== 全局单例 =====


_backend: RagBackend | None = None
_backend_lock = Lock()


def get_backend() -> RagBackend:
    """获取全局 RAG 后端单例。"""
    global _backend
    if _backend is not None:
        return _backend

    with _backend_lock:
        if _backend is not None:
            return _backend

        backend_type = config.get_rag_backend()
        if backend_type == "qdrant":
            _backend = QdrantBackend()
        else:
            _backend = MemoryBackend()

    return _backend


def set_backend(backend: RagBackend) -> None:
    """替换全局后端（测试用）。"""
    global _backend
    _backend = backend


def clear_store() -> None:
    """清空当前后端数据（测试用）。"""
    get_backend().clear()
