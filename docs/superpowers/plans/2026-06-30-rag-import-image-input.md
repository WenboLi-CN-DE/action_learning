# RAG Import And Image Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the current RAG MVP, add document import into the knowledge base, and let requirement/capability AI input start from uploaded images.

**Architecture:** Extend the existing FastAPI routers and services instead of adding a parallel subsystem. RAG import will reuse `rag_service.get_backend().ingest`; image recognition will reuse the existing Qwen configuration resolver and expose a small OCR-style endpoint that the frontend feeds into the existing AI structuring panels.

**Tech Stack:** FastAPI, SQLModel/Pydantic schemas, pytest/TestClient, httpx, React, TypeScript, Vite, Ant Design.

---

### Task 1: RAG Text Document Import API

**Files:**
- Modify: `backend/app/schemas.py`
- Modify: `backend/app/api/rag.py`
- Test: `backend/tests/test_rag_api.py`

- [ ] **Step 1: Write failing import tests**

Add tests for importing plain text/markdown content into RAG through multipart upload, and rejecting empty/unsupported files.

- [ ] **Step 2: Run targeted tests and verify red**

Run: `cd backend && uv run pytest tests/test_rag_api.py::test_rag_import_text_file_ingests_content tests/test_rag_api.py::test_rag_import_rejects_empty_file tests/test_rag_api.py::test_rag_import_rejects_unsupported_extension -v`

Expected: failures because `/api/v1/rag/import-file` does not exist.

- [ ] **Step 3: Implement minimal import endpoint**

Add `RAGImportResult` and implement `POST /api/v1/rag/import-file` using `UploadFile`, extension validation for `.txt`, `.md`, `.csv`, UTF-8 decoding, and existing `backend.ingest`.

- [ ] **Step 4: Run targeted tests and verify green**

Run: `cd backend && uv run pytest tests/test_rag_api.py -v`

Expected: all RAG API tests pass.

### Task 2: Image Recognition API

**Files:**
- Modify: `backend/app/schemas.py`
- Modify: `backend/app/llm_service.py`
- Modify: `backend/app/api/llm.py`
- Test: `backend/tests/test_llm_api.py`

- [ ] **Step 1: Write failing image recognition tests**

Add tests for `POST /api/v1/llm/recognize-image` with mocked Qwen vision response, missing API key, and unsupported file type.

- [ ] **Step 2: Run targeted tests and verify red**

Run: `cd backend && uv run pytest tests/test_llm_api.py::test_recognize_image_returns_extracted_text tests/test_llm_api.py::test_recognize_image_rejects_unsupported_file tests/test_llm_api.py::test_recognize_image_requires_api_key -v`

Expected: failures because the endpoint does not exist.

- [ ] **Step 3: Implement minimal image recognition**

Add schema `LLMImageRecognitionResult`, helper `call_qwen_for_image_recognition`, and router endpoint accepting multipart image upload plus optional API configuration fields.

- [ ] **Step 4: Run targeted tests and verify green**

Run: `cd backend && uv run pytest tests/test_llm_api.py -v`

Expected: all LLM API tests pass.

### Task 3: Frontend Import And Image Input UI

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/services/api.ts`
- Modify: `frontend/src/pages/KnowledgeSearchPage.tsx`
- Modify: `frontend/src/pages/AIStructurePanel.tsx`
- Modify: `frontend/src/pages/WorkbenchPage.tsx`

- [ ] **Step 1: Add API types and helpers**

Add `RAGImportResult` and `LLMImageRecognitionResult` types plus `importRAGFile` and `recognizeImage` service helpers using `FormData`.

- [ ] **Step 2: Add knowledge import UI**

Add a compact upload form to `KnowledgeSearchPage` that accepts `.txt,.md,.csv`, optional tags, source type, and calls `importRAGFile`.

- [ ] **Step 3: Add image input to AI structuring panel**

Update `AIStructurePanel` to accept an optional image recognition callback and show an upload button. After recognition, append extracted text into the natural-language input so the existing structure flow remains unchanged.

- [ ] **Step 4: Wire image recognition from workbench**

In `WorkbenchPage`, call `recognizeImage` with current local LLM settings and pass callbacks into both requirement and capability AI panels.

- [ ] **Step 5: Build frontend**

Run: `cd frontend && npm run build`

Expected: TypeScript and Vite build pass.

### Task 4: Full Verification And Commit

**Files:**
- Review all changed files

- [ ] **Step 1: Run backend test suite**

Run: `cd backend && uv run pytest`

Expected: all tests pass.

- [ ] **Step 2: Run frontend build**

Run: `cd frontend && npm run build`

Expected: build passes.

- [ ] **Step 3: Review git status and diff**

Run: `git status --short && git diff --stat`

Expected: only RAG import, image recognition, frontend UI, plan/docs, and existing intended RAG files are changed.

- [ ] **Step 4: Commit**

Run: `git add ... && git commit -m "feat: add rag import and image input"`

Expected: commit succeeds on `codex/rag-import-image-input`.
