# 全局 Agent 配置

## 语言设置
- 默认使用中文进行对话
- 代码注释和文档优先使用中文
- 技术术语保持英文原文

## 项目概述

AI工坊平台 — 行动学习课题产物。目标是打通前端（销售/咨询）和后端（研发/产品）的信息透明化平台。

核心功能方向：
- 后端预研项目可见化，前端可查看客户需求匹配
- 前端需求反馈通道
- 信息汇总与透明化

团队角色覆盖：销售、咨询、研发、技术支持、解决方案工程师

## 技术栈

- **后端**: FastAPI + SQLModel + SQLite（MVP），使用 uv 管理环境和依赖
- **前端**: React + Vite + Ant Design + Zustand
- **环境管理**: uv（不用 pip/venv）
- **ORM**: SQLModel（合并 Pydantic schema + SQLAlchemy table model）
- **数据库**: SQLite（MVP）→ PostgreSQL（后续可迁移，Alembic 管理迁移）

### uv 命令速查
- `uv init` — 初始化项目
- `uv add <package>` — 添加依赖
- `uv run <script>` — 运行脚本
- `uv run python <file>` — 运行 Python 文件
- `uv sync` — 同步依赖到虚拟环境

### 前端命令速查
- `npm create vite@latest frontend -- --template react` — 初始化 React 项目（Vite）
- 或使用 `npx create-react-app frontend` — CRA 初始化

## 环境配置

### Windows PowerShell 环境
当前运行在 Windows 系统上，所有终端命令必须兼容 Windows PowerShell。

**关键差异对照：**
| Bash | PowerShell |
|------|-----------|
| `ls` | `Get-ChildItem` / `dir` |
| `cat` | `Get-Content` / `type` |
| `grep` | `Select-String` |
| `rm` | `Remove-Item` / `del` |
| `touch` | `New-Item` |
| `mkdir -p` | `New-Item -ItemType Directory` |
| `find` | `Get-ChildItem -Recurse` |

路径使用反斜杠 `\` 或正斜杠 `/`，含空格路径必须引号包裹。

## 代码规范

### 通用原则
- 编写最小化、精简代码
- 优先使用现有库而非重新实现
- 每段代码直接服务于解决方案

### Python
- 遵循 PEP 8 基本风格
- 类型标注用于公共 API
- 异步场景优先使用 async/await

### React
- 组件优先函数式 + Hooks
- 状态管理使用 Zustand
- UI 框架使用 Ant Design

## 项目结构（规划）

```
action_learning/
├── backend/          # Python 后端服务
│   ├── pyproject.toml
│   └── src/
├── frontend/         # React 前端应用
│   ├── package.json
│   └── src/
├── .planning/        # GSD 项目规划文档
│   ├── PROJECT.md
│   ├── config.json
│   ├── REQUIREMENTS.md
│   ├── ROADMAP.md
│   ├── STATE.md
│   └── research/
├── docs/             # 设计文档与会议记录
├── AGENTS.md
└── AI工坊平台设计.md
```

## 设计文档

主要设计入口：`AI工坊平台设计.md`

该文档引用但尚未创建的子文档：
- `20250319西安培训/AI工坊学习小组公约.md`
- `20250319西安培训/沟通结果.md`
- `20250319西安培训/行动学习平台设计.md`

## git 配置

### 远程仓库
- **Origin**: `https://github.schneider-electric.com/SESA783337/action_learning.git`

### Proxy 规则
- **Schneider 内部地址**（`github.schneider-electric.com`）：**禁止使用任何 proxy**
  - git 推送/拉取时必须使用 `git -c http.proxy="" -c https.proxy=""` 或确保环境变量中无 proxy
  - 系统环境变量 `HTTP_PROXY` / `HTTPS_PROXY` 对 Schneider 地址无效，需显式覆盖
- **其他项目**：设置 `http.proxy http://10.190.254.21:80`

### 推送命令参考
```bash
# 推送到 Schneider GitHub（必须禁用 proxy）
git -c http.proxy="" -c https.proxy="" push origin master
```

## PPT / 演示文稿规范

### 公司品牌模板（默认）
当用户使用 `/html-ppt` skill 或要求制作 PPT/幻灯片/演讲稿时，**默认使用公司品牌模板**：

- **主题**: `advancing-energy`（施耐德 Advancing Energy Tech 品牌色）
- **Layout 前缀**: `ae-` 开头的模板优先（`ae-cover`, `ae-toc`, `ae-content`, `ae-section`, `ae-thanks`）
- **品牌色**: 主色 `#0A2F24`（深绿）、辅色 `#3DCD58`（亮绿）、背景 `#FAFAFA`
- **字体**: Poppins + 微软雅黑 + Noto Sans SC
- **位置**: `.agents/skills/html-ppt/assets/themes/advancing-energy.css`

除非用户明确要求其他风格（如"小红书风"、"赛博朋克"），否则一律使用公司模板。

## 工作流程

1. 理解需求 → 明确意图
2. 规划方案 → 选择最优路径
3. 分步实施 → 小步快跑
4. 验证结果 → 确保质量