import asyncio
import json
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select

from app import llm_service
from app.ai_matching import rank_project_candidates, requirement_context
from app.api.utils import load_tags
from app.database import get_session
from app.models import Project, ProjectRequirementMatch, Requirement, ReviewEvent, utc_now
from app.rag.sync import sync_requirement_to_rag
from app.schemas import (
    AIMatchRecommendation,
    AIMatchRequest,
    AIMatchResult,
    ProjectRead,
    RequirementCreate,
    RequirementRead,
    RequirementTransitionRequest,
    RequirementUpdate,
    ReviewRequest,
    ReviewerAssignmentRequest,
)

router = APIRouter(prefix="/requirements", tags=["requirements"])
PLACEHOLDER_DESCRIPTIONS = {"具体可以联系", "具体可联系", "后续联系", "待补充"}
MAX_LLM_MATCH_CANDIDATES = 10
AI_MATCH_TOTAL_TIMEOUT_SECONDS = 45.0
logger = logging.getLogger(__name__)


def validate_requirement_identity_and_description(
    submitted_by: str | None,
    description: str,
) -> tuple[str, str]:
    submitter = (submitted_by or "").strip()
    if not submitter:
        raise HTTPException(status_code=400, detail="需求提交人不能为空")

    normalized_description = description.strip()
    if len(normalized_description) < 10 or normalized_description in PLACEHOLDER_DESCRIPTIONS:
        raise HTTPException(status_code=400, detail="需求描述信息不足，请说明业务场景、目标或期望结果")
    return submitter, normalized_description


@router.get("", response_model=list[RequirementRead])
def list_requirements(session: Session = Depends(get_session)):
    return session.exec(select(Requirement).order_by(Requirement.created_at.desc())).all()


@router.post("", response_model=RequirementRead, status_code=status.HTTP_201_CREATED)
def create_requirement(payload: RequirementCreate, session: Session = Depends(get_session)):
    if payload.status not in {"draft", "pending_review", "new"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="新需求只能创建为草稿、待审核或兼容旧版的新需求状态",
        )
    submitter, description = validate_requirement_identity_and_description(
        payload.submitted_by,
        payload.description,
    )
    tags = load_tags(session, payload.tag_ids)
    requirement = Requirement(
        title=payload.title,
        description=description,
        customer=payload.customer,
        contact=payload.contact,
        urgency=payload.urgency,
        status=payload.status,
        submitted_by=submitter,
        tags=tags,
    )
    session.add(requirement)
    session.commit()
    session.refresh(requirement)
    # 异步同步到 RAG 索引
    sync_requirement_to_rag(
        requirement_id=requirement.id,
        title=requirement.title,
        description=requirement.description,
        customer=requirement.customer,
        contact=requirement.contact,
        urgency=requirement.urgency,
        status=requirement.status,
        tags=[t.name for t in requirement.tags],
    )
    return requirement


@router.post("/{requirement_id}/transition", response_model=RequirementRead)
def transition_requirement(
    requirement_id: int,
    payload: RequirementTransitionRequest,
    session: Session = Depends(get_session),
):
    requirement = session.get(Requirement, requirement_id)
    if requirement is None:
        raise HTTPException(status_code=404, detail="Requirement not found")

    allowed_targets = {
        "draft": {"pending_review"},
        "new": {"pending_review"},
        "reviewing": {"pending_review"},
        "accepted": {"matching", "shelved"},
        "matching": {"matched", "shelved"},
        "shelved": {"accepted"},
        "closed": {"shelved"},
    }
    if payload.target_status not in allowed_targets.get(requirement.status, set()):
        raise HTTPException(status_code=409, detail="不允许的需求状态转换")

    previous_status = requirement.status
    requirement.status = payload.target_status
    requirement.updated_at = utc_now()
    session.add(requirement)
    session.add(
        ReviewEvent(
            target_type="requirement",
            target_id=requirement_id,
            action="transition",
            actor=payload.actor,
            note=payload.note,
            from_status=previous_status,
            to_status=payload.target_status,
        )
    )
    session.commit()
    session.refresh(requirement)
    return requirement


@router.post("/{requirement_id}/review", response_model=RequirementRead)
def review_requirement(
    requirement_id: int,
    payload: ReviewRequest,
    session: Session = Depends(get_session),
):
    requirement = session.get(Requirement, requirement_id)
    if requirement is None:
        raise HTTPException(status_code=404, detail="Requirement not found")
    if requirement.status != "pending_review":
        raise HTTPException(status_code=409, detail="仅待审核需求可以执行审核")

    target_status = {"approve": "accepted", "return": "draft"}.get(payload.action)
    if target_status is None:
        raise HTTPException(status_code=400, detail="Invalid review action")
    reviewer = payload.reviewer.strip()
    if not reviewer:
        raise HTTPException(status_code=400, detail="审核人不能为空")
    if requirement.assigned_reviewer and reviewer != requirement.assigned_reviewer.strip():
        raise HTTPException(
            status_code=409,
            detail=f"该需求已指派给 {requirement.assigned_reviewer} 审核",
        )
    if requirement.submitted_by and reviewer == requirement.submitted_by.strip():
        raise HTTPException(status_code=409, detail="需求提交人不能审核自己的需求")
    if payload.action == "return" and not (payload.note or "").strip():
        raise HTTPException(status_code=400, detail="退回需求时必须填写审核意见")

    previous_status = requirement.status
    reviewed_at = utc_now()
    requirement.status = target_status
    requirement.reviewed_by = reviewer
    requirement.reviewed_at = reviewed_at
    requirement.review_note = payload.note
    requirement.updated_at = reviewed_at
    session.add(requirement)
    session.add(
        ReviewEvent(
            target_type="requirement",
            target_id=requirement_id,
            action=payload.action,
            actor=reviewer,
            note=payload.note,
            from_status=previous_status,
            to_status=target_status,
        )
    )
    session.commit()
    session.refresh(requirement)
    return requirement


@router.post("/{requirement_id}/assign-reviewer", response_model=RequirementRead)
def assign_requirement_reviewer(
    requirement_id: int,
    payload: ReviewerAssignmentRequest,
    session: Session = Depends(get_session),
):
    requirement = session.get(Requirement, requirement_id)
    if requirement is None:
        raise HTTPException(status_code=404, detail="Requirement not found")
    if requirement.status not in {"new", "reviewing", "pending_review"}:
        raise HTTPException(status_code=409, detail="当前需求状态不允许重新指派审核人")

    reviewer = payload.reviewer.strip()
    actor = payload.actor.strip()
    if not reviewer or not actor:
        raise HTTPException(status_code=400, detail="审核负责人和指派人不能为空")
    if requirement.submitted_by and reviewer == requirement.submitted_by.strip():
        raise HTTPException(status_code=409, detail="需求提交人不能被指派为审核人")

    previous_status = requirement.status
    requirement.assigned_reviewer = reviewer
    if requirement.status in {"new", "reviewing"}:
        requirement.status = "pending_review"
    requirement.updated_at = utc_now()
    session.add(requirement)
    session.add(
        ReviewEvent(
            target_type="requirement",
            target_id=requirement_id,
            action="assign_reviewer",
            actor=actor,
            note=f"指派审核负责人：{reviewer}",
            from_status=previous_status,
            to_status=requirement.status,
        )
    )
    session.commit()
    session.refresh(requirement)
    return requirement


def build_ai_match_result(
    *,
    requirement_id: int,
    model: str,
    analysis: dict,
    projects: list[Project],
    existing_ids: set[int],
    top_k: int,
    fallback_used: bool = False,
    warnings: list[str] | None = None,
) -> AIMatchResult:
    project_map = {project.id: project for project in projects}
    recommendations: list[AIMatchRecommendation] = []
    for item in analysis.get("recommendations", [])[: max(1, min(top_k, 10))]:
        project_id = int(item.get("project_id", 0))
        project = project_map.get(project_id)
        if project is None:
            continue
        score = max(0.0, min(float(item.get("score", 0)), 100.0))
        coverage_status = item.get("coverage_status", "partial")
        if coverage_status not in {"covered", "partial", "uncovered"}:
            coverage_status = "partial"
        dimensions = {
            str(key): max(0.0, min(float(value), 100.0))
            for key, value in item.get("dimensions", {}).items()
            if isinstance(value, (int, float))
        }
        recommendations.append(
            AIMatchRecommendation(
                project_id=project_id,
                project=ProjectRead.model_validate(project),
                score=score,
                coverage_status=coverage_status,
                reason=str(item.get("reason", "")),
                gaps=[str(gap) for gap in item.get("gaps", [])],
                dimensions=dimensions,
                already_confirmed=project_id in existing_ids,
            )
        )
    recommendations.sort(key=lambda item: item.score, reverse=True)
    return AIMatchResult(
        requirement_id=requirement_id,
        model=model,
        recommendations=recommendations,
        fallback_used=fallback_used,
        warnings=warnings or [],
    )


def stream_event(event: str, payload: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


@router.post("/{requirement_id}/ai-matches", response_model=AIMatchResult)
async def analyze_requirement_matches(
    requirement_id: int,
    payload: AIMatchRequest,
    session: Session = Depends(get_session),
):
    requirement = session.get(Requirement, requirement_id)
    if requirement is None:
        raise HTTPException(status_code=404, detail="Requirement not found")

    projects = list(session.exec(select(Project)).all())
    if not projects:
        model = payload.model or llm_service.get_default_model()
        return AIMatchResult(requirement_id=requirement_id, model=model)

    api_key, model, base_url = llm_service.resolve_qwen_config(
        payload.api_key, payload.model, payload.base_url
    )

    candidates = rank_project_candidates(requirement, projects)[:MAX_LLM_MATCH_CANDIDATES]
    try:
        analysis = await asyncio.wait_for(
            asyncio.to_thread(
                llm_service.call_qwen_for_matching,
                requirement_context=requirement_context(requirement),
                candidates=candidates,
                api_key=api_key,
                model=model,
                base_url=base_url,
            ),
            timeout=AI_MATCH_TOTAL_TIMEOUT_SECONDS,
        )
    except (TimeoutError, httpx.TimeoutException) as exc:
        raise HTTPException(
            status_code=504,
            detail="AI 匹配超时：模型分析时间过长，请重试",
        ) from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"AI 匹配失败：上游服务返回 {exc.response.status_code}") from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail="AI 匹配失败：无法连接模型服务") from exc
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="AI 匹配失败：模型返回格式无效") from exc

    existing_ids = set(
        session.exec(
            select(ProjectRequirementMatch.project_id).where(
                ProjectRequirementMatch.requirement_id == requirement_id,
                ProjectRequirementMatch.review_status != "rejected",
            )
        ).all()
    )
    return build_ai_match_result(
        requirement_id=requirement_id,
        model=model,
        analysis=analysis,
        projects=projects,
        existing_ids=existing_ids,
        top_k=payload.top_k,
    )


@router.post("/{requirement_id}/ai-matches/stream")
async def stream_requirement_matches(
    requirement_id: int,
    payload: AIMatchRequest,
    session: Session = Depends(get_session),
):
    requirement = session.get(Requirement, requirement_id)
    if requirement is None:
        raise HTTPException(status_code=404, detail="Requirement not found")

    projects = list(session.exec(select(Project)).all())
    model = payload.model or llm_service.get_default_model()
    if not projects:
        result = AIMatchResult(requirement_id=requirement_id, model=model)

        async def empty_stream():
            yield stream_event("result", result.model_dump(mode="json"))

        return StreamingResponse(empty_stream(), media_type="text/event-stream")

    api_key, model, base_url = llm_service.resolve_qwen_config(
        payload.api_key, payload.model, payload.base_url
    )
    candidates = rank_project_candidates(requirement, projects)[:MAX_LLM_MATCH_CANDIDATES]
    existing_ids = set(
        session.exec(
            select(ProjectRequirementMatch.project_id).where(
                ProjectRequirementMatch.requirement_id == requirement_id,
                ProjectRequirementMatch.review_status != "rejected",
            )
        ).all()
    )

    def fallback_result(message: str) -> AIMatchResult:
        return AIMatchResult(
            requirement_id=requirement_id,
            model=model,
            fallback_used=True,
            warnings=[message],
        )

    async def event_stream():
        yield stream_event("progress", {"message": f"已完成本地候选筛选，正在分析 {len(candidates)} 项能力"})
        chunks: list[str] = []
        try:
            async with asyncio.timeout(AI_MATCH_TOTAL_TIMEOUT_SECONDS):
                async for content in llm_service.stream_qwen_for_matching(
                    requirement_context=requirement_context(requirement),
                    candidates=candidates,
                    api_key=api_key,
                    model=model,
                    base_url=base_url,
                ):
                    chunks.append(content)
                    yield stream_event("content", {"text": content})
        except TimeoutError:
            logger.warning("AI match stream total timeout: requirement_id=%s model=%s", requirement_id, model)
            yield stream_event("result", fallback_result("AI 匹配在 45 秒内未完成，未生成推荐；请稍后重试。").model_dump(mode="json"))
            return
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning(
                "AI match stream upstream failure: requirement_id=%s model=%s error=%s",
                requirement_id,
                model,
                exc.__class__.__name__,
            )
            yield stream_event("result", fallback_result("AI 匹配服务暂不可用，未生成推荐；请稍后重试。").model_dump(mode="json"))
            return

        try:
            analysis = json.loads("".join(chunks))
            if not isinstance(analysis, dict):
                raise ValueError("invalid matching payload")
            result = build_ai_match_result(
                requirement_id=requirement_id,
                model=model,
                analysis=analysis,
                projects=projects,
                existing_ids=existing_ids,
                top_k=payload.top_k,
            )
        except (KeyError, TypeError, ValueError, json.JSONDecodeError):
            result = fallback_result("AI 返回内容不完整，未生成推荐；请稍后重试。")
        yield stream_event("result", result.model_dump(mode="json"))

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/{requirement_id}", response_model=RequirementRead)
def get_requirement(requirement_id: int, session: Session = Depends(get_session)):
    requirement = session.get(Requirement, requirement_id)
    if requirement is None:
        raise HTTPException(status_code=404, detail="Requirement not found")
    return requirement


@router.patch("/{requirement_id}", response_model=RequirementRead)
def update_requirement(
    requirement_id: int,
    payload: RequirementUpdate,
    session: Session = Depends(get_session),
):
    requirement = session.get(Requirement, requirement_id)
    if requirement is None:
        raise HTTPException(status_code=404, detail="Requirement not found")

    updates = payload.model_dump(exclude_unset=True)
    if "description" in updates:
        normalized_description = str(updates["description"] or "").strip()
        if len(normalized_description) < 10 or normalized_description in PLACEHOLDER_DESCRIPTIONS:
            raise HTTPException(status_code=400, detail="需求描述信息不足，请说明业务场景、目标或期望结果")
        updates["description"] = normalized_description
    requested_status = updates.get("status")
    if requested_status is not None and requested_status != requirement.status:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="需求状态必须通过审核或状态转换接口更新",
        )
    tag_ids = updates.pop("tag_ids", None)
    for key, value in updates.items():
        setattr(requirement, key, value)
    if tag_ids is not None:
        requirement.tags = load_tags(session, tag_ids)
    requirement.updated_at = utc_now()
    session.add(requirement)
    session.commit()
    session.refresh(requirement)
    # 异步同步到 RAG 索引
    sync_requirement_to_rag(
        requirement_id=requirement.id,
        title=requirement.title,
        description=requirement.description,
        customer=requirement.customer,
        contact=requirement.contact,
        urgency=requirement.urgency,
        status=requirement.status,
        tags=[t.name for t in requirement.tags],
    )
    return requirement
