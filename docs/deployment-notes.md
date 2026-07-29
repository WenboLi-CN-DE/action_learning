# AI 工坊生产部署与验证

## 当前生产基线

| 项目 | 当前值 |
|------|--------|
| 云主机 | 阿里云 Ubuntu 24.04 LTS |
| SSH 别名 | `aliyun-home-tunnel` |
| 公网地址 | `8.152.171.142` |
| 平台入口 | <http://8.152.171.142/> |
| 部署目录 | `/opt/action_learning` |
| 后端服务 | `action-learning` |
| 服务用户 | `actionlearning` |
| 后端监听 | `127.0.0.1:18000` |
| 前端 | Nginx 静态文件 |
| 内部备用监听 | `0.0.0.0:18080` |
| 环境配置 | `/etc/action-learning.env` |
| 数据库 | `/opt/action_learning/backend/database.db` |

生产环境已经部署并通过健康检查。本文件记录现状和安全边界，不再使用早期“待确认内网服务器”的假设。

## 网络与站点边界

服务器的 80 端口由 Nginx 共享。本项目只使用 IP/default server 入口，部署时必须满足：

- 不修改系统代理、WireGuard、路由、DNS 或 SSH 配置；
- 不占用服务器已有的 `8000`、`8080`、`8081` 端口；
- 不改变 `rednote.wenbo.space` 等已有域名站点；
- 后端只监听 `127.0.0.1:18000`，不直接暴露公网；
- 修改 Nginx 前先备份和执行 `nginx -t`；
- 只 reload Nginx，不做无必要的整机或网络服务重启。

## 连接前检查

部署前使用现有 SSH 别名，不硬编码密码或修改密钥：

```bash
ssh -G aliyun-home-tunnel | sed -n \
  -e 's/^hostname /hostname /p' \
  -e 's/^user /user /p' \
  -e 's/^identityfile /identityfile /p' \
  -e 's/^proxyjump /proxyjump /p'
```

然后只读检查远端：

```bash
ssh aliyun-home-tunnel '
  uname -a
  systemctl is-active action-learning nginx
  ss -lntp
  nginx -T >/tmp/action-learning-nginx-check.txt 2>&1
  test -d /opt/action_learning
'
```

不得在检查阶段更改网络配置。

## 部署保护清单

以下内容不允许被本地同步覆盖：

- `/etc/action-learning.env`
- `/opt/action_learning/backend/database.db`
- `/opt/action_learning/backend/.env`
- `/opt/action_learning/backend/.venv`
- `/opt/action_learning/frontend/node_modules`
- 本地构建目录和临时文件
- Nginx 中与其他站点相关的配置

前端发布时保留服务器已有的 `.well-known` 等运维目录。

每次部署前应创建带日期和 commit SHA 的备份目录：

```text
/opt/action_learning-backups/<YYYYMMDD-HHMMSS>-<commit-sha>/
```

至少备份：

- 当前前端 `dist/`；
- 当前后端应用代码；
- `database.db`；
- 本项目 systemd unit；
- 本项目 Nginx 配置。

## 推荐发布流程

### 1. 本地验证

```bash
cd backend
uv run pytest
```

```bash
cd frontend
npm test
npm run lint
npm run build
```

### 2. 确认发布版本

```bash
git status --short
git rev-parse --short HEAD
git log -1 --oneline
```

发布应绑定明确 commit，避免把未提交文件直接混入生产。

### 3. 备份远端

先确认 `/opt/action_learning` 和数据库文件，再创建精确目标的备份。不要使用指向宽泛目录的递归删除或覆盖命令。

### 4. 同步代码

可使用 Git 或受控的 `rsync`，但必须应用上述排除项。Schneider GitHub 拉取/推送时显式关闭 HTTP/HTTPS proxy；这只影响该次 Git 命令，不更改主机网络配置。

仓库中的 `scripts/deploy-ubuntu.sh`、`deploy/action-learning.service` 和 `deploy/nginx.conf` 是通用基础模板，默认用户/端口与当前生产值不同。不得在生产上无参数直接执行并覆盖现有配置；当前生产应使用：

```text
SERVICE_USER=actionlearning
BACKEND_HOST=127.0.0.1
BACKEND_PORT=18000
APP_DIR=/opt/action_learning
```

共享 Nginx 环境仍需人工核对生成结果。

### 5. 安装依赖与构建

```bash
cd /opt/action_learning/backend
uv sync

cd /opt/action_learning/frontend
npm install
npm run build
```

### 6. 重启应用

```bash
systemctl daemon-reload
systemctl restart action-learning
systemctl is-active action-learning
```

只有本项目 Nginx 配置确实变化时才执行：

```bash
nginx -t
systemctl reload nginx
```

## AI / RAG 环境

生产环境变量放在 `/etc/action-learning.env`，部署不得覆盖或在日志中打印密钥。主要变量包括：

- `QWEN_API_KEY`
- `QWEN_MODEL`
- `QWEN_BASE_URL`
- `RAG_BACKEND`
- `RAG_QDRANT_URL`
- `RAG_QDRANT_API_KEY`
- `RAG_COLLECTION_NAME`

浏览器中的 LLM 设置只是当前浏览器的临时覆盖，不代替生产配置。

## 发布后验证

### 服务和端口

```bash
ssh aliyun-home-tunnel '
  systemctl is-active action-learning nginx
  curl -fsS http://127.0.0.1:18000/api/v1/health
  nginx -t
  ss -lntp
'
```

### 外部入口

```bash
curl --noproxy "*" -fsS http://8.152.171.142/api/v1/health
curl --noproxy "*" -I http://8.152.171.142/
```

### 业务冒烟

- 身份选择页能显示三个角色；
- 销售工作台能新建需求并看到审核状态；
- 研发工作台能看到能力池和技术确认入口；
- 管理员工作台能看到审核队列、指派入口和终审；
- 知识检索能返回引用或明确的空知识库提示；
- 页面刷新后路由和浏览器身份正常。

## 回滚原则

若健康检查、前端入口或业务冒烟失败：

1. 停止继续变更；
2. 根据部署前备份恢复应用代码和前端 `dist/`；
3. 仅在数据库确实发生不兼容变更时恢复数据库；
4. 恢复本项目 systemd/Nginx 配置；
5. 执行 `nginx -t` 后 reload；
6. 重新验证服务、端口和共享站点。

不要通过修改网络、代理或跳板机配置来规避应用部署问题。

---

最后核对：2026-07-28
