from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from app.database import get_session
from app.models import ReviewEvent
from app.schemas import ReviewEventRead


router = APIRouter(prefix="/review-events", tags=["reviews"])


@router.get("", response_model=list[ReviewEventRead])
def list_review_events(
    target_type: str = Query(...),
    target_id: int = Query(...),
    session: Session = Depends(get_session),
):
    return session.exec(
        select(ReviewEvent)
        .where(
            ReviewEvent.target_type == target_type,
            ReviewEvent.target_id == target_id,
        )
        .order_by(ReviewEvent.created_at.asc())
    ).all()
