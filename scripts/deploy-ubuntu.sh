#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/action_learning}"
REPO_URL="${REPO_URL:-https://github.schneider-electric.com/SESA783337/action_learning.git}"
BRANCH="${BRANCH:-master}"
SERVICE_USER="${SERVICE_USER:-wenbo}"
BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
NGINX_SITE="${NGINX_SITE:-action-learning}"

if ! command -v git >/dev/null 2>&1; then
  echo "缺少 git，请先安装。"
  exit 1
fi

if ! command -v uv >/dev/null 2>&1; then
  echo "缺少 uv，请先安装：https://docs.astral.sh/uv/getting-started/installation/"
  exit 1
fi
UV_BIN="$(command -v uv)"

if ! command -v npm >/dev/null 2>&1; then
  echo "缺少 npm / Node.js，请先安装 Node.js 18+。"
  exit 1
fi

if ! command -v nginx >/dev/null 2>&1; then
  echo "缺少 nginx，请先安装。"
  exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "请用 root 或 sudo 运行本脚本。"
  exit 1
fi

if ! id "${SERVICE_USER}" >/dev/null 2>&1; then
  echo "systemd 运行用户不存在：${SERVICE_USER}"
  exit 1
fi

echo "部署目录: ${APP_DIR}"
mkdir -p "$(dirname "${APP_DIR}")"

if [ -d "${APP_DIR}/.git" ]; then
  echo "更新代码..."
  git -C "${APP_DIR}" -c http.proxy="" -c https.proxy="" fetch origin "${BRANCH}"
  git -C "${APP_DIR}" checkout "${BRANCH}"
  git -C "${APP_DIR}" -c http.proxy="" -c https.proxy="" pull --ff-only origin "${BRANCH}"
else
  echo "克隆代码..."
  git -c http.proxy="" -c https.proxy="" clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
fi

echo "同步后端依赖..."
cd "${APP_DIR}/backend"
uv sync

echo "构建前端..."
cd "${APP_DIR}/frontend"
npm install
npm run build

echo "修正部署目录权限..."
chown -R "${SERVICE_USER}:${SERVICE_USER}" "${APP_DIR}"

echo "安装 systemd 服务..."
sed \
  -e "s|User=wenbo|User=${SERVICE_USER}|g" \
  -e "s|WorkingDirectory=/opt/action_learning/backend|WorkingDirectory=${APP_DIR}/backend|g" \
  -e "s|/usr/bin/env uv|${UV_BIN}|g" \
  -e "s|--host 127.0.0.1 --port 8000|--host ${BACKEND_HOST} --port ${BACKEND_PORT}|g" \
  "${APP_DIR}/deploy/action-learning.service" > /etc/systemd/system/action-learning.service

systemctl daemon-reload
systemctl enable action-learning
systemctl restart action-learning

echo "安装 Nginx 配置..."
sed \
  -e "s|root /opt/action_learning/frontend/dist;|root ${APP_DIR}/frontend/dist;|g" \
  -e "s|proxy_pass http://127.0.0.1:8000;|proxy_pass http://${BACKEND_HOST}:${BACKEND_PORT};|g" \
  "${APP_DIR}/deploy/nginx.conf" > "/etc/nginx/sites-available/${NGINX_SITE}"

ln -sfn "/etc/nginx/sites-available/${NGINX_SITE}" "/etc/nginx/sites-enabled/${NGINX_SITE}"
nginx -t
systemctl reload nginx

echo "验证后端健康检查..."
curl -fsS "http://${BACKEND_HOST}:${BACKEND_PORT}/api/v1/health"
echo ""

echo "部署完成。"
echo "前端入口: http://<服务器IP>/"
echo "后端健康检查: http://<服务器IP>/api/v1/health"
echo "后端文档: http://<服务器IP>/docs"
