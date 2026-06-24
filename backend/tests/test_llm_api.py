from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_llm_status_reports_missing_system_key(monkeypatch):
    monkeypatch.delenv("QWEN_API_KEY", raising=False)
    monkeypatch.delenv("QWEN_MODEL", raising=False)

    response = client.get("/api/v1/llm/status")

    assert response.status_code == 200
    assert response.json() == {
        "configured": False,
        "model": "qwen3.6-plus",
    }


def test_llm_status_reports_configured_system_key(monkeypatch):
    monkeypatch.setenv("QWEN_API_KEY", "sk-test")
    monkeypatch.setenv("QWEN_MODEL", "qwen3.6-plus")

    response = client.get("/api/v1/llm/status")

    assert response.status_code == 200
    assert response.json() == {
        "configured": True,
        "model": "qwen3.6-plus",
    }
    assert "sk-test" not in response.text
