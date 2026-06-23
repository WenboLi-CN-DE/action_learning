# Phase 2 MVP Design

## Scope

Phase 2 delivers the first usable AI 工坊平台 workflow: create pre-research projects, create customer requirements, maintain tags, and manually link requirements to projects with a coverage status.

This MVP intentionally excludes permissions, automatic matching, comments, charts, and deployment automation. Those stay in Phase 3 and Phase 4.

## Backend

The backend keeps the current FastAPI + SQLModel + SQLite stack.

Core tables:

- `Project`: name, description, owner, status, tag links, timestamps.
- `Requirement`: title, description, customer, contact, urgency, status, tag links, timestamps.
- `Tag`: name, category.
- `ProjectRequirementMatch`: project id, requirement id, coverage status, note, timestamps.

The API is mounted under `/api/v1` and split into focused routers:

- `/projects`
- `/requirements`
- `/tags`
- `/matches`

Each create/update endpoint validates foreign keys and returns `404` for missing linked records. Duplicate match creation for the same project and requirement returns the existing row instead of creating a second link.

## Frontend

The current demo page is replaced by an operational workbench with Ant Design controls:

- Dashboard shell with tabs for projects, requirements, tags, and matches.
- Project and requirement forms use drawers or compact forms beside lists.
- Tags can be created and reused in project/requirement forms.
- Matches are created manually by selecting one requirement, one project, and a coverage status.

The UI optimizes for small internal datasets, not high-volume administration.

## Testing

Backend behavior is covered with FastAPI `TestClient` tests for CRUD and match validation. Frontend verification uses TypeScript production build. Existing health/demo tests remain as baseline compatibility checks.
