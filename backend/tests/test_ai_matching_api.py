from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine

from app.api.requirements import router as requirements_router
from app.database import get_session
from app.main import app
from app.models import Requirement


client = TestClient(app)


def _create_project(name: str, description: str, tag_ids: list[int]):
    return client.post(
        "/api/v1/projects",
        json={
            "name": name,
            "description": description,
            "owner": "研发团队",
            "status": "demo_ready",
            "tag_ids": tag_ids,
        },
    ).json()


def test_ai_matching_ranks_candidates_and_can_be_confirmed(monkeypatch):
    monkeypatch.setenv("QWEN_API_KEY", "system-key")
    tag = client.post(
        "/api/v1/tags", json={"name": "数据中心", "category": "industry"}
    ).json()
    relevant = _create_project(
        "数据中心能耗优化",
        "提供 PUE 分析、能耗监测和节能建议，可交付演示方案。",
        [tag["id"]],
    )
    _create_project("水处理控制", "污水处理自动控制能力。", [])
    requirement = client.post(
        "/api/v1/requirements",
        json={
            "title": "降低数据中心 PUE",
            "description": "客户需要分析能耗并获得节能优化建议。",
            "customer": "客户 A",
            "urgency": "high",
            "status": "new",
            "tag_ids": [tag["id"]],
        },
    ).json()

    def fake_call(*, requirement_context, candidates, api_key, model, base_url):
        assert "降低数据中心 PUE" in requirement_context
        assert candidates[0]["project_id"] == relevant["id"]
        assert api_key == "system-key"
        return {
            "recommendations": [
                {
                    "project_id": relevant["id"],
                    "score": 92,
                    "coverage_status": "covered",
                    "reason": "行业、场景和节能能力高度一致。",
                    "gaps": ["需确认现场数据接口"],
                    "dimensions": {
                        "semantic": 95,
                        "industry": 100,
                        "scenario": 90,
                        "delivery": 80,
                    },
                }
            ]
        }

    monkeypatch.setattr("app.llm_service.call_qwen_for_matching", fake_call)
    response = client.post(
        f"/api/v1/requirements/{requirement['id']}/ai-matches",
        json={"top_k": 5},
    )

    assert response.status_code == 200
    result = response.json()
    assert result["requirement_id"] == requirement["id"]
    assert result["recommendations"][0]["project_id"] == relevant["id"]
    assert result["recommendations"][0]["score"] == 92
    assert result["recommendations"][0]["already_confirmed"] is False

    recommendation = result["recommendations"][0]
    confirmed = client.post(
        "/api/v1/matches",
        json={
            "project_id": recommendation["project_id"],
            "requirement_id": requirement["id"],
            "coverage_status": recommendation["coverage_status"],
            "note": recommendation["reason"],
            "source": "ai",
            "ai_score": recommendation["score"],
            "ai_reason": recommendation["reason"],
            "ai_gaps": recommendation["gaps"],
            "ai_model": result["model"],
        },
    )
    assert confirmed.status_code == 201
    assert confirmed.json()["source"] == "ai"
    assert confirmed.json()["ai_score"] == 92


def test_ai_matching_requires_an_existing_requirement(monkeypatch):
    monkeypatch.setenv("QWEN_API_KEY", "system-key")
    response = client.post("/api/v1/requirements/999999/ai-matches", json={})
    assert response.status_code == 404


def test_ai_matching_returns_empty_result_without_requiring_key_when_pool_is_empty(
    monkeypatch,
):
    monkeypatch.delenv("QWEN_API_KEY", raising=False)
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        requirement = Requirement(
            title="孤立需求",
            description="尚无任何能力数据",
            customer="客户 B",
            urgency="low",
            status="pending_review",
        )
        session.add(requirement)
        session.commit()
        session.refresh(requirement)
        requirement_id = requirement.id

    empty_pool_app = FastAPI()
    empty_pool_app.include_router(requirements_router, prefix="/api/v1")

    def session_override():
        with Session(engine) as session:
            yield session

    empty_pool_app.dependency_overrides[get_session] = session_override
    response = TestClient(empty_pool_app).post(
        f"/api/v1/requirements/{requirement_id}/ai-matches",
        json={},
    )

    assert response.status_code == 200
    assert response.json()["recommendations"] == []
