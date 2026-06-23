from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from app.database import get_session
from app.models import Comment, Project, Requirement
from app.schemas import CommentCreate, CommentRead

router = APIRouter(prefix="/comments", tags=["comments"])


def validate_comment_target(session: Session, target_type: str, target_id: int) -> None:
    if target_type == "project":
        if session.get(Project, target_id) is None:
            raise HTTPException(status_code=404, detail="Project not found")
        return

    if target_type == "requirement":
        if session.get(Requirement, target_id) is None:
            raise HTTPException(status_code=404, detail="Requirement not found")
        return

    raise HTTPException(status_code=400, detail="Invalid comment target type")


@router.get("", response_model=list[CommentRead])
def list_comments(
    target_type: str = Query(...),
    target_id: int = Query(...),
    session: Session = Depends(get_session),
):
    validate_comment_target(session, target_type, target_id)
    return session.exec(
        select(Comment)
        .where(Comment.target_type == target_type, Comment.target_id == target_id)
        .order_by(Comment.created_at.asc())
    ).all()


@router.post("", response_model=CommentRead, status_code=status.HTTP_201_CREATED)
def create_comment(payload: CommentCreate, session: Session = Depends(get_session)):
    validate_comment_target(session, payload.target_type, payload.target_id)
    comment = Comment.model_validate(payload)
    session.add(comment)
    session.commit()
    session.refresh(comment)
    return comment
