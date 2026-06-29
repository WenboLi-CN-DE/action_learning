# LLM Structured Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional Qwen-powered structured input assistance for requirement and capability creation.

**Architecture:** Add a focused backend `/api/v1/llm` router plus a small service module that resolves Qwen configuration, builds prompts, calls an OpenAI-compatible chat completions API, and normalizes JSON output. Add frontend types, API helpers, local settings persistence, a low-profile settings drawer, and reusable AI structuring panels wired into the existing requirement and project create forms.

**Tech Stack:** FastAPI, SQLModel/Pydantic models, pytest/TestClient, httpx, React, TypeScript, Vite, Ant Design.

---

## File Structure

- Create `backend/app/llm_service.py`: Qwen configuration resolution, prompt building, HTTP call, JSON parsing, missing-field normalization.
- Create `backend/app/api/llm.py`: `/api/v1/llm/status`, `/structure-requirement`, and `/structure-project` routes.
- Modify `backend/app/schemas.py`: request/response schemas for LLM structuring.
- Modify `backend/app/main.py`: mount the LLM router.
- Create `backend/tests/test_llm_api.py`: backend TDD coverage using monkeypatched Qwen calls.
- Modify `frontend/src/types.ts`: LLM setting and structured result types.
- Modify `frontend/src/services/api.ts`: LLM status and structure API calls.
- Create `frontend/src/services/llmSettings.ts`: `localStorage` persistence helpers.
- Create `frontend/src/pages/AIStructurePanel.tsx`: reusable natural-language input/result/apply component.
- Modify `frontend/src/pages/WorkbenchPage.tsx`: settings drawer, state, and AI panels in project/requirement forms.
- Modify `frontend/src/App.css`: compact AI panel and settings styles.

## Task 1: Backend Schemas And Status Endpoint

**Files:**
- Modify: `backend/app/schemas.py`
- Create: `backend/app/llm_service.py`
- Create: `backend/app/api/llm.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_llm_api.py`

- [x] **Step 1: Write failing status tests**

Add `backend/tests/test_llm_api.py`:

```python
from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_llm_status_reports_missing_system_key(monkeypatch):
    monkeypatch.delenv("QWEN_API_KEY", raising=False)
    monkeypatch.delenv("QWEN_MODEL", raising=False)

    response = client.get("/api/v1/llm/status")

    assert response.status_code == 200
    assert response.json() == {
        "configured": False,
        "model": "qwen3.6-plus",
    }


def test_llm_status_reports_configured_system_key(monkeypatch):
    monkeypatch.setenv("QWEN_API_KEY", "sk-test")
    monkeypatch.setenv("QWEN_MODEL", "qwen3.6-plus")

    response = client.get("/api/v1/llm/status")

    assert response.status_code == 200
    assert response.json() == {
        "configured": True,
        "model": "qwen3.6-plus",
    }
    assert "sk-test" not in response.text
```

- [x] **Step 2: Verify status tests fail**

Run:

```bash
cd backend
uv run pytest tests/test_llm_api.py -v
```

Expected: FAIL with `404 Not Found` for `/api/v1/llm/status`.

- [x] **Step 3: Add minimal schemas**

Append to `backend/app/schemas.py`:

```python

class LLMStatusRead(SQLModel):
    configured: bool
    model: str
```

- [x] **Step 4: Add minimal service and router**

Create `backend/app/llm_service.py`:

```python
import os

DEFAULT_QWEN_MODEL = "qwen3.6-plus"


def get_default_model() -> str:
    return os.getenv("QWEN_MODEL", DEFAULT_QWEN_MODEL)


def has_system_api_key() -> bool:
    return bool(os.getenv("QWEN_API_KEY"))
```

Create `backend/app/api/llm.py`:

```python
from fastapi import APIRouter

from app.llm_service import get_default_model, has_system_api_key
from app.schemas import LLMStatusRead

router = APIRouter(prefix="/llm", tags=["llm"])


@router.get("/status", response_model=LLMStatusRead)
def get_llm_status():
    return LLMStatusRead(configured=has_system_api_key(), model=get_default_model())
```

Modify `backend/app/main.py`:

```python
from app.api.llm import router as llm_router

api_router.include_router(llm_router)
```

- [x] **Step 5: Verify status tests pass**

Run:

```bash
cd backend
uv run pytest tests/test_llm_api.py -v
```

Expected: PASS for both status tests.

- [x] **Step 6: Commit**

```bash
git add backend/app/schemas.py backend/app/llm_service.py backend/app/api/llm.py backend/app/main.py backend/tests/test_llm_api.py
git commit -m "feat: add llm status endpoint"
```

## Task 2: Backend Structuring Service With Mocked Qwen

**Files:**
- Modify: `backend/app/schemas.py`
- Modify: `backend/app/llm_service.py`
- Modify: `backend/app/api/llm.py`
- Modify: `backend/tests/test_llm_api.py`

- [x] **Step 1: Write failing structuring tests**

Append to `backend/tests/test_llm_api.py`:

```python
def test_structure_requirement_uses_qwen_and_returns_normalized_result(monkeypatch):
    monkeypatch.delenv("QWEN_API_KEY", raising=False)

    def fake_call_qwen(*, raw_text, target_type, api_key, model, base_url):
        assert raw_text == "客户希望优化数据中心能耗。"
        assert target_type == "requirement"
        assert api_key == "browser-key"
        assert model == "qwen3.6-plus"
        return {
            "fields": {
                "title": "数据中心能耗优化需求",
                "customer": "未提供",
                "description": "客户希望优化数据中心能耗，需补充客户名称和时间节点。",
                "urgency": "medium",
                "business_line": "数据中心",
                "business_scenario": "数据中心能源管理",
                "pain_points": "能耗较高",
                "expected_capability": "能耗分析与优化建议",
                "timeline_or_stage": "",
                "contact": "",
            },
            "missing_fields": ["客户名称", "时间节点或机会阶段", "提需求人/联系人"],
            "follow_up_questions": ["客户名称是什么？", "期望什么时候完成评估？"],
            "warnings": [],
        }

    monkeypatch.setattr("app.llm_service.call_qwen_for_structure", fake_call_qwen)

    response = client.post(
        "/api/v1/llm/structure-requirement",
        json={
            "raw_text": "客户希望优化数据中心能耗。",
            "api_key": "browser-key",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["fields"]["title"] == "数据中心能耗优化需求"
    assert payload["fields"]["business_line"] == "数据中心"
    assert "客户名称" in payload["missing_fields"]
    assert payload["model"] == "qwen3.6-plus"
    assert "browser-key" not in response.text


def test_structure_project_uses_system_key_when_browser_key_absent(monkeypatch):
    monkeypatch.setenv("QWEN_API_KEY", "system-key")

    def fake_call_qwen(*, raw_text, target_type, api_key, model, base_url):
        assert raw_text == "我们有楼宇能效管理 demo。"
        assert target_type == "project"
        assert api_key == "system-key"
        return {
            "fields": {
                "name": "楼宇能效管理 Demo",
                "owner": "未提供",
                "status": "demo_ready",
                "description": "面向楼宇场景的能效管理演示能力。",
                "business_line": "楼宇",
                "business_scenario": "楼宇能源管理",
                "core_capability": "能耗监测与优化建议",
                "maturity": "demo-ready",
                "deliverable_form": "demo",
                "matchable_requirement_types": "楼宇节能与运营优化需求",
                "constraints": "",
            },
            "missing_fields": ["负责人"],
            "follow_up_questions": ["该能力负责人是谁？"],
            "warnings": [],
        }

    monkeypatch.setattr("app.llm_service.call_qwen_for_structure", fake_call_qwen)

    response = client.post(
        "/api/v1/llm/structure-project",
        json={"raw_text": "我们有楼宇能效管理 demo。"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["fields"]["name"] == "楼宇能效管理 Demo"
    assert payload["fields"]["status"] == "demo_ready"
    assert "负责人" in payload["missing_fields"]
    assert "system-key" not in response.text


def test_structure_returns_clear_error_without_api_key(monkeypatch):
    monkeypatch.delenv("QWEN_API_KEY", raising=False)

    response = client.post(
        "/api/v1/llm/structure-requirement",
        json={"raw_text": "客户需要节能。"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "LLM 未配置，请联系管理员或在设置中临时填写 API key"
```

- [x] **Step 2: Verify structuring tests fail**

Run:

```bash
cd backend
uv run pytest tests/test_llm_api.py -v
```

Expected: FAIL because request/response schemas and structuring endpoints are missing.

- [x] **Step 3: Add structuring schemas**

Append to `backend/app/schemas.py`:

```python

class LLMOverride(SQLModel):
    api_key: str | None = None
    model: str | None = None
    base_url: str | None = None


class LLMStructureRequest(LLMOverride):
    raw_text: str


class LLMStructureResult(SQLModel):
    fields: dict[str, str | None] = {}
    missing_fields: list[str] = []
    follow_up_questions: list[str] = []
    warnings: list[str] = []
    model: str
```

- [x] **Step 4: Implement config resolution and mocked-call seam**

Replace `backend/app/llm_service.py` with:

```python
import json
import os
from typing import Any

import httpx
from fastapi import HTTPException

DEFAULT_QWEN_MODEL = "qwen3.6-plus"
DEFAULT_QWEN_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
MISSING_KEY_MESSAGE = "LLM 未配置，请联系管理员或在设置中临时填写 API key"


def get_default_model() -> str:
    return os.getenv("QWEN_MODEL", DEFAULT_QWEN_MODEL)


def has_system_api_key() -> bool:
    return bool(os.getenv("QWEN_API_KEY"))


def resolve_qwen_config(api_key: str | None, model: str | None, base_url: str | None) -> tuple[str, str, str]:
    resolved_key = api_key or os.getenv("QWEN_API_KEY")
    if not resolved_key:
        raise HTTPException(status_code=400, detail=MISSING_KEY_MESSAGE)
    resolved_model = model or get_default_model()
    resolved_base_url = (base_url or os.getenv("QWEN_BASE_URL") or DEFAULT_QWEN_BASE_URL).rstrip("/")
    return resolved_key, resolved_model, resolved_base_url


def build_structure_prompt(raw_text: str, target_type: str) -> list[dict[str, str]]:
    if target_type == "requirement":
        target_label = "客户需求"
        required = "客户名称、行业或业务线、业务场景、当前痛点、期望能力、紧急度、时间节点或机会阶段、提需求人或联系人"
    else:
        target_label = "后端预研能力/项目"
        required = "能力名称、负责人、行业或业务线、适用业务场景、核心能力、成熟度或状态、可交付形式、可匹配需求类型、限制条件"

    system = (
        "你是施耐德电气内部 AI 工坊平台的信息结构化助手。"
        "请围绕数据中心、水处理、工业自动化、楼宇管理、电力配电、能源管理、可持续发展、数字化服务、软件和自动化集成等业务方向提取信息。"
        "只返回 JSON，不要返回 Markdown。"
    )
    user = (
        f"请将下面的{target_label}描述整理为结构化 JSON。"
        f"必须检查这些关键信息是否充分：{required}。"
        "返回格式为：{\"fields\": {...}, \"missing_fields\": [], \"follow_up_questions\": [], \"warnings\": []}。"
        f"原始描述：{raw_text}"
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def normalize_structure_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "fields": payload.get("fields") if isinstance(payload.get("fields"), dict) else {},
        "missing_fields": payload.get("missing_fields") if isinstance(payload.get("missing_fields"), list) else [],
        "follow_up_questions": payload.get("follow_up_questions") if isinstance(payload.get("follow_up_questions"), list) else [],
        "warnings": payload.get("warnings") if isinstance(payload.get("warnings"), list) else [],
    }


def call_qwen_for_structure(
    *,
    raw_text: str,
    target_type: str,
    api_key: str,
    model: str,
    base_url: str,
) -> dict[str, Any]:
    response = httpx.post(
        f"{base_url}/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "messages": build_structure_prompt(raw_text, target_type),
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
        },
        timeout=30.0,
    )
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"]
    return normalize_structure_payload(json.loads(content))
```

- [x] **Step 5: Implement structuring routes**

Replace `backend/app/api/llm.py` with:

```python
from fastapi import APIRouter, HTTPException

from app import llm_service
from app.schemas import LLMStatusRead, LLMStructureRequest, LLMStructureResult

router = APIRouter(prefix="/llm", tags=["llm"])


@router.get("/status", response_model=LLMStatusRead)
def get_llm_status():
    return LLMStatusRead(configured=llm_service.has_system_api_key(), model=llm_service.get_default_model())


def structure_text(payload: LLMStructureRequest, target_type: str) -> LLMStructureResult:
    api_key, model, base_url = llm_service.resolve_qwen_config(payload.api_key, payload.model, payload.base_url)
    try:
        result = llm_service.call_qwen_for_structure(
            raw_text=payload.raw_text,
            target_type=target_type,
            api_key=api_key,
            model=model,
            base_url=base_url,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM 调用失败：{exc.__class__.__name__}") from exc
    return LLMStructureResult(**result, model=model)


@router.post("/structure-requirement", response_model=LLMStructureResult)
def structure_requirement(payload: LLMStructureRequest):
    return structure_text(payload, "requirement")


@router.post("/structure-project", response_model=LLMStructureResult)
def structure_project(payload: LLMStructureRequest):
    return structure_text(payload, "project")
```

- [x] **Step 6: Verify backend structuring tests pass**

Run:

```bash
cd backend
uv run pytest tests/test_llm_api.py -v
```

Expected: PASS.

- [x] **Step 7: Run all backend tests**

Run:

```bash
cd backend
uv run pytest
```

Expected: PASS.

- [x] **Step 8: Commit**

```bash
git add backend/app/schemas.py backend/app/llm_service.py backend/app/api/llm.py backend/tests/test_llm_api.py
git commit -m "feat: add qwen structuring api"
```

## Task 3: Frontend Types, API Helpers, And Settings Persistence

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/services/api.ts`
- Create: `frontend/src/services/llmSettings.ts`
- Create: `frontend/src/pages/llmSettings.typecheck.ts`

- [x] **Step 1: Write failing typecheck usage**

Create `frontend/src/pages/llmSettings.typecheck.ts`:

```typescript
import {
  clearLLMSettings,
  loadLLMSettings,
  saveLLMSettings,
} from '../services/llmSettings'
import type { LLMSettings } from '../types'

const settings: LLMSettings = {
  api_key: 'browser-key',
  model: 'qwen3.6-plus',
  base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
}

saveLLMSettings(settings)
const loaded = loadLLMSettings()
if (loaded?.model !== 'qwen3.6-plus') {
  throw new Error('settings model mismatch')
}
clearLLMSettings()
```

- [x] **Step 2: Verify frontend build fails**

Run:

```bash
cd frontend
npm run build
```

Expected: FAIL because `LLMSettings` and `llmSettings` helpers do not exist.

- [x] **Step 3: Add LLM types**

Append to `frontend/src/types.ts`:

```typescript

export interface LLMSettings {
  api_key?: string
  model?: string
  base_url?: string
}

export interface LLMStatus {
  configured: boolean
  model: string
}

export interface LLMStructureRequest extends LLMSettings {
  raw_text: string
}

export interface LLMStructureResult {
  fields: Record<string, string | null>
  missing_fields: string[]
  follow_up_questions: string[]
  warnings: string[]
  model: string
}
```

- [x] **Step 4: Add API helpers**

Modify `frontend/src/services/api.ts` imports and exports:

```typescript
import type {
  CommentItem,
  CommentPayload,
  LLMSettings,
  LLMStatus,
  LLMStructureResult,
  MatchItem,
  MatchPayload,
  ProjectItem,
  ProjectPayload,
  RequirementItem,
  RequirementPayload,
  TagItem,
  TagPayload,
} from '../types'
```

Append:

```typescript
export const fetchLLMStatus = () => fetchJSON<LLMStatus>('/llm/status')

export const structureRequirement = (rawText: string, settings: LLMSettings | null) =>
  fetchJSON<LLMStructureResult>('/llm/structure-requirement', {
    method: 'POST',
    body: JSON.stringify({ raw_text: rawText, ...(settings ?? {}) }),
  })

export const structureProject = (rawText: string, settings: LLMSettings | null) =>
  fetchJSON<LLMStructureResult>('/llm/structure-project', {
    method: 'POST',
    body: JSON.stringify({ raw_text: rawText, ...(settings ?? {}) }),
  })
```

- [x] **Step 5: Add settings persistence helpers**

Create `frontend/src/services/llmSettings.ts`:

```typescript
import type { LLMSettings } from '../types'

const STORAGE_KEY = 'action_learning_llm_settings'

export function loadLLMSettings(): LLMSettings | null {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as LLMSettings
    return {
      api_key: parsed.api_key || undefined,
      model: parsed.model || undefined,
      base_url: parsed.base_url || undefined,
    }
  } catch {
    return null
  }
}

export function saveLLMSettings(settings: LLMSettings) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function clearLLMSettings() {
  window.localStorage.removeItem(STORAGE_KEY)
}
```

- [x] **Step 6: Verify frontend build passes**

Run:

```bash
cd frontend
npm run build
```

Expected: PASS. A Vite chunk-size warning is acceptable.

- [x] **Step 7: Commit**

```bash
git add frontend/src/types.ts frontend/src/services/api.ts frontend/src/services/llmSettings.ts frontend/src/pages/llmSettings.typecheck.ts
git commit -m "feat: add frontend llm api helpers"
```

## Task 4: Reusable AI Structure Panel

**Files:**
- Create: `frontend/src/pages/AIStructurePanel.tsx`
- Modify: `frontend/src/App.css`
- Modify: `frontend/src/pages/WorkbenchPage.tsx`

- [x] **Step 1: Add reusable component**

Create `frontend/src/pages/AIStructurePanel.tsx`:

```tsx
import { Alert, Button, Card, Empty, Input, List, Space, Tag, Typography } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import type { LLMStructureResult } from '../types'

const { Text, Title } = Typography
const { TextArea } = Input

interface AIStructurePanelProps {
  title: string
  placeholder: string
  rawText: string
  result: LLMStructureResult | null
  loading: boolean
  error: string | null
  onRawTextChange: (value: string) => void
  onStructure: () => void
  onApply: () => void
}

export default function AIStructurePanel({
  title,
  placeholder,
  rawText,
  result,
  loading,
  error,
  onRawTextChange,
  onStructure,
  onApply,
}: AIStructurePanelProps) {
  return (
    <Card className="ai-structure-panel" size="small">
      <Space direction="vertical" size="middle" className="ai-structure-stack">
        <div>
          <Title level={5}>{title}</Title>
          <Text type="secondary">输入自然语言描述，AI 会整理字段并提示建议补充的信息。</Text>
        </div>
        <TextArea
          rows={4}
          value={rawText}
          placeholder={placeholder}
          onChange={(event) => onRawTextChange(event.target.value)}
        />
        <Space>
          <Button icon={<RobotOutlined />} onClick={onStructure} loading={loading} disabled={!rawText.trim()}>
            AI 结构化
          </Button>
          <Button type="primary" onClick={onApply} disabled={!result}>
            应用到表单
          </Button>
        </Space>
        {error && <Alert type="error" showIcon message={error} />}
        {result && (
          <div className="ai-result">
            <Text type="secondary">模型：{result.model}</Text>
            {result.missing_fields.length > 0 && (
              <Alert
                type="warning"
                showIcon
                message="建议补充"
                description={
                  <Space size={[4, 4]} wrap>
                    {result.missing_fields.map((field) => (
                      <Tag key={field} color="gold">
                        {field}
                      </Tag>
                    ))}
                  </Space>
                }
              />
            )}
            <List
              size="small"
              dataSource={Object.entries(result.fields).filter(([, value]) => value)}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无结构化字段" /> }}
              renderItem={([key, value]) => (
                <List.Item>
                  <Text strong>{key}</Text>
                  <Text>{value}</Text>
                </List.Item>
              )}
            />
            {result.follow_up_questions.length > 0 && (
              <Alert
                type="info"
                showIcon
                message="建议追问"
                description={
                  <ul className="ai-question-list">
                    {result.follow_up_questions.map((question) => (
                      <li key={question}>{question}</li>
                    ))}
                  </ul>
                }
              />
            )}
          </div>
        )}
      </Space>
    </Card>
  )
}
```

- [x] **Step 2: Add styles**

Append to `frontend/src/App.css`:

```css
.ai-structure-panel {
  border-color: #d7eadb;
  background: #f8fcf8;
}

.ai-structure-stack {
  width: 100%;
}

.ai-result {
  display: grid;
  gap: 12px;
}

.ai-question-list {
  margin: 0;
  padding-left: 18px;
}
```

- [x] **Step 3: Verify component compiles by importing it**

Temporarily import the component in `frontend/src/pages/WorkbenchPage.tsx`:

```tsx
import AIStructurePanel from './AIStructurePanel'
```

Do not render it yet in this task.

- [x] **Step 4: Run frontend build**

Run:

```bash
cd frontend
npm run build
```

Expected: PASS or FAIL only if lint/compiler reports unused import. If unused import fails, remove the temporary import and defer import to Task 5.

- [x] **Step 5: Commit**

```bash
git add frontend/src/pages/AIStructurePanel.tsx frontend/src/App.css frontend/src/pages/WorkbenchPage.tsx
git commit -m "feat: add ai structure panel"
```

## Task 5: Wire LLM Settings And AI Panels Into Workbench

**Files:**
- Modify: `frontend/src/pages/WorkbenchPage.tsx`
- Modify: `frontend/src/App.css`

- [x] **Step 1: Add imports and state**

Modify `frontend/src/pages/WorkbenchPage.tsx` imports:

```tsx
import { SettingOutlined } from '@ant-design/icons'
import AIStructurePanel from './AIStructurePanel'
import { clearLLMSettings, loadLLMSettings, saveLLMSettings } from '../services/llmSettings'
import { fetchLLMStatus, structureProject, structureRequirement } from '../services/api'
import type { LLMSettings, LLMStatus, LLMStructureResult } from '../types'
```

Inside `WorkbenchPage`, add:

```tsx
const [llmSettingsOpen, setLLMSettingsOpen] = useState(false)
const [llmSettings, setLLMSettings] = useState<LLMSettings | null>(() => loadLLMSettings())
const [llmStatus, setLLMStatus] = useState<LLMStatus | null>(null)
const [projectRawText, setProjectRawText] = useState('')
const [requirementRawText, setRequirementRawText] = useState('')
const [projectAIResult, setProjectAIResult] = useState<LLMStructureResult | null>(null)
const [requirementAIResult, setRequirementAIResult] = useState<LLMStructureResult | null>(null)
const [projectAIError, setProjectAIError] = useState<string | null>(null)
const [requirementAIError, setRequirementAIError] = useState<string | null>(null)
const [projectAILoading, setProjectAILoading] = useState(false)
const [requirementAILoading, setRequirementAILoading] = useState(false)
const [llmSettingsForm] = Form.useForm<LLMSettings>()
```

- [x] **Step 2: Load LLM status**

Add to the existing initial `useEffect` body or a separate `useEffect`:

```tsx
useEffect(() => {
  fetchLLMStatus()
    .then(setLLMStatus)
    .catch(() => setLLMStatus(null))
}, [])
```

- [x] **Step 3: Add structure/apply handlers**

Add functions inside `WorkbenchPage`:

```tsx
async function runProjectStructuring() {
  setProjectAILoading(true)
  setProjectAIError(null)
  try {
    const result = await structureProject(projectRawText, llmSettings)
    setProjectAIResult(result)
  } catch (err) {
    setProjectAIError(err instanceof Error ? err.message : 'AI 结构化失败')
  } finally {
    setProjectAILoading(false)
  }
}

async function runRequirementStructuring() {
  setRequirementAILoading(true)
  setRequirementAIError(null)
  try {
    const result = await structureRequirement(requirementRawText, llmSettings)
    setRequirementAIResult(result)
  } catch (err) {
    setRequirementAIError(err instanceof Error ? err.message : 'AI 结构化失败')
  } finally {
    setRequirementAILoading(false)
  }
}

function applyProjectAIResult() {
  if (!projectAIResult) return
  projectForm.setFieldsValue({
    name: projectAIResult.fields.name ?? undefined,
    owner: projectAIResult.fields.owner ?? undefined,
    status: projectAIResult.fields.status ?? undefined,
    description: projectAIResult.fields.description ?? undefined,
  })
  messageApi.success('AI 结果已应用到能力表单')
}

function applyRequirementAIResult() {
  if (!requirementAIResult) return
  requirementForm.setFieldsValue({
    title: requirementAIResult.fields.title ?? undefined,
    customer: requirementAIResult.fields.customer ?? undefined,
    contact: requirementAIResult.fields.contact ?? undefined,
    urgency: requirementAIResult.fields.urgency ?? undefined,
    description: requirementAIResult.fields.description ?? undefined,
  })
  messageApi.success('AI 结果已应用到需求表单')
}

function openLLMSettings() {
  llmSettingsForm.setFieldsValue({
    api_key: llmSettings?.api_key,
    model: llmSettings?.model ?? llmStatus?.model ?? 'qwen3.6-plus',
    base_url: llmSettings?.base_url,
  })
  setLLMSettingsOpen(true)
}

function submitLLMSettings(values: LLMSettings) {
  const next = {
    api_key: values.api_key || undefined,
    model: values.model || undefined,
    base_url: values.base_url || undefined,
  }
  saveLLMSettings(next)
  setLLMSettings(next)
  setLLMSettingsOpen(false)
  messageApi.success('LLM 设置已保存到当前浏览器')
}

function clearLocalLLMSettings() {
  clearLLMSettings()
  setLLMSettings(null)
  llmSettingsForm.resetFields()
  messageApi.success('已清除本地 LLM 设置')
}
```

- [x] **Step 4: Render settings button and drawer**

In header `header-actions`, add:

```tsx
<Button icon={<SettingOutlined />} onClick={openLLMSettings}>
  设置
</Button>
```

Before the existing detail drawer, add:

```tsx
<Drawer
  title="LLM 设置"
  open={llmSettingsOpen}
  onClose={() => setLLMSettingsOpen(false)}
>
  <Alert
    className="app-alert"
    type={llmStatus?.configured ? 'success' : 'warning'}
    showIcon
    message={llmStatus?.configured ? '系统默认 Qwen Key 已配置' : '系统默认 Qwen Key 未配置'}
    description={`默认模型：${llmStatus?.model ?? 'qwen3.6-plus'}。本地设置只保存在当前浏览器，用于临时覆盖。`}
  />
  <Form form={llmSettingsForm} layout="vertical" onFinish={submitLLMSettings}>
    <Form.Item name="api_key" label="API Key">
      <Input.Password placeholder="留空则使用系统默认配置" />
    </Form.Item>
    <Form.Item name="model" label="模型">
      <Input placeholder="qwen3.6-plus" />
    </Form.Item>
    <Form.Item name="base_url" label="Base URL">
      <Input placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1" />
    </Form.Item>
    <Space>
      <Button type="primary" htmlType="submit">
        保存
      </Button>
      <Button onClick={clearLocalLLMSettings}>清除本地设置</Button>
    </Space>
  </Form>
</Drawer>
```

- [x] **Step 5: Render AI panels in project and requirement forms**

In the project form section, insert above `<Form form={projectForm} ...>`:

```tsx
<AIStructurePanel
  title="AI 结构化能力描述"
  placeholder="例如：我们有一个面向数据中心的能耗分析 demo，可以帮助客户识别高耗能设备并给出优化建议..."
  rawText={projectRawText}
  result={projectAIResult}
  loading={projectAILoading}
  error={projectAIError}
  onRawTextChange={setProjectRawText}
  onStructure={runProjectStructuring}
  onApply={applyProjectAIResult}
/>
```

In the requirement form section, insert above `<Form form={requirementForm} ...>`:

```tsx
<AIStructurePanel
  title="AI 结构化需求描述"
  placeholder="例如：某数据中心客户希望降低 PUE，但目前缺少统一能耗分析，希望近期做一次节能评估..."
  rawText={requirementRawText}
  result={requirementAIResult}
  loading={requirementAILoading}
  error={requirementAIError}
  onRawTextChange={setRequirementRawText}
  onStructure={runRequirementStructuring}
  onApply={applyRequirementAIResult}
/>
```

- [x] **Step 6: Run frontend build**

Run:

```bash
cd frontend
npm run build
```

Expected: PASS. Fix import collisions or long-line formatting if TypeScript fails.

- [x] **Step 7: Commit**

```bash
git add frontend/src/pages/WorkbenchPage.tsx frontend/src/App.css
git commit -m "feat: wire ai structuring into workbench"
```

## Task 6: Verification And Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/deployment-notes.md`

- [x] **Step 1: Document environment variables**

Add to `README.md` near deployment instructions:

```markdown
### LLM 配置

AI 结构化输入默认使用 Qwen OpenAI-compatible API。生产部署推荐在后端服务环境中配置：

- `QWEN_API_KEY`：系统默认 API key
- `QWEN_MODEL`：模型名，默认 `qwen3.6-plus`
- `QWEN_BASE_URL`：可选，默认 DashScope OpenAI-compatible endpoint

API key 不会写入数据库。页面右上角“设置”可为当前浏览器临时覆盖配置。
```

Add the same variable summary to `docs/deployment-notes.md`.

- [x] **Step 2: Run backend tests**

Run:

```bash
cd backend
uv run pytest
```

Expected: PASS.

- [x] **Step 3: Run frontend build and lint**

Run:

```bash
cd frontend
npm run build
npm run lint
```

Expected: PASS. Existing Vite chunk-size warning is acceptable.

- [x] **Step 4: Manual smoke test**

Run dev servers:

```bash
./scripts/dev.sh
```

Open `http://127.0.0.1:5173` and verify:

- Settings drawer opens from the header.
- Without a configured key, AI structuring shows the clear missing-key error.
- With a temporary browser key, both requirement and project AI buttons call the backend.
- Manual project and requirement creation still works without using AI.

- [x] **Step 5: Commit docs and final verification**

```bash
git add README.md docs/deployment-notes.md
git commit -m "docs: document llm configuration"
```

- [x] **Step 6: Final status**

Run:

```bash
git status --short
```

Expected: clean worktree.

## Self-Review

Spec coverage:

- Optional AI for requirement and capability creation: Tasks 4 and 5.
- Qwen OpenAI-compatible API and `qwen3.6-plus`: Tasks 1, 2, 3, 5, 6.
- System key plus local override: Tasks 1, 2, 3, 5.
- No key persistence in backend: Tasks 1, 2, 6.
- Missing fields and follow-up questions: Tasks 2, 4, 5.
- Clear errors and no API key leakage: Tasks 1, 2, 6.
- Backend and frontend verification: Tasks 2, 3, 5, 6.

Placeholder scan: no TBD/TODO/later placeholders.

Type consistency: backend uses `api_key`, `model`, `base_url`, `raw_text`; frontend types and API helpers use the same property names.
