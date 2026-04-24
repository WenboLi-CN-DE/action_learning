---
phase: 01-skeleton-env-verify
plan: 02
status: complete
started: 2026-04-24
completed: 2026-04-24
self_check: PASSED
---

# Plan 01-02: 前端项目初始化与前后端联调验证

## Objective
初始化 React 前端项目，配置 Vite proxy 联调后端 API，创建联调 demo 页面验证前后端通信。

## What Was Built
- React + TypeScript 前端项目（Vite 脚手架）
- 核心依赖：Ant Design、Zustand、Axios、react-router、dayjs
- Vite dev server proxy 配置（`/api` → `http://localhost:8000`）
- 前端应用骨架：中文 locale 配置、API 服务层、DemoPage 联调页面
- 后端集成测试：验证 health、demo、CORS 端点可被前端正常访问

## Key Files Created
| 文件 | 用途 |
|------|------|
| `frontend/vite.config.ts` | Vite 配置 + `/api` proxy 到后端 |
| `frontend/src/main.tsx` | 应用入口，配置 Ant Design 中文 locale |
| `frontend/src/App.tsx` | 路由配置，根路径挂载 DemoPage |
| `frontend/src/services/api.ts` | API 服务层，封装 fetchJSON、fetchHealth、fetchDemoData |
| `frontend/src/pages/DemoPage.tsx` | 联调页面，展示后端健康状态和测试数据 |
| `frontend/src/App.css` | 最小化样式 |
| `backend/tests/test_integration.py` | 集成测试：health、demo、CORS 验证 |

## Key Decisions
1. **路由路径修正**：集成测试中 health 端点实际路径为 `/api/v1/health`（非 `/health`），因为 health_router 挂载在 `prefix="/api/v1"` 的 api_router 下。Vite proxy 将前端 `/api` 请求转发到后端，所以前端调用 `/api/v1/health` 时，proxy 转发到 `http://localhost:8000/api/v1/health`。
2. **使用原生 fetch 而非 axios**：API 服务层使用原生 `fetch` API，减少依赖体积；axios 已安装供后续复杂场景使用。
3. **Ant Design 中文 locale**：main.tsx 中配置 `ConfigProvider` 使用 `zh_CN` locale，确保组件文案为中文。

## Verification Results
### 后端测试（7/7 passed）
- `test_health_returns_200` ✅
- `test_health_returns_ok_status` ✅
- `test_demo_endpoint_returns_data` ✅
- `test_cors_headers_present` ✅
- `test_health_endpoint_accessible_from_frontend_proxy` ✅
- `test_demo_endpoint_returns_list` ✅
- `test_cors_allows_frontend_origin` ✅

### 前端构建
- `npm run build` ✅ 通过（593.72 kB JS bundle，含 Ant Design）
- 警告：bundle 超过 500 kB，后续可通过 code-splitting 优化

## Deviations
- 集成测试中 health 端点路径从 `/health` 修正为 `/api/v1/health`，以匹配后端实际路由结构。
