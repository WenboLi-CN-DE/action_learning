# Phase 3 Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Phase 3 dashboard so users can see project/requirement counts, matching coverage, and tag-scoped views.

**Architecture:** Keep the existing FastAPI API unchanged because the MVP dataset is small and existing list endpoints already return the data needed for aggregation. Add focused frontend statistics helpers, test them with TypeScript compilation, then render a dashboard tab in the current workbench using Ant Design components.

**Tech Stack:** React, TypeScript, Vite, Ant Design, FastAPI, SQLModel, pytest.

---

### Task 1: Dashboard Statistics Helpers

**Files:**
- Create: `frontend/src/pages/dashboardStats.ts`
- Modify: `frontend/src/pages/WorkbenchPage.tsx`

- [x] Create pure helper functions for tag filtering, coverage counts, and coverage percentage.
- [x] Keep helpers independent from React so they can be type-checked and reused later.
- [x] Import helpers in the workbench page.

### Task 2: Dashboard UI

**Files:**
- Modify: `frontend/src/pages/WorkbenchPage.tsx`
- Modify: `frontend/src/App.css`

- [x] Add a `总览` tab before the existing data-entry tabs.
- [x] Add an industry/business tag selector for scoped dashboard views.
- [x] Show total projects, requirements, matches, matched requirement count, and coverage rate.
- [x] Show coverage status distribution and a focused list of match rows.

### Task 3: Planning State And Verification

**Files:**
- Modify: `.planning/ROADMAP.md`
- Modify: `.planning/STATE.md`

- [x] Mark Phase 3 complete and set Phase 4 as the next focus after verification passes.
- [x] Run `cd backend && uv run pytest`.
- [x] Run `cd frontend && npm run build`.
