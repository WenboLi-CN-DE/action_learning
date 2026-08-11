import os

os.environ["RAG_BACKEND"] = "memory"

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.database import engine
from app.main import app, on_startup
from app.models import Project
from app.rag.service import MemoryBackend, set_backend


client = TestClient(app)


def setup_function() -> None:
    set_backend(MemoryBackend())


def _ingest_manual_document(title: str, content: str):
    response = client.post(
        "/api/v1/rag/ingest",
        json={
            "title": title,
            "content": content,
            "source_type": "manual",
            "tags": ["节能", "知识库"],
            "owner_role": "管理员",
        },
    )
    assert response.status_code == 200
    return response.json()


def test_admin_can_list_and_delete_managed_documents():
    ingested = _ingest_manual_document(
        "冷站节能操作手册",
        "冷站节能评估应检查冷机效率、冷却水温度和负荷分配。",
    )

    documents = client.get("/api/v1/rag/documents")
    assert documents.status_code == 200
    document = next(
        item for item in documents.json() if item["doc_id"] == ingested["doc_id"]
    )
    assert document["title"] == "冷站节能操作手册"
    assert document["chunk_count"] >= 1

    deleted = client.delete(f"/api/v1/rag/documents/{document['id']}")
    assert deleted.status_code == 204

    retrieval = client.post(
        "/api/v1/rag/retrieve",
        json={"query": "冷机效率", "top_k": 5},
    )
    assert retrieval.status_code == 200
    assert retrieval.json()["chunks"] == []


def test_admin_can_rebuild_index_from_database_records():
    _ingest_manual_document(
        "配电巡检说明",
        "中压配电巡检需要关注温升、局放和告警闭环。",
    )
    set_backend(MemoryBackend())

    rebuilt = client.post("/api/v1/rag/rebuild")
    assert rebuilt.status_code == 200
    assert rebuilt.json()["document_count"] >= 1
    assert rebuilt.json()["chunk_count"] >= 1

    retrieval = client.post(
        "/api/v1/rag/retrieve",
        json={"query": "温升局放", "top_k": 5},
    )
    assert retrieval.status_code == 200
    assert any(
        item["title"] == "配电巡检说明"
        for item in retrieval.json()["chunks"]
    )


def test_startup_rebuilds_capability_index_from_database_records():
    with Session(engine) as session:
        session.add(
            Project(
                name="数据中心能效诊断能力",
                description="提供数据中心负载分析、制冷优化和节能评估。",
                owner="数据中心解决方案团队",
                status="demo_ready",
            )
        )
        session.commit()
    set_backend(MemoryBackend())

    on_startup()

    retrieval = client.post(
        "/api/v1/rag/retrieve",
        json={"query": "数据中心能效", "top_k": 5, "filters": {"source_type": "project"}},
    )
    assert retrieval.status_code == 200
    assert any(
        item["title"] == "数据中心能效诊断能力"
        for item in retrieval.json()["chunks"]
    )


def test_chat_uses_rag_context_history_and_returns_citations(monkeypatch):
    monkeypatch.setenv("QWEN_API_KEY", "system-key")
    _ingest_manual_document(
        "PUE 优化指南",
        "数据中心 PUE 优化应先分析制冷系统和 IT 负载的能耗占比。",
    )

    def fake_chat(*, question, history, context, api_key, model, base_url):
        assert question == "第一步应该做什么？"
        assert history[0]["content"] == "我们正在评估数据中心 PUE"
        assert "制冷系统" in context
        assert api_key == "system-key"
        return "第一步应建立制冷系统与 IT 负载的能耗基线。[1]"

    monkeypatch.setattr("app.llm_service.call_qwen_for_rag_chat", fake_chat)
    response = client.post(
        "/api/v1/chat",
        json={
            "messages": [
                {"role": "user", "content": "我们正在评估数据中心 PUE"},
                {"role": "assistant", "content": "请继续说明问题。"},
                {"role": "user", "content": "第一步应该做什么？"},
            ]
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert "能耗基线" in payload["answer"]
    assert payload["citations"][0]["title"] == "PUE 优化指南"
    assert payload["model"]


def test_chat_reports_empty_knowledge_base_without_requiring_an_api_key(monkeypatch):
    monkeypatch.delenv("QWEN_API_KEY", raising=False)

    response = client.post(
        "/api/v1/chat",
        json={"messages": [{"role": "user", "content": "平台有哪些能力？"}]},
    )

    assert response.status_code == 200
    assert "暂未检索到" in response.json()["answer"]
    assert response.json()["citations"] == []
