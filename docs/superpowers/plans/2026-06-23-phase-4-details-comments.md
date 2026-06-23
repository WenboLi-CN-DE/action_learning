# Phase 4 Details And Comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the v1 loop by adding project/requirement details, associated match lists, and lightweight comments.

**Architecture:** Add a generic backend `Comment` table with `target_type` (`project` or `requirement`) and `target_id`, exposed through `/api/v1/comments`. Keep detail rendering in the existing workbench page using Ant Design drawers because the app is still a compact single-screen MVP.

**Tech Stack:** FastAPI, SQLModel, SQLite, pytest, React, TypeScript, Vite, Ant Design.

---

### Task 1: Backend Comment API

**Files:**
- Modify: `backend/app/models.py`
- Modify: `backend/app/schemas.py`
- Create: `backend/app/api/comments.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_phase4_comments_api.py`

- [x] Write failing tests for creating and listing comments for both project and requirement targets.
- [x] Verify the new tests fail because `/api/v1/comments` does not exist.
- [x] Add the `Comment` SQLModel table and create/read schemas.
- [x] Implement `POST /comments` and `GET /comments?target_type=&target_id=`.
- [x] Validate project/requirement targets and reject invalid target types.
- [x] Mount the router and verify backend tests pass.

### Task 2: Frontend Detail Drawers

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/services/api.ts`
- Modify: `frontend/src/pages/WorkbenchPage.tsx`
- Modify: `frontend/src/App.css`

- [x] Add comment TypeScript types and API functions.
- [x] Add project and requirement row actions that open detail drawers.
- [x] Show full entity fields, tags, and related matches inside drawers.
- [x] Load comments for the selected target and render comment history.
- [x] Add a comment form with author and content fields.

### Task 3: Planning State And Verification

**Files:**
- Modify: `.planning/ROADMAP.md`
- Modify: `.planning/STATE.md`

- [x] Mark Phase 4 complete after verification passes.
- [x] Run `cd backend && uv run pytest`.
- [x] Run `cd frontend && npm run build`.
- [x] Run `cd frontend && npm run lint`.
- [x] Render-check the workbench page and detail drawer.
