# LLM Structured Input Design

## Scope

This feature adds optional AI-assisted structuring for both the requirement pool and the capability pool. Users can still create and edit records manually. The LLM flow helps convert inconsistent free-text descriptions into clearer structured fields, highlights missing business information, and lets the user apply the result into the existing forms.

The first implementation targets Qwen through an OpenAI-compatible API. The default model is `qwen3.6-plus`.

This feature intentionally excludes automatic requirement-project matching, persistent prompt management, login-based access control, and database storage of LLM API keys.

## User Flow

Each create form gets an AI structuring panel:

- User enters a natural-language description.
- User clicks `AI 结构化`.
- Backend calls Qwen and returns structured fields, an optimized description, missing fields, and follow-up questions.
- UI previews the result.
- User can apply the result into the current form, edit it, or ignore it.
- Final save still uses the existing project and requirement create/update APIs.

LLM assistance is optional. If the LLM is unavailable or not configured, users can continue manual entry.

## LLM Configuration

Backend configuration:

- `QWEN_API_KEY`: system default API key.
- `QWEN_MODEL`: optional model override, default `qwen3.6-plus`.
- `QWEN_BASE_URL`: optional compatible endpoint override.

Frontend configuration:

- A low-profile settings button in the page header opens LLM settings.
- Settings can temporarily override API key, model, and base URL for the current browser.
- Browser settings are stored in `localStorage`.
- Backend never writes API keys to SQLite and must not log API keys.

Resolution order:

1. Request-level browser override, when provided.
2. Backend environment variables.
3. Clear configuration error if no key is available.

## Business Fields

Requirement structuring should extract or improve:

- `title`: short customer requirement title.
- `customer`: customer or account name.
- `contact`: requester, sales owner, consultant, or customer contact when available.
- `urgency`: `high`, `medium`, or `low`.
- `description`: optimized structured description.
- `business_line`: Schneider Electric business line or industry tag suggestion.
- `business_scenario`: concrete customer scenario.
- `pain_points`: current pain points.
- `expected_capability`: expected capability or solution outcome.
- `timeline_or_stage`: timing, opportunity stage, or decision deadline.
- `current_solution`: current solution or workaround when available.
- `expected_value`: business value such as efficiency, reliability, energy saving, risk reduction, compliance, or revenue opportunity.

Required information for a useful requirement:

- Customer name.
- Industry or business line.
- Business scenario.
- Current pain point.
- Expected capability or problem to solve.
- Urgency.
- Timeline or opportunity stage.
- Requester or contact.

Capability structuring should extract or improve:

- `name`: capability or pre-research project name.
- `owner`: responsible person or team.
- `status`: one of the existing project status values when possible.
- `description`: optimized structured capability description.
- `business_line`: Schneider Electric business line or industry tag suggestion.
- `business_scenario`: applicable customer scenario.
- `core_capability`: what the capability does.
- `maturity`: idea, research, demo-ready, PoC-ready, delivered, or paused.
- `deliverable_form`: demo, solution, PoC, product module, report, or service package.
- `matchable_requirement_types`: customer needs this capability can match.
- `constraints`: limitations, dependencies, or unsuitable scenarios.

Required information for a useful capability:

- Capability name.
- Owner.
- Industry or business line.
- Applicable business scenario.
- Core capability.
- Current maturity or status.
- Deliverable form.
- Matchable requirement type.
- Constraints or dependencies when relevant.

Schneider Electric tag suggestions should prefer practical categories such as data center, water treatment, industrial automation, building management, power distribution, energy management, sustainability, digital services, and software/automation integration.

## Backend API

Add an `/api/v1/llm` router:

- `GET /api/v1/llm/status`
  - Returns whether the backend has a system Qwen key configured and the effective default model name.
  - Does not return the API key.

- `POST /api/v1/llm/structure-requirement`
  - Accepts raw text plus optional browser override configuration.
  - Returns structured requirement data, missing fields, follow-up questions, and warnings.

- `POST /api/v1/llm/structure-project`
  - Accepts raw text plus optional browser override configuration.
  - Returns structured capability data, missing fields, follow-up questions, and warnings.

The backend owns prompt construction, Qwen calling, JSON parsing, response validation, and configuration errors. It should keep the output tolerant: malformed or partial model output should produce a useful error or partial result instead of crashing.

## Frontend

The workbench header gains a small settings button. The button opens a drawer or modal for:

- API key override.
- Model override, default display `qwen3.6-plus`.
- Base URL override.
- Save to current browser.
- Clear local override.

The project and requirement create sections each gain:

- A natural-language input box.
- `AI 结构化` button.
- Loading and error states.
- Result preview with missing-field warnings.
- `应用到表单` action.

Missing information is shown as suggestions, not a hard blocker. Existing Ant Design form validation remains responsible for required fields before saving.

## Error Handling

Expected errors:

- Missing API key: show `LLM 未配置，请联系管理员或在设置中临时填写 API key`.
- Qwen request failure: show a retryable error and keep manual form entry available.
- Invalid JSON from model: show parsing failure and preserve the raw input.
- Partial result: show returned fields and missing-field warnings.

API keys must be redacted from all error messages.

## Testing

Backend tests should cover:

- LLM status with and without environment configuration.
- Requirement structuring with a mocked Qwen response.
- Project structuring with a mocked Qwen response.
- Missing key error.
- Malformed model output handling.

Frontend verification should cover:

- TypeScript build.
- Local settings persistence helpers.
- Applying structured requirement data to the form.
- Applying structured project data to the form.

Manual verification should confirm:

- Users can still submit records without using AI.
- Missing-field prompts appear after AI structuring.
- API key is not persisted in backend storage.
