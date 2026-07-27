from __future__ import annotations

import math
import re
from typing import Any


def _tokens(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+|[\u4e00-\u9fff]{2,}", text.lower()))


def _value(item: Any, key: str, default: Any = None) -> Any:
    return item.get(key, default) if isinstance(item, dict) else getattr(item, key, default)


def _tag_names(item: Any) -> set[str]:
    return {_value(tag, "name", "") for tag in _value(item, "tags", [])}


def rank_project_candidates(requirement: Any, projects: list[Any], limit: int = 20) -> list[dict[str, Any]]:
    """用标签和文本重合度进行低成本预筛选，最终评分交给 LLM。"""
    requirement_text = f"{_value(requirement, 'title', '')} {_value(requirement, 'description', '')}"
    requirement_tokens = _tokens(requirement_text)
    requirement_tags = _tag_names(requirement)
    ranked: list[tuple[float, dict[str, Any]]] = []
    for project in projects:
        project_text = f"{_value(project, 'name', '')} {_value(project, 'description', '')}"
        project_tokens = _tokens(project_text)
        overlap = len(requirement_tokens & project_tokens)
        semantic_hint = overlap / math.sqrt(max(1, len(requirement_tokens) * len(project_tokens)))
        shared_tags = requirement_tags & _tag_names(project)
        pre_score = semantic_hint + len(shared_tags) * 0.5
        ranked.append(
            (
                pre_score,
                {
                    "project_id": _value(project, "id"),
                    "name": _value(project, "name", ""),
                    "description": _value(project, "description", ""),
                    "owner": _value(project, "owner", ""),
                    "status": _value(project, "status", ""),
                    "tags": sorted(_tag_names(project)),
                    "shared_tags": sorted(shared_tags),
                },
            )
        )
    ranked.sort(key=lambda item: (-item[0], item[1]["project_id"]))
    return [candidate for _, candidate in ranked[: max(1, min(limit, 20))]]


def requirement_context(requirement: Any) -> str:
    tags = "、".join(sorted(_tag_names(requirement))) or "无"
    return (
        f"需求标题：{_value(requirement, 'title', '')}\n"
        f"需求描述：{_value(requirement, 'description', '')}\n"
        f"客户：{_value(requirement, 'customer', '')}\n"
        f"紧急度：{_value(requirement, 'urgency', '')}\n标签：{tags}"
    )
