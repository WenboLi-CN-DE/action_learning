# 内网部署验证流程

## 目标
确认平台可部署到公司内网服务器，团队成员可通过内网 IP/域名访问平台。

## 当前已知信息
- 开发环境：Windows，Python 3.12+，Node.js 18+
- 后端启动方式：`uv run uvicorn app.main:app --host 0.0.0.0 --port 8000`
- 前端构建方式：`npm run build` → `dist/` 目录
- 数据库：SQLite 单文件 `database.db`，零运维

## 待确认事项（🔴 需在执行前确认）
- ❓ 内网服务器操作系统（Windows/Linux？）
- ❓ 服务器是否可安装 Python 3.12+ 和 Node.js 18+？
- ❓ 服务器是否有网络访问 PyPI/npm（安装依赖）？若无，需离线安装方案
- ❓ 服务器可用端口（8000 后端 + 5173 前端？）
- ❓ 团队成员如何访问内网服务器（IP地址/域名/VPN？）

## 部署方案选项

### 方案 A: 直接部署（如果服务器也是 Windows）
1. 在服务器上安装 uv + Node.js
2. 克隆项目代码
3. `cd backend && uv sync && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000`
4. `cd frontend && npm install && npm run build`
5. 用简单 HTTP 服务器（如 `serve` 或 Python `http.server`）serve 前端 dist 目录
6. 团队访问 http://[服务器IP]:8000/docs（后端）和 http://[服务器IP]:3000（前端）

### 方案 B: Docker 部署（如果服务器是 Linux）
1. 创建 Dockerfile（后端）+ Dockerfile（前端）
2. docker-compose.yml 编排两个服务
3. `docker-compose up -d`
4. 团队访问 http://[服务器IP]
注意：此方案后续 Phase 实现，Phase 1 仅记录流程

### 方案 C: Nginx 反向代理（推荐，两种 OS 都可用）
1. `npm run build` 生成前端静态文件
2. Nginx serve 前端静态文件 + 反向代理 /api 到后端
3. 单端口（80 或 8080）对外暴露
4. 消除 CORS 问题（同域访问）

## Phase 1 部署验证步骤（确认服务器信息后执行）
1. 确认服务器 OS 和可用端口
2. 在服务器上验证 Python/Node 可安装
3. 验证后端服务可启动（health endpoint 可访问）
4. 验证前端静态文件可 serve
5. 验证团队成员可通过内网 IP 访问平台

---
*Created: 2026-04-24 — Phase 1 计划阶段*
