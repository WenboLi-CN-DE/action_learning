from fastapi.testclient import TestClient
import httpx

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


def test_structure_requirement_uses_qwen_and_returns_normalized_result(monkeypatch):
    monkeypatch.delenv("QWEN_API_KEY", raising=False)

    def fake_call_qwen(*, raw_text, target_type, api_key, model, base_url):
        assert raw_text == "客户希望优化数据中心能耗。"
        assert target_type == "requirement"
        assert api_key == "browser-key"
        assert model == "qwen3.6-plus"
        assert base_url
        return {
            "fields": {
                "title": "数据中心能耗优化需求",
                "customer": "未提供",
                "description": "客户希望优化数据中心能耗，需补充客户名称和时间节点。",
                "urgency": "medium",
                "business_line": "数据中心",
                "business_scenario": "数据中心能源管理",
                "pain_points": "能耗较高",
                "expected_capability": "能耗分析与优化建议",
                "timeline_or_stage": "",
                "contact": "",
            },
            "missing_fields": ["客户名称", "时间节点或机会阶段", "提需求人/联系人"],
            "follow_up_questions": ["客户名称是什么？", "期望什么时候完成评估？"],
            "warnings": [],
        }

    monkeypatch.setattr("app.llm_service.call_qwen_for_structure", fake_call_qwen)

    response = client.post(
        "/api/v1/llm/structure-requirement",
        json={
            "raw_text": "客户希望优化数据中心能耗。",
            "api_key": "browser-key",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["fields"]["title"] == "数据中心能耗优化需求"
    assert payload["fields"]["business_line"] == "数据中心"
    assert "客户名称" in payload["missing_fields"]
    assert payload["model"] == "qwen3.6-plus"
    assert "browser-key" not in response.text


def test_structure_project_uses_system_key_when_browser_key_absent(monkeypatch):
    monkeypatch.setenv("QWEN_API_KEY", "system-key")

    def fake_call_qwen(*, raw_text, target_type, api_key, model, base_url):
        assert raw_text == "我们有楼宇能效管理 demo。"
        assert target_type == "project"
        assert api_key == "system-key"
        assert model == "qwen3.6-plus"
        assert base_url
        return {
            "fields": {
                "name": "楼宇能效管理 Demo",
                "owner": "未提供",
                "status": "demo_ready",
                "description": "面向楼宇场景的能效管理演示能力。",
                "business_line": "楼宇",
                "business_scenario": "楼宇能源管理",
                "core_capability": "能耗监测与优化建议",
                "maturity": "demo-ready",
                "deliverable_form": "demo",
                "matchable_requirement_types": "楼宇节能与运营优化需求",
                "constraints": "",
            },
            "missing_fields": ["负责人"],
            "follow_up_questions": ["该能力负责人是谁？"],
            "warnings": [],
        }

    monkeypatch.setattr("app.llm_service.call_qwen_for_structure", fake_call_qwen)

    response = client.post(
        "/api/v1/llm/structure-project",
        json={"raw_text": "我们有楼宇能效管理 demo。"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["fields"]["name"] == "楼宇能效管理 Demo"
    assert payload["fields"]["status"] == "demo_ready"
    assert "负责人" in payload["missing_fields"]
    assert "system-key" not in response.text


def test_structure_returns_clear_error_without_api_key(monkeypatch):
    monkeypatch.delenv("QWEN_API_KEY", raising=False)

    response = client.post(
        "/api/v1/llm/structure-requirement",
        json={"raw_text": "客户需要节能。"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "LLM 未配置，请联系管理员或在设置中临时填写 API key"


def test_structure_returns_clear_error_for_invalid_model_json(monkeypatch):
    monkeypatch.setenv("QWEN_API_KEY", "system-key")

    def fake_call_qwen(*, raw_text, target_type, api_key, model, base_url):
        raise ValueError("invalid json")

    monkeypatch.setattr("app.llm_service.call_qwen_for_structure", fake_call_qwen)

    response = client.post(
        "/api/v1/llm/structure-requirement",
        json={"raw_text": "客户需要节能。"},
    )

    assert response.status_code == 502
    assert response.json()["detail"] == "LLM 调用失败：ValueError"
    assert "system-key" not in response.text


def test_structure_returns_sanitized_upstream_http_error(monkeypatch):
    monkeypatch.setenv("QWEN_API_KEY", "system-key")

    def fake_call_qwen(*, raw_text, target_type, api_key, model, base_url):
        request = httpx.Request("POST", f"{base_url}/chat/completions")
        response = httpx.Response(
            401,
            request=request,
            json={"message": "Invalid API key sk-secret-value"},
        )
        raise httpx.HTTPStatusError("upstream auth failed", request=request, response=response)

    monkeypatch.setattr("app.llm_service.call_qwen_for_structure", fake_call_qwen)

    response = client.post(
        "/api/v1/llm/structure-project",
        json={"raw_text": "测试能力描述"},
    )

    assert response.status_code == 502
    assert response.json()["detail"] == "LLM 调用失败：Qwen API 返回 401：Invalid API key [redacted]"
    assert "system-key" not in response.text
    assert "sk-secret-value" not in response.text
