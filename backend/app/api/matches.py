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
    if match.review_status != "pending":
        raise HTTPException(status_code=409, detail="仅待确认匹配可以执行审核")

    target_status = {"approve": "approved", "reject": "rejected"}.get(payload.action)
    if target_status is None:
        raise HTTPException(status_code=400, detail="Invalid review action")

    previous_status = match.review_status
    reviewed_at = utc_now()
    match.review_status = target_status
    match.reviewed_by = payload.reviewer
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
                actor=payload.reviewer,
                note=payload.note,
                from_status=previous_requirement_status,
                to_status="matched",
            )
    elif requirement is not None and requirement.status == "matching":
        remaining_active_match = session.exec(
            select(ProjectRequirementMatch).where(
                ProjectRequirementMatch.requirement_id == requirement.id,
                ProjectRequirementMatch.id != match_id,
                ProjectRequirementMatch.review_status.in_(["pending", "approved"]),
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
                actor=payload.reviewer,
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
            actor=payload.reviewer,
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
