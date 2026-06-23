from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlmodel import Session, select

from app.database import get_session
from app.models import Project, ProjectRequirementMatch, Requirement, utc_now
from app.schemas import MatchCreate, MatchRead, MatchUpdate

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
    )
    session.add(match)
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
