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

## 本地一键启动

Windows PowerShell：

```powershell
.\scripts\dev.ps1
```

macOS / Linux：

```bash
./scripts/dev.sh
```

默认启动：

- 后端：`http://127.0.0.1:8000`
- 前端：`http://127.0.0.1:5173`

端口冲突时：

```powershell
.\scripts\dev.ps1 -BackendPort 8001 -FrontendPort 5174
```

```bash
./scripts/dev.sh --backend-port 8001 --frontend-port 5174
```

## 推荐部署方案：Ubuntu + Nginx + systemd

该方案适合当前 MVP：

- Nginx serve 前端 `frontend/dist`
- Nginx 反向代理 `/api/`、`/docs`、`/openapi.json` 到 FastAPI
- systemd 托管后端进程
- SQLite 文件保存在 `backend/database.db`

### 服务器前置条件

服务器需提前安装：

- `git`
- `uv`
- `Node.js 18+ / npm`
- `nginx`
- 可执行 `sudo`

### 一键部署

在服务器已有仓库目录中运行：

```bash
sudo env APP_DIR=/opt/action_learning SERVICE_USER=wenbo bash scripts/deploy-ubuntu.sh
```

如果服务器还没有代码，可以先克隆：

```bash
git -c http.proxy="" -c https.proxy="" clone https://github.schneider-electric.com/SESA783337/action_learning.git
cd action_learning
sudo env APP_DIR=/opt/action_learning SERVICE_USER=wenbo bash scripts/deploy-ubuntu.sh
```

### 可选环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `APP_DIR` | `/opt/action_learning` | 服务器部署目录 |
| `REPO_URL` | Schneider GitHub 仓库地址 | 代码仓库 |
| `BRANCH` | `master` | 部署分支 |
| `SERVICE_USER` | `wenbo` | systemd 运行用户 |
| `BACKEND_HOST` | `127.0.0.1` | 后端监听地址 |
| `BACKEND_PORT` | `8000` | 后端监听端口 |
| `NGINX_SITE` | `action-learning` | Nginx site 名称 |

### LLM 环境变量

AI 结构化输入默认使用 Qwen OpenAI-compatible API。推荐在 systemd 服务环境中配置：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `QWEN_API_KEY` | 无 | 系统默认 Qwen API key，未配置时用户仍可手动录入或在页面设置中临时覆盖 |
| `QWEN_MODEL` | `qwen3.6-plus` | 默认模型 |
| `QWEN_BASE_URL` | DashScope OpenAI-compatible endpoint | 兼容接口地址 |

API key 不写入 SQLite。页面右上角“设置”只保存当前浏览器的临时覆盖配置。

部署模板会读取可选环境文件 `/etc/action-learning.env`。可用以下方式配置：

```bash
sudo tee /etc/action-learning.env >/dev/null <<'EOF'
QWEN_API_KEY=sk-...
QWEN_MODEL=qwen3.6-plus
EOF
sudo systemctl restart action-learning
```

### 部署后验证

```bash
curl http://127.0.0.1:8000/api/v1/health
systemctl status action-learning
nginx -t
```

团队访问：

- 平台入口：`http://[服务器IP]/`
- API 文档：`http://[服务器IP]/docs`

### 手动部署流程

```bash
cd /opt/action_learning/backend
uv sync

cd /opt/action_learning/frontend
npm install
npm run build

sudo cp /opt/action_learning/deploy/action-learning.service /etc/systemd/system/action-learning.service
sudo systemctl daemon-reload
sudo systemctl enable action-learning
sudo systemctl restart action-learning

sudo cp /opt/action_learning/deploy/nginx.conf /etc/nginx/sites-available/action-learning
sudo ln -sfn /etc/nginx/sites-available/action-learning /etc/nginx/sites-enabled/action-learning
sudo nginx -t
sudo systemctl reload nginx
```

## Windows 服务器备选方案

Windows 服务器可先用开发式部署：

1. 安装 uv + Node.js 18+
2. `.\scripts\dev.ps1 -BackendPort 8000 -FrontendPort 5173`
3. 通过防火墙开放前端端口

长期运行建议后续再补 Windows Service 或 IIS/Nginx for Windows 配置。

---
*Created: 2026-04-24 — Phase 1 计划阶段*
