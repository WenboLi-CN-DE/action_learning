#!/usr/bin/env bash
set -euo pipefail

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"

usage() {
  cat <<'EOF'
Usage: scripts/dev.sh [options]

Options:
  --backend-port PORT   Backend port, default 8000
  --frontend-port PORT  Frontend port, default 5173
  --backend-host HOST   Backend host, default 127.0.0.1
  -h, --help            Show help

Environment variables are also supported:
  BACKEND_PORT=8001 FRONTEND_PORT=5174 scripts/dev.sh
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --backend-port)
      BACKEND_PORT="$2"
      shift 2
      ;;
    --frontend-port)
      FRONTEND_PORT="$2"
      shift 2
      ;;
    --backend-host)
      BACKEND_HOST="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "未知参数：$1"
      usage
      exit 1
      ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
FRONTEND_DIR="${ROOT_DIR}/frontend"
API_TARGET="http://${BACKEND_HOST}:${BACKEND_PORT}"

check_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "未找到命令：$1。请先安装后再运行本脚本。"
    exit 1
  fi
}

cleanup() {
  echo ""
  echo "停止开发服务..."
  if [ -n "${BACKEND_PID:-}" ]; then
    kill "${BACKEND_PID}" 2>/dev/null || true
  fi
  if [ -n "${FRONTEND_PID:-}" ]; then
    kill "${FRONTEND_PID}" 2>/dev/null || true
  fi
}

trap cleanup INT TERM EXIT

check_command uv
check_command npm

echo "同步后端依赖..."
cd "${BACKEND_DIR}"
uv sync

echo "安装前端依赖..."
cd "${FRONTEND_DIR}"
npm install

echo "启动后端: ${API_TARGET}"
cd "${BACKEND_DIR}"
uv run uvicorn app.main:app --reload --host "${BACKEND_HOST}" --port "${BACKEND_PORT}" &
BACKEND_PID="$!"

echo "启动前端: http://127.0.0.1:${FRONTEND_PORT}"
cd "${FRONTEND_DIR}"
VITE_API_TARGET="${API_TARGET}" npm run dev -- --host 127.0.0.1 --port "${FRONTEND_PORT}" &
FRONTEND_PID="$!"

echo ""
echo "AI工坊平台开发环境已启动"
echo "前端: http://127.0.0.1:${FRONTEND_PORT}"
echo "后端: ${API_TARGET}/docs"
echo ""
echo "按 Ctrl+C 停止。"

wait
