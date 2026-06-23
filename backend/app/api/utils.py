from fastapi import HTTPException
from sqlmodel import Session, select

from app.models import Tag


def load_tags(session: Session, tag_ids: list[int]) -> list[Tag]:
    if not tag_ids:
        return []

    tags = session.exec(select(Tag).where(Tag.id.in_(tag_ids))).all()
    found_ids = {tag.id for tag in tags}
    missing_ids = [tag_id for tag_id in tag_ids if tag_id not in found_ids]
    if missing_ids:
        raise HTTPException(status_code=404, detail=f"Tag not found: {missing_ids[0]}")
    return list(tags)
