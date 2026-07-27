from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlmodel import Session, select

from app.database import get_session
from app.models import Project, ProjectRequirementMatch, Requirement, ReviewEvent, utc_now
from app.schemas import MatchCreate, MatchRead, MatchUpdate, ReviewRequest

router = APIRouter(prefix="/matches", tags=["matches"])


@router.get("", response_model=list[MatchRead])
def list_matches(session: Session = Depends(get_session)):
    return session.exec(select(ProjectRequirementMatch).order_by(ProjectRequirementMatch.created_at.desc())).all()


@router.post("", response_model=MatchRead, status_code=status.HTTP_201_CREATED)
def create_match(
    payload: MatchCreate,
    response: Response,
    session: Session = Depends(get_session),
):
    project = session.get(Project, payload.project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    requirement = session.get(Requirement, payload.requirement_id)
    if requirement is None:
        raise HTTPException(status_code=404, detail="Requirement not found")

    existing = session.exec(
        select(ProjectRequirementMatch).where(
            ProjectRequirementMatch.project_id == payload.project_id,
            ProjectRequirementMatch.requirement_id == payload.requirement_id,
        )
    ).first()
    if existing is not None:
        response.status_code = status.HTTP_200_OK
        if existing.review_status == "rejected":
            existing.coverage_status = payload.coverage_status
            existing.note = payload.note
            existing.source = payload.source
            existing.ai_score = payload.ai_score
            existing.ai_reason = payload.ai_reason
            existing.ai_gaps = payload.ai_gaps
            existing.ai_model = payload.ai_model
            existing.created_by = payload.created_by
            existing.review_status = "technical_pending"
            existing.reviewed_by = None
            existing.reviewed_at = None
            existing.review_note = None
            existing.updated_at = utc_now()
            if requirement.status == "accepted":
                requirement.status = "matching"
                requirement.updated_at = utc_now()
                session.add(requirement)
            session.add(existing)
            session.commit()
            session.refresh(existing)
        return existing

    match = ProjectRequirementMatch(
        project_id=payload.project_id,
        requirement_id=payload.requirement_id,
        coverage_status=payload.coverage_status,
        note=payload.note,
        source=payload.source,
        ai_score=payload.ai_score,
        ai_reason=payload.ai_reason,
        ai_gaps=payload.ai_gaps,
        ai_model=payload.ai_model,
        created_by=payload.created_by,
    )
    if requirement.status == "accepted":
        requirement.status = "matching"
        requirement.updated_at = utc_now()
        session.add(requirement)
    session.add(match)
    session.commit()
    session.refresh(match)
    return match


@router.post("/{match_id}/review", response_model=MatchRead)
def review_match(
    match_id: int,
    payload: ReviewRequest,
    session: Session = Depends(get_session),
):
    match = session.get(ProjectRequirementMatch, match_id)
    if match is None:
        raise HTTPException(status_code=404, detail="Match not found")

    current_status = (
        "technical_pending" if match.review_status == "pending" else match.review_status
    )
    transitions = {
        "technical_approve": ({"technical_pending"}, "final_pending"),
        "technical_reject": ({"technical_pending"}, "rejected"),
        "final_approve": ({"final_pending"}, "approved"),
        "final_reject": ({"final_pending"}, "rejected"),
    }
    transition = transitions.get(payload.action)
    if transition is None:
        raise HTTPException(status_code=400, detail="Invalid review action")
    allowed_statuses, target_status = transition
    if current_status not in allowed_statuses:
        raise HTTPException(status_code=409, detail="当前关联状态不允许执行该审核操作")

    reviewer = payload.reviewer.strip()
    if not reviewer:
        raise HTTPException(status_code=400, detail="审核人不能为空")
    if match.created_by and reviewer == match.created_by.strip():
        raise HTTPException(status_code=409, detail="关联发起人不能审核自己创建的关联")
    if current_status == "final_pending" and match.reviewed_by == reviewer:
        raise HTTPException(status_code=409, detail="技术确认人与最终审批人不能是同一人")
    if payload.action.endswith("reject") and not (payload.note or "").strip():
        raise HTTPException(status_code=400, detail="拒绝关联时必须填写审核意见")

    previous_status = match.review_status
    reviewed_at = utc_now()
    match.review_status = target_status
    match.reviewed_by = reviewer
    match.reviewed_at = reviewed_at
    match.review_note = payload.note
    match.updated_at = reviewed_at
    requirement = session.get(Requirement, match.requirement_id)
    requirement_event: ReviewEvent | None = None
    if target_status == "approved":
        if requirement is not None:
            previous_requirement_status = requirement.status
            requirement.status = "matched"
            requirement.updated_at = reviewed_at
            session.add(requirement)
            requirement_event = ReviewEvent(
                target_type="requirement",
                target_id=requirement.id,
                action="match_approved",
                actor=reviewer,
                note=payload.note,
                from_status=previous_requirement_status,
                to_status="matched",
            )
    elif (
        target_status == "rejected"
        and requirement is not None
        and requirement.status == "matching"
    ):
        remaining_active_match = session.exec(
            select(ProjectRequirementMatch).where(
                ProjectRequirementMatch.requirement_id == requirement.id,
                ProjectRequirementMatch.id != match_id,
                ProjectRequirementMatch.review_status.in_(
                    ["pending", "technical_pending", "final_pending", "approved"]
                ),
            )
        ).first()
        if remaining_active_match is None:
            requirement.status = "accepted"
            requirement.updated_at = reviewed_at
            session.add(requirement)
            requirement_event = ReviewEvent(
                target_type="requirement",
                target_id=requirement.id,
                action="match_rejected",
                actor=reviewer,
                note=payload.note,
                from_status="matching",
                to_status="accepted",
            )
    session.add(match)
    session.add(
        ReviewEvent(
            target_type="match",
            target_id=match_id,
            action=payload.action,
            actor=reviewer,
            note=payload.note,
            from_status=previous_status,
            to_status=target_status,
        )
    )
    if requirement_event is not None:
        session.add(requirement_event)
    session.commit()
    session.refresh(match)
    return match


@router.get("/{match_id}", response_model=MatchRead)
def get_match(match_id: int, session: Session = Depends(get_session)):
    match = session.get(ProjectRequirementMatch, match_id)
    if match is None:
        raise HTTPException(status_code=404, detail="Match not found")
    return match


@router.patch("/{match_id}", response_model=MatchRead)
def update_match(match_id: int, payload: MatchUpdate, session: Session = Depends(get_session)):
    match = session.get(ProjectRequirementMatch, match_id)
    if match is None:
        raise HTTPException(status_code=404, detail="Match not found")

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(match, key, value)
    match.updated_at = utc_now()
    session.add(match)
    session.commit()
    session.refresh(match)
    return match
