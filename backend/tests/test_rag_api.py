import os

# 强制测试使用 memory 后端（不需下载 embedding 模型）
os.environ["RAG_BACKEND"] = "memory"

from fastapi.testclient import TestClient

from app.main import app
from app.rag import service as rag_service
from app.rag.service import MemoryBackend, set_backend

client = TestClient(app)


def setup_function() -> None:
    """每个测试前重置为干净的 memory 后端。"""
    backend = MemoryBackend()
    set_backend(backend)


def test_rag_ingest_and_retrieve_flow():
    ingest_response = client.post(
        "/api/v1/rag/ingest",
        json={
            "title": "楼宇节能方案",
            "content": "该方案支持楼宇能耗监测、告警和优化建议，适用于商业楼宇场景。",
            "source_type": "project",
            "source_id": "P-100",
            "tags": ["楼宇", "节能"],
            "owner_role": "研发",
        },
    )

    assert ingest_response.status_code == 200
    ingest_payload = ingest_response.json()
    assert ingest_payload["doc_id"].startswith("doc-")
    assert ingest_payload["chunk_count"] >= 1

    retrieve_response = client.post(
        "/api/v1/rag/retrieve",
        json={
            "query": "楼宇能耗优化",
            "top_k": 3,
            "filters": {"source_type": "project", "tags": ["节能"]},
        },
    )

    assert retrieve_response.status_code == 200
    chunks = retrieve_response.json()["chunks"]
    assert len(chunks) >= 1
    assert chunks[0]["source_type"] == "project"
    assert "楼宇" in chunks[0]["text"]


def test_rag_query_returns_answer_and_citations():
    client.post(
        "/api/v1/rag/ingest",
        json={
            "title": "数据中心冷却优化",
            "content": "该项目可分析数据中心冷却系统，给出节能和可靠性优化建议。",
            "source_type": "project",
            "source_id": "P-200",
            "tags": ["数据中心", "冷却"],
            "owner_role": "解决方案工程师",
        },
    )

    response = client.post(
        "/api/v1/rag/query",
        json={
            "question": "有没有数据中心冷却相关能力？",
            "top_k": 5,
            "filters": {"source_type": "project"},
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert "数据中心" in payload["answer"]
    assert len(payload["citations"]) >= 1
    assert len(payload["retrieved_chunks"]) >= 1


def test_rag_ingest_rejects_empty_content():
    response = client.post(
        "/api/v1/rag/ingest",
        json={
            "title": "空内容文档",
            "content": "   ",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "content 不能为空"


def test_rag_retrieve_with_no_match():
    response = client.post(
        "/api/v1/rag/retrieve",
        json={
            "query": "量子计算",
            "top_k": 5,
        },
    )

    assert response.status_code == 200
    assert response.json()["chunks"] == []


def test_rag_query_no_results_gives_fallback_answer():
    response = client.post(
        "/api/v1/rag/query",
        json={
            "question": "有没有区块链相关项目？",
            "top_k": 5,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert "未检索到" in payload["answer"]
    assert payload["citations"] == []
    assert payload["retrieved_chunks"] == []


def test_rag_import_text_file_ingests_content():
    response = client.post(
        "/api/v1/rag/import-file",
        data={
            "source_type": "manual",
            "tags": "楼宇,节能",
            "owner_role": "市场资料",
        },
        files={
            "file": (
                "building-energy.md",
                b"# Building Energy\n\n\xe6\xa5\xbc\xe5\xae\x87\xe8\x83\xbd\xe8\x80\x97\xe7\x9b\x91\xe6\xb5\x8b\xe5\x92\x8c\xe8\x8a\x82\xe8\x83\xbd\xe4\xbc\x98\xe5\x8c\x96\xe6\x96\xb9\xe6\xa1\x88\xe3\x80\x82",
                "text/markdown",
            )
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["doc_id"].startswith("doc-")
    assert payload["chunk_count"] >= 1
    assert payload["title"] == "building-energy.md"

    retrieve_response = client.post(
        "/api/v1/rag/retrieve",
        json={"query": "楼宇节能", "top_k": 3, "filters": {"tags": ["节能"]}},
    )

    assert retrieve_response.status_code == 200
    chunks = retrieve_response.json()["chunks"]
    assert len(chunks) >= 1
    assert chunks[0]["title"] == "building-energy.md"


def test_rag_import_rejects_empty_file():
    response = client.post(
        "/api/v1/rag/import-file",
        files={"file": ("empty.txt", b"   ", "text/plain")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "文件内容不能为空"


def test_rag_import_rejects_unsupported_extension():
    response = client.post(
        "/api/v1/rag/import-file",
        files={"file": ("deck.pdf", b"%PDF-1.7", "application/pdf")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "仅支持 .txt、.md、.csv 文件"
