from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.database import get_session
from app.models import (
    Project,
    ProjectRequirementMatch,
    Requirement,
    ReviewEvent,
    utc_now,
)


router = APIRouter(prefix="/pilot", tags=["pilot"])

ROLE_IDS = {"sales", "research", "admin"}
TASK_ORDER = {
    "review_requirement": 1,
    "final_review": 2,
    "orchestrate_match": 3,
    "assign_reviewer": 4,
    "technical_review": 5,
    "complete_draft": 6,
}
SLA_HOURS = {
    "complete_draft": 48,
    "assign_reviewer": 48,
    "review_requirement": 48,
    "orchestrate_match": 72,
    "technical_review": 72,
    "final_review": 48,
}
ACTION_LABELS = {
    "complete_draft": "补充并提交",
    "assign_reviewer": "指派审核人",
    "review_requirement": "审核需求",
    "orchestrate_match": "分析并关联能力",
    "technical_review": "技术确认",
    "final_review": "最终审核",
}
PLACEHOLDER_DESCRIPTIONS = {"具体可以联系", "具体可联系", "后续联系", "待补充"}
AI_OUTCOME_LABELS = {
    "pending": "待技术确认",
    "technical_pending": "待技术确认",
    "final_pending": "待最终审核",
    "approved": "已采纳",
    "rejected": "未采纳",
}


def normalize_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def build_task(
    *,
    task_type: str,
    target_type: str,
    target_id: int,
    title: str,
    subtitle: str,
    urgency: str,
    owner: str | None,
    started_at: datetime,
    now: datetime,
) -> dict:
    normalized_start = normalize_datetime(started_at)
    normalized_now = normalize_datetime(now)
    sla_hours = SLA_HOURS[task_type]
    due_at = normalized_start + timedelta(hours=sla_hours)
    remaining_hours = round(
        (due_at - normalized_now).total_seconds() / 3600,
        1,
    )
    return {
        "task_type": task_type,
        "target_type": target_type,
        "target_id": target_id,
        "title": title,
        "subtitle": subtitle,
        "urgency": urgency,
        "owner": owner,
        "started_at": normalized_start,
        "due_at": due_at,
        "sla_hours": sla_hours,
        "remaining_hours": remaining_hours,
        "overdue": remaining_hours < 0,
        "due_soon": 0 <= remaining_hours <= 12,
        "action_label": ACTION_LABELS[task_type],
    }


def percentage(numerator: int, denominator: int) -> int:
    if denominator == 0:
        return 0
    return round((numerator / denominator) * 100)


def build_stage_starts(
    events: list[ReviewEvent],
) -> dict[str, dict[int, datetime]]:
    stage_starts: dict[str, dict[int, datetime]] = {
        "requirement_draft": {},
        "requirement_pending": {},
        "requirement_assigned": {},
        "requirement_accepted": {},
        "match_technical": {},
        "match_final": {},
    }

    def record(stage: str, target_id: int, created_at: datetime) -> None:
        current = stage_starts[stage].get(target_id)
        if current is None or normalize_datetime(created_at) > normalize_datetime(current):
            stage_starts[stage][target_id] = created_at

    for event in events:
        if event.target_type == "requirement":
            if event.action == "return":
                record("requirement_draft", event.target_id, event.created_at)
            if event.to_status == "pending_review":
                record("requirement_pending", event.target_id, event.created_at)
            if event.action == "assign_reviewer":
                record("requirement_assigned", event.target_id, event.created_at)
            if event.to_status == "accepted":
                record("requirement_accepted", event.target_id, event.created_at)
        elif event.target_type == "match":
            if event.to_status in {"pending", "technical_pending"}:
                record("match_technical", event.target_id, event.created_at)
            if event.to_status == "final_pending":
                record("match_final", event.target_id, event.created_at)
    return stage_starts


def requirement_quality(requirement: Requirement) -> tuple[int, list[str]]:
    score = 0
    issues: list[str] = []
    if requirement.title.strip():
        score += 15
    else:
        issues.append("缺少需求标题")

    description = requirement.description.strip()
    if description in PLACEHOLDER_DESCRIPTIONS or len(description) < 10:
        issues.append("需求描述不足")
    elif len(description) < 30:
        score += 10
        issues.append("需求描述可进一步补充场景与结果")
    else:
        score += 25

    if requirement.customer.strip():
        score += 15
    else:
        issues.append("缺少客户")
    if (requirement.contact or "").strip():
        score += 10
    else:
        issues.append("缺少联系人")
    if (requirement.submitted_by or "").strip():
        score += 15
    else:
        issues.append("缺少提交人")
    if requirement.tags:
        score += 10
    else:
        issues.append("缺少标签")
    if requirement.urgency in {"low", "medium", "high"}:
        score += 10
    else:
        issues.append("紧急度未规范")
    return score, issues


def project_quality(project: Project) -> tuple[int, list[str]]:
    score = 0
    issues: list[str] = []
    if project.name.strip():
        score += 20
    else:
        issues.append("缺少能力名称")
    description = (project.description or "").strip()
    if len(description) >= 20:
        score += 30
    elif description:
        score += 15
        issues.append("能力描述可进一步补充交付范围")
    else:
        issues.append("缺少能力描述")
    if project.owner.strip():
        score += 20
    else:
        issues.append("缺少负责人")
    if project.status.strip():
        score += 15
    else:
        issues.append("缺少能力状态")
    if project.tags:
        score += 15
    else:
        issues.append("缺少标签")
    return score, issues


def average_duration_hours(
    events: list[ReviewEvent],
    started_at_by_id: dict[int, datetime],
) -> float:
    durations: list[float] = []
    for event in events:
        started_at = started_at_by_id.get(event.target_id)
        if started_at is None:
            continue
        elapsed = normalize_datetime(event.created_at) - normalize_datetime(started_at)
        durations.append(elapsed.total_seconds() / 3600)
    if not durations:
        return 0
    return round(sum(durations) / len(durations), 1)


@router.get("/tasks")
def list_personal_tasks(
    role: str = Query(...),
    actor: str = Query(...),
    session: Session = Depends(get_session),
):
    normalized_role = role.strip()
    normalized_actor = actor.strip()
    if normalized_role not in ROLE_IDS:
        raise HTTPException(status_code=400, detail="未知角色")
    if not normalized_actor:
        raise HTTPException(status_code=400, detail="当前身份不能为空")

    now = utc_now()
    requirements = session.exec(
        select(Requirement).order_by(Requirement.updated_at.asc())
    ).all()
    matches = session.exec(
        select(ProjectRequirementMatch).order_by(
            ProjectRequirementMatch.updated_at.asc()
        )
    ).all()
    review_events = session.exec(select(ReviewEvent)).all()
    stage_starts = build_stage_starts(review_events)
    project_names = {
        project.id: project.name
        for project in session.exec(select(Project)).all()
        if project.id is not None
    }
    requirement_by_id = {
        requirement.id: requirement
        for requirement in requirements
        if requirement.id is not None
    }

    items: list[dict] = []
    if normalized_role == "sales":
        for requirement in requirements:
            if (
                requirement.status == "draft"
                and (requirement.submitted_by or "").strip() == normalized_actor
            ):
                items.append(
                    build_task(
                        task_type="complete_draft",
                        target_type="requirement",
                        target_id=requirement.id,
                        title=requirement.title,
                        subtitle=f"{requirement.customer} · 待补充后重新提交",
                        urgency=requirement.urgency,
                        owner=requirement.submitted_by,
                        started_at=stage_starts["requirement_draft"].get(
                            requirement.id,
                            requirement.reviewed_at or requirement.updated_at,
                        ),
                        now=now,
                    )
                )

    if normalized_role == "research":
        for match in matches:
            if match.review_status not in {"pending", "technical_pending"}:
                continue
            if (match.created_by or "").strip() == normalized_actor:
                continue
            requirement = requirement_by_id.get(match.requirement_id)
            items.append(
                build_task(
                    task_type="technical_review",
                    target_type="match",
                    target_id=match.id,
                    title=requirement.title if requirement else f"关联 #{match.id}",
                    subtitle=f"能力：{project_names.get(match.project_id, '未知能力')}",
                    urgency=requirement.urgency if requirement else "medium",
                    owner=normalized_actor,
                    started_at=stage_starts["match_technical"].get(
                        match.id,
                        match.updated_at,
                    ),
                    now=now,
                )
            )

    if normalized_role == "admin":
        active_requirement_ids = {
            match.requirement_id
            for match in matches
            if match.review_status
            in {"pending", "technical_pending", "final_pending", "approved"}
        }
        for requirement in requirements:
            if requirement.status == "pending_review":
                assigned_reviewer = (requirement.assigned_reviewer or "").strip()
                if not assigned_reviewer:
                    task_type = "assign_reviewer"
                    owner = None
                    started_at = stage_starts["requirement_pending"].get(
                        requirement.id,
                        requirement.created_at,
                    )
                elif assigned_reviewer == normalized_actor:
                    task_type = "review_requirement"
                    owner = assigned_reviewer
                    started_at = stage_starts["requirement_assigned"].get(
                        requirement.id,
                        stage_starts["requirement_pending"].get(
                            requirement.id,
                            requirement.updated_at,
                        ),
                    )
                else:
                    continue
                items.append(
                    build_task(
                        task_type=task_type,
                        target_type="requirement",
                        target_id=requirement.id,
                        title=requirement.title,
                        subtitle=f"{requirement.customer} · {requirement.submitted_by or '历史提交人未记录'}",
                        urgency=requirement.urgency,
                        owner=owner,
                        started_at=started_at,
                        now=now,
                    )
                )
            elif (
                requirement.status == "accepted"
                and requirement.id not in active_requirement_ids
            ):
                items.append(
                    build_task(
                        task_type="orchestrate_match",
                        target_type="requirement",
                        target_id=requirement.id,
                        title=requirement.title,
                        subtitle=f"{requirement.customer} · 尚无有效候选关联",
                        urgency=requirement.urgency,
                        owner=normalized_actor,
                        started_at=stage_starts["requirement_accepted"].get(
                            requirement.id,
                            requirement.reviewed_at or requirement.updated_at,
                        ),
                        now=now,
                    )
                )

        for match in matches:
            if match.review_status != "final_pending":
                continue
            if (match.reviewed_by or "").strip() == normalized_actor:
                continue
            requirement = requirement_by_id.get(match.requirement_id)
            items.append(
                build_task(
                    task_type="final_review",
                    target_type="match",
                    target_id=match.id,
                    title=requirement.title if requirement else f"关联 #{match.id}",
                    subtitle=f"能力：{project_names.get(match.project_id, '未知能力')}",
                    urgency=requirement.urgency if requirement else "medium",
                    owner=normalized_actor,
                    started_at=stage_starts["match_final"].get(
                        match.id,
                        match.reviewed_at or match.updated_at,
                    ),
                    now=now,
                )
            )

    items.sort(
        key=lambda item: (
            TASK_ORDER[item["task_type"]],
            item["due_at"],
        )
    )
    return {
        "role": normalized_role,
        "actor": normalized_actor,
        "total": len(items),
        "overdue": sum(1 for item in items if item["overdue"]),
        "due_soon": sum(1 for item in items if item["due_soon"]),
        "items": items,
    }


@router.get("/metrics")
def get_pilot_metrics(session: Session = Depends(get_session)):
    requirements = session.exec(select(Requirement)).all()
    projects = session.exec(select(Project)).all()
    matches = session.exec(select(ProjectRequirementMatch)).all()
    review_events = session.exec(select(ReviewEvent)).all()

    quality_records: list[dict] = []
    quality_scores: list[int] = []
    for requirement in requirements:
        score, issues = requirement_quality(requirement)
        quality_scores.append(score)
        if score < 80:
            quality_records.append(
                {
                    "target_type": "requirement",
                    "target_id": requirement.id,
                    "title": requirement.title,
                    "owner": requirement.submitted_by,
                    "score": score,
                    "issues": issues,
                }
            )
    for project in projects:
        score, issues = project_quality(project)
        quality_scores.append(score)
        if score < 80:
            quality_records.append(
                {
                    "target_type": "project",
                    "target_id": project.id,
                    "title": project.name,
                    "owner": project.owner,
                    "score": score,
                    "issues": issues,
                }
            )
    quality_records.sort(key=lambda item: (item["score"], item["target_type"]))

    pending_requirements = [
        requirement
        for requirement in requirements
        if requirement.status == "pending_review"
    ]
    assigned_pending_count = sum(
        1
        for requirement in pending_requirements
        if (requirement.assigned_reviewer or "").strip()
    )
    eligible_requirements = [
        requirement
        for requirement in requirements
        if requirement.status in {"accepted", "matching", "matched"}
    ]
    requirement_ids_with_candidates = {match.requirement_id for match in matches}
    covered_eligible_count = sum(
        1
        for requirement in eligible_requirements
        if requirement.id in requirement_ids_with_candidates
    )

    requirement_review_events = [
        event
        for event in review_events
        if event.target_type == "requirement"
        and event.action in {"approve", "return"}
    ]
    final_match_events = [
        event
        for event in review_events
        if event.target_type == "match"
        and event.action in {"final_approve", "final_reject"}
    ]
    requirement_started_at = {
        requirement.id: requirement.created_at
        for requirement in requirements
        if requirement.id is not None
    }
    match_started_at = {
        match.id: match.created_at for match in matches if match.id is not None
    }

    ai_matches = [match for match in matches if match.source == "ai"]
    reviewed_ai_matches = [
        match
        for match in ai_matches
        if match.review_status in {"approved", "rejected"}
    ]
    approved_ai_count = sum(
        1 for match in reviewed_ai_matches if match.review_status == "approved"
    )
    rejected_ai_count = sum(
        1 for match in reviewed_ai_matches if match.review_status == "rejected"
    )
    ai_scores = [
        match.ai_score for match in ai_matches if match.ai_score is not None
    ]
    requirement_titles = {
        requirement.id: requirement.title
        for requirement in requirements
        if requirement.id is not None
    }
    project_names = {
        project.id: project.name for project in projects if project.id is not None
    }
    ai_samples = [
        {
            "match_id": match.id,
            "requirement_title": requirement_titles.get(
                match.requirement_id,
                f"需求 #{match.requirement_id}",
            ),
            "project_name": project_names.get(
                match.project_id,
                f"能力 #{match.project_id}",
            ),
            "score": match.ai_score,
            "coverage_status": match.coverage_status,
            "outcome": AI_OUTCOME_LABELS.get(
                match.review_status,
                match.review_status,
            ),
            "reason": match.ai_reason,
            "gaps": match.ai_gaps,
            "created_at": normalize_datetime(match.created_at),
        }
        for match in sorted(
            ai_matches,
            key=lambda item: normalize_datetime(item.created_at),
            reverse=True,
        )[:20]
    ]
    gap_counts = Counter(
        gap.strip()
        for match in ai_matches
        for gap in match.ai_gaps
        if gap.strip()
    )

    return {
        "generated_at": utc_now(),
        "data_quality": {
            "average_score": (
                round(sum(quality_scores) / len(quality_scores), 1)
                if quality_scores
                else 0
            ),
            "low_quality_count": len(quality_records),
            "records": quality_records,
        },
        "workflow": {
            "reviewer_assignment_rate": percentage(
                assigned_pending_count,
                len(pending_requirements),
            ),
            "candidate_coverage_rate": percentage(
                covered_eligible_count,
                len(eligible_requirements),
            ),
            "average_requirement_review_hours": average_duration_hours(
                requirement_review_events,
                requirement_started_at,
            ),
            "average_match_cycle_hours": average_duration_hours(
                final_match_events,
                match_started_at,
            ),
            "pending_requirement_count": len(pending_requirements),
            "eligible_requirement_count": len(eligible_requirements),
        },
        "ai_evaluation": {
            "total_candidates": len(ai_matches),
            "reviewed_candidates": len(reviewed_ai_matches),
            "approved_candidates": approved_ai_count,
            "rejected_candidates": rejected_ai_count,
            "adoption_rate": percentage(
                approved_ai_count,
                len(reviewed_ai_matches),
            ),
            "average_score": (
                round(sum(ai_scores) / len(ai_scores), 1) if ai_scores else 0
            ),
            "samples": ai_samples,
        },
        "gap_distribution": [
            {"gap": gap, "count": count}
            for gap, count in sorted(
                gap_counts.items(),
                key=lambda item: (-item[1], item[0]),
            )
        ],
    }
