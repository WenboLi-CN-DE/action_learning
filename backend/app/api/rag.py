from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from sqlmodel import Session, select

from app.database import get_session
from app.models import KnowledgeDocument, Project, Requirement, utc_now

from app.rag import service as rag_service
from app.schemas import (
    RAGChunkRead,
    RAGCitationRead,
    RAGIngestRequest,
    RAGIngestResult,
    RAGImportResult,
    RAGDocumentRead,
    RAGRebuildResult,
    RAGQueryRequest,
    RAGQueryResult,
    RAGRetrieveRequest,
    RAGRetrieveResult,
)

router = APIRouter(prefix="/rag", tags=["rag"])
SUPPORTED_IMPORT_EXTENSIONS = {".txt", ".md", ".csv"}


@router.post("/ingest", response_model=RAGIngestResult)
def ingest_document(
    payload: RAGIngestRequest,
    session: Session = Depends(get_session),
):
    title = payload.title.strip()
    content = payload.content.strip()
    if not title:
        raise HTTPException(status_code=400, detail="title 不能为空")
    if not content:
        raise HTTPException(status_code=400, detail="content 不能为空")

    backend = rag_service.get_backend()
    doc_id, chunk_count = backend.ingest(
        title=title,
        content=content,
        source_type=payload.source_type,
        source_id=payload.source_id,
        tags=payload.tags,
        owner_role=payload.owner_role,
    )
    session.add(
        KnowledgeDocument(
            doc_id=doc_id,
            title=title,
            content=content,
            source_type=payload.source_type,
            source_id=payload.source_id,
            tags=payload.tags,
            owner_role=payload.owner_role,
            chunk_count=chunk_count,
        )
    )
    session.commit()
    return RAGIngestResult(doc_id=doc_id, chunk_count=chunk_count)


@router.post("/import-file", response_model=RAGImportResult)
async def import_file(
    file: UploadFile = File(...),
    source_type: str = Form("manual"),
    source_id: str | None = Form(None),
    tags: str = Form(""),
    owner_role: str | None = Form(None),
    session: Session = Depends(get_session),
):
    filename = file.filename or "未命名资料"
    suffix = Path(filename).suffix.lower()
    if suffix not in SUPPORTED_IMPORT_EXTENSIONS:
        raise HTTPException(status_code=400, detail="仅支持 .txt、.md、.csv 文件")

    raw = await file.read()
    try:
        content = raw.decode("utf-8").strip()
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="文件必须使用 UTF-8 编码") from None

    if not content:
        raise HTTPException(status_code=400, detail="文件内容不能为空")

    parsed_tags = [tag.strip() for tag in tags.replace("，", ",").split(",") if tag.strip()]
    backend = rag_service.get_backend()
    doc_id, chunk_count = backend.ingest(
        title=filename,
        content=content,
        source_type=source_type.strip() or "manual",
        source_id=source_id.strip() if source_id else None,
        tags=parsed_tags,
        owner_role=owner_role.strip() if owner_role else None,
    )
    session.add(
        KnowledgeDocument(
            doc_id=doc_id,
            title=filename,
            content=content,
            source_type=source_type.strip() or "manual",
            source_id=source_id.strip() if source_id else None,
            tags=parsed_tags,
            owner_role=owner_role.strip() if owner_role else None,
            chunk_count=chunk_count,
        )
    )
    session.commit()
    return RAGImportResult(doc_id=doc_id, chunk_count=chunk_count, title=filename)


@router.get("/documents", response_model=list[RAGDocumentRead])
def list_documents(session: Session = Depends(get_session)):
    return session.exec(
        select(KnowledgeDocument).order_by(KnowledgeDocument.created_at.desc())
    ).all()


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: int,
    session: Session = Depends(get_session),
):
    document = session.get(KnowledgeDocument, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Knowledge document not found")
    rag_service.get_backend().delete_document(document.doc_id)
    session.delete(document)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/rebuild", response_model=RAGRebuildResult)
def rebuild_index(session: Session = Depends(get_session)):
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
    return RAGRebuildResult(
        document_count=document_count,
        chunk_count=chunk_count,
    )


@router.post("/retrieve", response_model=RAGRetrieveResult)
def retrieve_chunks(payload: RAGRetrieveRequest):
    backend = rag_service.get_backend()
    results = backend.retrieve(query=payload.query, top_k=payload.top_k, filters=payload.filters)

    chunks = [
        RAGChunkRead(
            chunk_id=item.chunk.chunk_id,
            doc_id=item.chunk.doc_id,
            score=item.score,
            text=item.chunk.text,
            title=item.chunk.title,
            source_type=item.chunk.source_type,
            source_id=item.chunk.source_id,
            tags=item.chunk.tags,
            owner_role=item.chunk.owner_role,
        )
        for item in results
    ]
    return RAGRetrieveResult(chunks=chunks)


@router.post("/query", response_model=RAGQueryResult)
def rag_query(payload: RAGQueryRequest):
    backend = rag_service.get_backend()
    results = backend.retrieve(query=payload.question, top_k=payload.top_k, filters=payload.filters)
    answer = rag_service.synthesize_answer(payload.question, results)

    chunks = [
        RAGChunkRead(
            chunk_id=item.chunk.chunk_id,
            doc_id=item.chunk.doc_id,
            score=item.score,
            text=item.chunk.text,
            title=item.chunk.title,
            source_type=item.chunk.source_type,
            source_id=item.chunk.source_id,
            tags=item.chunk.tags,
            owner_role=item.chunk.owner_role,
        )
        for item in results
    ]
    citations = [
        RAGCitationRead(
            chunk_id=item.chunk.chunk_id,
            doc_id=item.chunk.doc_id,
            title=item.chunk.title,
            score=item.score,
        )
        for item in results
    ]
    return RAGQueryResult(answer=answer, citations=citations, retrieved_chunks=chunks)
