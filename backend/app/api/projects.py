from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.api.utils import load_tags
from app.database import get_session
from app.models import Project, utc_now
from app.schemas import ProjectCreate, ProjectRead, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectRead])
def list_projects(session: Session = Depends(get_session)):
    return session.exec(select(Project).order_by(Project.created_at.desc())).all()


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate, session: Session = Depends(get_session)):
    tags = load_tags(session, payload.tag_ids)
    project = Project(
        name=payload.name,
        description=payload.description,
        owner=payload.owner,
        status=payload.status,
        tags=tags,
    )
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(project_id: int, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.patch("/{project_id}", response_model=ProjectRead)
def update_project(project_id: int, payload: ProjectUpdate, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    updates = payload.model_dump(exclude_unset=True)
    tag_ids = updates.pop("tag_ids", None)
    for key, value in updates.items():
        setattr(project, key, value)
    if tag_ids is not None:
        project.tags = load_tags(session, tag_ids)
    project.updated_at = utc_now()
    session.add(project)
    session.commit()
    session.refresh(project)
    return project
