import json
import os
import base64
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
        "不要编造客户、联系人、负责人、行业或业务线。"
        "严禁输出“验证客户”“验证行业”“测试客户”“测试行业”“示例客户”“某客户”“Demo客户”等占位内容。"
        "如果原文没有提供某项信息，请将该项加入 missing_fields，并在对应字段中留空或省略。"
        "行业/业务线只能使用施耐德电气相关业务域，例如数据中心、水处理、工业自动化、楼宇管理、电力配电、能源管理、可持续发展、数字化服务、软件/自动化集成；无法判断时不要生成行业。"
        "urgency 只能输出 high、medium、low；项目 status 只能输出 researching、demo_ready、delivered、paused；需求 status 只能输出 new、reviewing、matched、closed。"
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


def build_structure_fallback(raw_text: str, target_type: str) -> dict[str, Any]:
    """在模型暂不可用时保留原始描述，避免阻塞人工录入。"""
    if target_type == "requirement":
        fields, missing_fields = build_requirement_fallback_fields(raw_text)
        follow_up_questions = ["客户名称和联系人是什么？", "请确认期望能力、紧急度和时间节点。"]
    else:
        missing_fields = [
            "能力名称",
            "负责人",
            "行业或业务线",
            "适用业务场景",
            "核心能力",
            "成熟度或状态",
            "可交付形式",
            "可匹配需求类型",
            "限制条件",
        ]
        follow_up_questions = ["该能力的负责人和成熟度是什么？", "适用场景、交付形式和限制条件是什么？"]

    return {
        "fields": fields if target_type == "requirement" else {"description": raw_text.strip()},
        "missing_fields": missing_fields,
        "follow_up_questions": follow_up_questions,
        "warnings": ["AI 服务响应超时，已保留原始描述，请人工补充后再应用。"],
        "fallback_used": True,
    }


def build_requirement_fallback_fields(raw_text: str) -> tuple[dict[str, str], list[str]]:
    """只从原文中的关键词提取需求字段；无法确定的信息保持待补充。"""
    text = raw_text.strip()
    fields: dict[str, str] = {"description": text}
    missing = ["customer", "contact", "timeline_or_stage"]

    if any(keyword in text for keyword in ("数据中心", "机房", "PUE")):
        fields["business_line"] = "数据中心"
    else:
        missing.append("business_line")

    capability_parts: list[str] = []
    if "PUE" in text:
        capability_parts.append("PUE 优化")
    if any(keyword in text for keyword in ("能耗", "能效", "节能")):
        capability_parts.append("能耗分析与节能优化")
    if "配电" in text:
        capability_parts.append("配电系统运行监测")
    if "制冷" in text:
        capability_parts.append("制冷系统运行监测")
    if "监测" in text and "运行监测" not in "、".join(capability_parts):
        capability_parts.append("运行状态持续监测")
    if capability_parts:
        fields["expected_capability"] = "、".join(capability_parts)
    else:
        missing.append("expected_capability")

    pain_parts: list[str] = []
    if any(keyword in text for keyword in ("缺少", "没有", "不足", "缺乏")):
        if "能耗" in text or "能效" in text:
            pain_parts.append("缺少统一能耗分析")
        if "监测" in text:
            pain_parts.append("运行状态监测不足")
    if pain_parts:
        fields["pain_points"] = "、".join(pain_parts)
    else:
        missing.append("pain_points")

    if "评估" in text:
        fields["business_scenario"] = "数据中心节能评估"
    elif capability_parts:
        fields["business_scenario"] = "数据中心能耗优化与运行监测"
    else:
        missing.append("business_scenario")

    if any(keyword in text for keyword in ("近期", "尽快", "马上", "紧急")):
        fields["urgency"] = "high" if "紧急" in text or "马上" in text else "medium"
        fields["timeline_or_stage"] = "近期"
        missing.remove("timeline_or_stage")
    else:
        missing.append("urgency")

    if fields.get("business_line") and capability_parts:
        fields["title"] = "数据中心能效优化与节能评估需求"
    else:
        missing.append("title")

    return fields, missing


def normalize_structure_payload(payload: dict[str, Any]) -> dict[str, Any]:
    raw_fields = payload.get("fields") if isinstance(payload.get("fields"), dict) else {}
    return {
        "fields": {key: normalize_field_value(value) for key, value in raw_fields.items()},
        "missing_fields": payload.get("missing_fields") if isinstance(payload.get("missing_fields"), list) else [],
        "follow_up_questions": payload.get("follow_up_questions") if isinstance(payload.get("follow_up_questions"), list) else [],
        "warnings": payload.get("warnings") if isinstance(payload.get("warnings"), list) else [],
    }


def normalize_field_value(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return "、".join(str(item) for item in value if item is not None)
    if isinstance(value, dict):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


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
            "enable_thinking": False,
            "max_tokens": 800,
        },
        timeout=30.0,
    )
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"]
    return parse_qwen_json_content(content)


def call_qwen_for_image_recognition(
    *,
    image_bytes: bytes,
    mime_type: str,
    prompt: str,
    api_key: str,
    model: str,
    base_url: str,
) -> str:
    image_base64 = base64.b64encode(image_bytes).decode("ascii")
    data_url = f"data:{mime_type};base64,{image_base64}"
    response = httpx.post(
        f"{base_url}/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": "你是施耐德电气内部 AI 工坊平台的信息提取助手。请提取图片中和客户需求、业务场景、产品能力、项目方案有关的文字与含义。",
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                },
            ],
            "temperature": 0.1,
        },
        timeout=45.0,
    )
    response.raise_for_status()
    return str(response.json()["choices"][0]["message"]["content"]).strip()


def call_qwen_for_matching(
    *, requirement_context: str, candidates: list[dict[str, Any]],
    api_key: str, model: str, base_url: str,
) -> dict[str, Any]:
    system = (
        "你是施耐德电气内部需求与能力匹配分析专家。只评估提供的候选能力，禁止编造能力。"
        "综合语义、行业、业务场景和交付可行性评分。score 取 0-100；coverage_status 只能是 covered、partial、uncovered。"
        "必须给出简洁可核验的 reason、gaps，以及 semantic、industry、scenario、delivery 四维评分。只返回 JSON。"
    )
    user = (
        f"需求：\n{requirement_context}\n\n候选能力：\n{json.dumps(candidates, ensure_ascii=False)}\n"
        '返回格式：{"recommendations":[{"project_id":1,"score":80,"coverage_status":"partial",'
        '"reason":"...","gaps":["..."],"dimensions":{"semantic":80,"industry":80,"scenario":80,"delivery":80}}]}。'
        "按 score 降序，最多返回 5 条；低于 40 分的候选不返回。"
    )
    response = httpx.post(
        f"{base_url}/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "response_format": {"type": "json_object"},
            "temperature": 0.1,
            "enable_thinking": False,
        },
        timeout=45.0,
    )
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"].strip()
    if content.startswith("```"):
        content = "\n".join(line for line in content.splitlines() if not line.strip().startswith("```"))
    payload = json.loads(content)
    return payload if isinstance(payload, dict) else {"recommendations": []}


def extract_visible_stream_content(chunk: dict[str, Any]) -> str:
    """只转发模型的可见回答字段，永不转发 reasoning_content。"""
    choices = chunk.get("choices", [])
    if not choices or not isinstance(choices[0], dict):
        return ""
    delta = choices[0].get("delta", {})
    if not isinstance(delta, dict):
        return ""
    content = delta.get("content", "")
    return content if isinstance(content, str) else ""


async def stream_qwen_for_matching(
    *, requirement_context: str, candidates: list[dict[str, Any]],
    api_key: str, model: str, base_url: str,
):
    """以 SSE 接收匹配结果，只产出用户可见 content 分片。"""
    system = (
        "你是施耐德电气内部需求与能力匹配分析专家。只评估提供的候选能力，禁止编造能力。"
        "综合语义、行业、业务场景和交付可行性评分。score 取 0-100；coverage_status 只能是 covered、partial、uncovered。"
        "必须给出简洁可核验的 reason、gaps，以及 semantic、industry、scenario、delivery 四维评分。只返回 JSON。"
    )
    user = (
        f"需求：\n{requirement_context}\n\n候选能力：\n{json.dumps(candidates, ensure_ascii=False)}\n"
        '返回格式：{"recommendations":[{"project_id":1,"score":80,"coverage_status":"partial",'
        '"reason":"...","gaps":["..."],"dimensions":{"semantic":80,"industry":80,"scenario":80,"delivery":80}}]}。'
        "按 score 降序，最多返回 5 条；低于 40 分的候选不返回。"
    )
    timeout = httpx.Timeout(timeout=20.0, connect=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream(
            "POST",
            f"{base_url}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": model,
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
                "response_format": {"type": "json_object"},
                "temperature": 0.1,
                "enable_thinking": False,
                "stream": True,
            },
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.startswith("data:"):
                    continue
                data = line.removeprefix("data:").strip()
                if data == "[DONE]":
                    return
                try:
                    chunk = json.loads(data)
                except json.JSONDecodeError:
                    continue
                content = extract_visible_stream_content(chunk)
                if content:
                    yield content


def call_qwen_for_rag_chat(
    *,
    question: str,
    history: list[dict[str, str]],
    context: str,
    api_key: str,
    model: str,
    base_url: str,
) -> str:
    system = (
        "你是施耐德电气 AI 工坊平台助手。"
        "只能依据提供的知识库资料回答业务问题，并用 [1] [2] 标注引用。"
        "资料不足时应明确说明，不得编造客户、能力或项目状态。"
        "回答使用简洁、专业的中文。"
    )
    messages = [{"role": "system", "content": system}]
    messages.extend(history[-6:])
    messages.append(
        {
            "role": "user",
            "content": f"知识库资料：\n{context}\n\n当前问题：{question}",
        }
    )
    response = httpx.post(
        f"{base_url}/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 1000,
        },
        timeout=45.0,
    )
    response.raise_for_status()
    content = str(response.json()["choices"][0]["message"]["content"])
    return re.sub(r"<think>[\s\S]*?</think>", "", content).strip()
