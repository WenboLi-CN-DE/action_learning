from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.rag import service as rag_service
from app.schemas import (
    RAGChunkRead,
    RAGCitationRead,
    RAGIngestRequest,
    RAGIngestResult,
    RAGImportResult,
    RAGQueryRequest,
    RAGQueryResult,
    RAGRetrieveRequest,
    RAGRetrieveResult,
)

router = APIRouter(prefix="/rag", tags=["rag"])
SUPPORTED_IMPORT_EXTENSIONS = {".txt", ".md", ".csv"}


@router.post("/ingest", response_model=RAGIngestResult)
def ingest_document(payload: RAGIngestRequest):
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
    return RAGIngestResult(doc_id=doc_id, chunk_count=chunk_count)


@router.post("/import-file", response_model=RAGImportResult)
async def import_file(
    file: UploadFile = File(...),
    source_type: str = Form("manual"),
    source_id: str | None = Form(None),
    tags: str = Form(""),
    owner_role: str | None = Form(None),
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
    return RAGImportResult(doc_id=doc_id, chunk_count=chunk_count, title=filename)


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
