import json
import os
from typing import Any

import httpx
from fastapi import HTTPException

DEFAULT_QWEN_MODEL = "qwen3.6-plus"
DEFAULT_QWEN_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
MISSING_KEY_MESSAGE = "LLM 未配置，请联系管理员或在设置中临时填写 API key"


def get_default_model() -> str:
    return os.getenv("QWEN_MODEL", DEFAULT_QWEN_MODEL)


def has_system_api_key() -> bool:
    return bool(os.getenv("QWEN_API_KEY"))


def resolve_qwen_config(api_key: str | None, model: str | None, base_url: str | None) -> tuple[str, str, str]:
    resolved_key = api_key or os.getenv("QWEN_API_KEY")
    if not resolved_key:
        raise HTTPException(status_code=400, detail=MISSING_KEY_MESSAGE)
    resolved_model = model or get_default_model()
    resolved_base_url = (base_url or os.getenv("QWEN_BASE_URL") or DEFAULT_QWEN_BASE_URL).rstrip("/")
    return resolved_key, resolved_model, resolved_base_url


def build_structure_prompt(raw_text: str, target_type: str) -> list[dict[str, str]]:
    if target_type == "requirement":
        target_label = "客户需求"
        required = "客户名称、行业或业务线、业务场景、当前痛点、期望能力、紧急度、时间节点或机会阶段、提需求人或联系人"
        fields = (
            "title, customer, contact, urgency, description, business_line, business_scenario, "
            "pain_points, expected_capability, timeline_or_stage, current_solution, expected_value"
        )
    else:
        target_label = "后端预研能力/项目"
        required = "能力名称、负责人、行业或业务线、适用业务场景、核心能力、成熟度或状态、可交付形式、可匹配需求类型、限制条件"
        fields = (
            "name, owner, status, description, business_line, business_scenario, core_capability, "
            "maturity, deliverable_form, matchable_requirement_types, constraints"
        )

    system = (
        "你是施耐德电气内部 AI 工坊平台的信息结构化助手。"
        "请围绕数据中心、水处理、工业自动化、楼宇管理、电力配电、能源管理、可持续发展、数字化服务、软件和自动化集成等业务方向提取信息。"
        "只返回 JSON，不要返回 Markdown。"
    )
    user = (
        f"请将下面的{target_label}描述整理为结构化 JSON。"
        f"fields 中尽量使用这些字段：{fields}。"
        f"必须检查这些关键信息是否充分：{required}。"
        '返回格式为：{"fields": {...}, "missing_fields": [], "follow_up_questions": [], "warnings": []}。'
        f"原始描述：{raw_text}"
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def normalize_structure_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "fields": payload.get("fields") if isinstance(payload.get("fields"), dict) else {},
        "missing_fields": payload.get("missing_fields") if isinstance(payload.get("missing_fields"), list) else [],
        "follow_up_questions": payload.get("follow_up_questions") if isinstance(payload.get("follow_up_questions"), list) else [],
        "warnings": payload.get("warnings") if isinstance(payload.get("warnings"), list) else [],
    }


def parse_qwen_json_content(content: str) -> dict[str, Any]:
    text = content.strip()
    if text.startswith("```"):
        lines = [line for line in text.splitlines() if not line.strip().startswith("```")]
        text = "\n".join(lines).strip()
    return normalize_structure_payload(json.loads(text))


def call_qwen_for_structure(
    *,
    raw_text: str,
    target_type: str,
    api_key: str,
    model: str,
    base_url: str,
) -> dict[str, Any]:
    response = httpx.post(
        f"{base_url}/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "messages": build_structure_prompt(raw_text, target_type),
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
        },
        timeout=30.0,
    )
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"]
    return parse_qwen_json_content(content)
