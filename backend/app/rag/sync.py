"""RAG auto-sync. Ingest projects/requirements into RAG on create/update."""
from __future__ import annotations

import logging
from threading import Thread

from sqlmodel import Session, select

from app.rag import service as rag_service
from app.models import KnowledgeDocument, Project, Requirement, utc_now

logger = logging.getLogger(__name__)


def rebuild_index_from_database(session: Session) -> tuple[int, int]:
    """从 SQLite 业务数据重建能力、需求和知识文档索引。"""
    backend = rag_service.get_backend()
    backend.clear()
    document_count = 0
    chunk_count = 0

    for project in session.exec(select(Project)).all():
        tags = [tag.name for tag in project.tags]
        parts = [
            f"能力名称：{project.name}",
            f"负责人：{project.owner}",
            f"状态：{project.status}",
        ]
        if tags:
            parts.append(f"标签：{'、'.join(tags)}")
        if project.description:
            parts.append(f"描述：{project.description}")
        _, chunks = backend.ingest(
            title=project.name,
            content="\n".join(parts),
            source_type="project",
            source_id=str(project.id),
            tags=tags,
            owner_role=project.owner,
        )
        document_count += 1
        chunk_count += chunks

    for requirement in session.exec(select(Requirement)).all():
        tags = [tag.name for tag in requirement.tags]
        parts = [
            f"需求标题：{requirement.title}",
            f"客户：{requirement.customer}",
            f"紧急度：{requirement.urgency}",
            f"状态：{requirement.status}",
        ]
        if requirement.contact:
            parts.append(f"联系人：{requirement.contact}")
        if tags:
            parts.append(f"标签：{'、'.join(tags)}")
        parts.append(f"描述：{requirement.description}")
        _, chunks = backend.ingest(
            title=requirement.title,
            content="\n".join(parts),
            source_type="requirement",
            source_id=str(requirement.id),
            tags=tags,
            owner_role=requirement.customer,
        )
        document_count += 1
        chunk_count += chunks

    for document in session.exec(select(KnowledgeDocument)).all():
        doc_id, chunks = backend.ingest(
            title=document.title,
            content=document.content,
            source_type=document.source_type,
            source_id=document.source_id,
            tags=document.tags,
            owner_role=document.owner_role,
        )
        document.doc_id = doc_id
        document.chunk_count = chunks
        document.updated_at = utc_now()
        session.add(document)
        document_count += 1
        chunk_count += chunks

    session.commit()
    return document_count, chunk_count


def sync_project_to_rag(
    *, project_id: int, name: str, description: str | None,
    owner: str, status: str, tags: list[str],
) -> None:
    """Async ingest project into RAG index."""
    parts = [f"能力名称：{name}", f"负责人：{owner}", f"状态：{status}"]
    if tags:
        parts.append(f"标签：{'、'.join(tags)}")
    if description:
        parts.append(f"描述：{description}")
    content = "\n".join(parts)
    if not content.strip():
        return
    _async_ingest(
        title=name, content=content, source_type="project",
        source_id=str(project_id), tags=tags, owner_role=owner,
    )


def sync_requirement_to_rag(
    *, requirement_id: int, title: str, description: str,
    customer: str, contact: str | None, urgency: str, status: str, tags: list[str],
) -> None:
    """Async ingest requirement into RAG index."""
    parts = [f"需求标题：{title}", f"客户：{customer}", f"紧急度：{urgency}", f"状态：{status}"]
    if contact:
        parts.append(f"联系人：{contact}")
    if tags:
        parts.append(f"标签：{'、'.join(tags)}")
    if description:
        parts.append(f"描述：{description}")
    content = "\n".join(parts)
    if not content.strip():
        return
    _async_ingest(
        title=title, content=content, source_type="requirement",
        source_id=str(requirement_id), tags=tags, owner_role=customer,
    )


def _async_ingest(
    *, title: str, content: str, source_type: str,
    source_id: str, tags: list[str], owner_role: str,
) -> None:
    """Run ingest in background thread to avoid blocking API response."""
    def _do_ingest():
        try:
            backend = rag_service.get_backend()
            backend.ingest(
                title=title, content=content, source_type=source_type,
                source_id=source_id, tags=tags, owner_role=owner_role,
            )
            logger.info(f"RAG sync ok: {source_type}/{source_id} - {title}")
        except Exception:
            logger.exception(f"RAG sync failed: {source_type}/{source_id} - {title}")

    Thread(target=_do_ingest, daemon=True).start()
