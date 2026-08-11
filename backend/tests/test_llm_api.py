import asyncio
import time

from fastapi.testclient import TestClient
import httpx

from app import llm_service
from app.api import llm as llm_api
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


def test_structure_project_normalizes_list_field_values(monkeypatch):
    monkeypatch.setenv("QWEN_API_KEY", "system-key")

    def fake_call_qwen(*, raw_text, target_type, api_key, model, base_url):
        return {
            "fields": {
                "name": "能效管理能力",
                "matchable_requirement_types": ["能效优化需求", "能源管理需求", "可持续发展合规需求"],
            },
            "missing_fields": [],
            "follow_up_questions": [],
            "warnings": [],
        }

    monkeypatch.setattr("app.llm_service.call_qwen_for_structure", fake_call_qwen)

    response = client.post(
        "/api/v1/llm/structure-project",
        json={"raw_text": "我们有能效管理能力。"},
    )

    assert response.status_code == 200
    assert response.json()["fields"]["matchable_requirement_types"] == "能效优化需求、能源管理需求、可持续发展合规需求"


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


def test_structure_returns_editable_fallback_when_qwen_times_out(monkeypatch):
    monkeypatch.setenv("QWEN_API_KEY", "system-key")

    def fake_call_qwen(*, raw_text, target_type, api_key, model, base_url):
        request = httpx.Request("POST", f"{base_url}/chat/completions")
        raise httpx.ReadTimeout("timed out", request=request)

    monkeypatch.setattr("app.llm_service.call_qwen_for_structure", fake_call_qwen)

    response = client.post(
        "/api/v1/llm/structure-requirement",
        json={"raw_text": "客户需要节能。"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["fields"]["description"] == "客户需要节能。"
    assert "customer" in payload["missing_fields"]
    assert payload["fallback_used"] is True
    assert payload["warnings"] == ["AI 服务响应超时，已保留原始描述，请人工补充后再应用。"]
    assert "system-key" not in response.text


def test_qwen_structure_disables_thinking_and_limits_output(monkeypatch):
    captured_payload = None

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "choices": [
                    {"message": {"content": '{"fields": {}, "missing_fields": [], "follow_up_questions": [], "warnings": []}'}}
                ]
            }

    def fake_post(*_args, json, **_kwargs):
        nonlocal captured_payload
        captured_payload = json
        return FakeResponse()

    monkeypatch.setattr("app.llm_service.httpx.post", fake_post)

    result = llm_service.call_qwen_for_structure(
        raw_text="客户需要节能。",
        target_type="requirement",
        api_key="system-key",
        model="qwen3.6-plus",
        base_url="https://model.example/v1",
    )

    assert result["fields"] == {}
    assert captured_payload["enable_thinking"] is False
    assert captured_payload["max_tokens"] == 800


def test_structure_returns_gateway_timeout_before_proxy_deadline(monkeypatch):
    monkeypatch.setenv("QWEN_API_KEY", "system-key")

    async def fake_to_thread(*_args, **_kwargs):
        await asyncio.sleep(0.01)

    monkeypatch.setattr(llm_api, "LLM_STRUCTURE_TOTAL_TIMEOUT_SECONDS", 0.001)
    monkeypatch.setattr(llm_api.asyncio, "to_thread", fake_to_thread)

    response = client.post(
        "/api/v1/llm/structure-requirement",
        json={"raw_text": "客户需要节能。"},
    )

    assert response.status_code == 200
    assert response.json()["fields"]["description"] == "客户需要节能。"
    assert response.json()["warnings"] == ["AI 服务响应超时，已保留原始描述，请人工补充后再应用。"]


def test_structure_fallback_extracts_verifiable_datacenter_fields():
    result = llm_service.build_structure_fallback(
        "某数据中心客户希望降低PUE，但目前缺少统一能耗分析，希望近期做一次节能评估，并持续监测配电与制冷系统运行状态。",
        "requirement",
    )

    assert result["fields"]["title"] == "数据中心能效优化与节能评估需求"
    assert result["fields"]["business_line"] == "数据中心"
    assert result["fields"]["urgency"] == "medium"
    assert result["fields"]["timeline_or_stage"] == "近期"
    assert "PUE 优化" in result["fields"]["expected_capability"]
    assert "customer" in result["missing_fields"]


def test_structure_falls_back_when_real_worker_thread_is_stuck(monkeypatch):
    monkeypatch.setenv("QWEN_API_KEY", "system-key")

    def blocking_call_qwen(**_kwargs):
        time.sleep(0.1)
        return {"fields": {}}

    monkeypatch.setattr("app.llm_service.call_qwen_for_structure", blocking_call_qwen)
    monkeypatch.setattr(llm_api, "LLM_STRUCTURE_TOTAL_TIMEOUT_SECONDS", 0.01)

    response = client.post(
        "/api/v1/llm/structure-requirement",
        json={"raw_text": "客户需要节能。"},
    )

    assert response.status_code == 200
    assert response.json()["warnings"] == ["AI 服务响应超时，已保留原始描述，请人工补充后再应用。"]


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


def test_recognize_image_returns_extracted_text(monkeypatch):
    monkeypatch.delenv("QWEN_API_KEY", raising=False)

    def fake_call_qwen(*, image_bytes, mime_type, prompt, api_key, model, base_url):
        assert image_bytes == b"fake-png"
        assert mime_type == "image/png"
        assert "需求" in prompt
        assert api_key == "browser-key"
        assert model == "qwen3.6-plus"
        assert base_url
        return "图片中包含：客户希望建设楼宇能耗监测平台。"

    monkeypatch.setattr("app.llm_service.call_qwen_for_image_recognition", fake_call_qwen)

    response = client.post(
        "/api/v1/llm/recognize-image",
        data={
            "prompt": "请识别图片中的需求信息",
            "api_key": "browser-key",
        },
        files={"file": ("requirement.png", b"fake-png", "image/png")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert "楼宇能耗监测" in payload["text"]
    assert payload["model"] == "qwen3.6-plus"
    assert "browser-key" not in response.text


def test_recognize_image_rejects_unsupported_file(monkeypatch):
    monkeypatch.setenv("QWEN_API_KEY", "system-key")

    response = client.post(
        "/api/v1/llm/recognize-image",
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "仅支持 PNG、JPG、JPEG、WEBP 图片"


def test_recognize_image_requires_api_key(monkeypatch):
    monkeypatch.delenv("QWEN_API_KEY", raising=False)

    response = client.post(
        "/api/v1/llm/recognize-image",
        files={"file": ("requirement.png", b"fake-png", "image/png")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "LLM 未配置，请联系管理员或在设置中临时填写 API key"
