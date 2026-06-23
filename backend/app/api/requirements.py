from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.api.utils import load_tags
from app.database import get_session
from app.models import Requirement, utc_now
from app.schemas import RequirementCreate, RequirementRead, RequirementUpdate

router = APIRouter(prefix="/requirements", tags=["requirements"])


@router.get("", response_model=list[RequirementRead])
def list_requirements(session: Session = Depends(get_session)):
    return session.exec(select(Requirement).order_by(Requirement.created_at.desc())).all()


@router.post("", response_model=RequirementRead, status_code=status.HTTP_201_CREATED)
def create_requirement(payload: RequirementCreate, session: Session = Depends(get_session)):
    tags = load_tags(session, payload.tag_ids)
    requirement = Requirement(
        title=payload.title,
        description=payload.description,
        customer=payload.customer,
        contact=payload.contact,
        urgency=payload.urgency,
        status=payload.status,
        tags=tags,
    )
    session.add(requirement)
    session.commit()
    session.refresh(requirement)
    return requirement


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
    tag_ids = updates.pop("tag_ids", None)
    for key, value in updates.items():
        setattr(requirement, key, value)
    if tag_ids is not None:
        requirement.tags = load_tags(session, tag_ids)
    requirement.updated_at = utc_now()
    session.add(requirement)
    session.commit()
    session.refresh(requirement)
    return requirement
