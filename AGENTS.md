# 全局 Agent 配置

## 语言设置
- 默认使用中文进行对话
- 代码注释和文档优先使用中文
- 技术术语保持英文原文

## 项目概述

AI 工坊平台是行动学习课题产物，现已从“前后端信息展示工具”演进为客户需求—技术能力协同治理平台。

平台位于客户机会与技术能力之间：

1. 销售/咨询把客户信号整理为可审核、可追踪的需求；
2. 研发维护可发现、可复用的技术能力，并判断技术覆盖；
3. 管理员负责审核责任分配、需求—能力关联编排、最终审核和知识治理；
4. AI 辅助结构化输入、图片识别、候选匹配和知识问答，但不自动批准业务结论。

核心价值：让真实客户需求与可复用技术能力双向透明，并通过明确责任、分级审核和证据留痕，把“看得见”升级为“可信地关联和决策”。

团队业务角色覆盖销售、咨询、研发、技术支持和解决方案工程师；当前产品入口归并为销售/咨询、研发、管理员三种工作身份。

## 当前能力基线

截至 2026-07-29，v2.1 试运行闭环已经在当前代码中完成；生产环境当前仍运行已部署的 v2.0，待后续明确提交和部署：

- **角色工作台**：浏览器选择并记忆销售/咨询、研发或管理员身份，可随时切换；
- **需求与能力池**：结构化录入、编辑、标签筛选、详情和评论；
- **需求治理**：提交人留痕、审核责任人指派、状态机、审核意见和历史；
- **关联治理**：人工/AI 候选关联，研发技术确认，管理员最终审核；
- **职责分离**：禁止提交人审核自己的需求、禁止关联创建人自审、技术确认人与终审人分离；
- **AI 输入**：自然语言结构化需求/能力，支持 PNG、JPG/JPEG、WEBP 图片识别；
- **AI 匹配**：输出评分、覆盖结论、理由、缺口和维度评分，人工审核后才生效；
- **知识库**：TXT/Markdown/CSV 导入、RAG 检索、引用问答、文档删除和索引重建；
- **全局助手**：多轮问答，销售可将对话转为需求草稿；
- **管理看板**：需求、能力、关联、覆盖率及行业/业务线筛选；
- **个人待办**：按当前身份聚合待补充、待指派、待审核、待关联、待技术确认和待终审事项；
- **SLA 风险**：需求审核 48 小时、关联编排 72 小时、技术确认 72 小时、终审 48 小时，按进入当前业务阶段的审核事件计时，显示即将到期和逾期；
- **数据质量**：对需求和能力评分，列出缺少联系人、提交人、标签、有效描述等问题；
- **AI 评测**：基于人工审核结论统计候选数量、采纳率、平均分和高频能力缺口；
- **试运行指标**：审核人覆盖率、候选覆盖率、平均审核周期、平均匹配周期和低质量数据清单；
- **生产运行**：阿里云 Nginx + systemd + SQLite，入口 `http://8.152.171.142/`。

最新质量基线：

- 后端 62 项测试通过；
- 前端 9 项测试通过；
- ESLint、TypeScript 和 Vite 生产构建通过；
- 生产首页和 `/api/v1/health` 返回 HTTP 200。

## 角色职责与业务边界

| 角色 | 主工作区 | 可以执行 | 不应执行 |
|------|----------|----------|----------|
| 销售 / 咨询 | 需求池 | 新建/编辑需求，查看审核和匹配进展 | 维护能力、终审关联 |
| 研发 | 能力池 | 新建/编辑能力，评估需求，技术确认关联 | 代替销售定义需求、最终审核自己的技术判断 |
| 管理员 | 管理审核 | 指派审核人、审核需求、建立关联、最终审核、管理知识库 | 代替销售新建需求、代替研发新建能力 |

当前身份和姓名/团队仅保存在浏览器，用于工作台分流和界面级操作控制，不是登录认证、SSO 或后端 RBAC 安全边界。

### 核心业务不变量

- 新需求必须有提交人和有效业务描述；
- 历史数据缺少提交人等字段时如实提示，不伪造信息；
- 需求状态只能通过审核流程转换，普通编辑接口不能绕过；
- 提交人不能审核自己提交的需求；
- 只有被指派的责任人才能完成对应需求审核；
- 人工和 AI 关联都先经过研发技术确认，再由管理员终审；
- 关联创建人不能自审，技术确认人不能执行最终审核；
- 驳回必须填写意见；
- AI 只提供建议，不自动形成正式业务结论。

## 已验证的业务价值

- **打破信息孤岛**：销售看到能力供给，研发更早看到真实客户需求；
- **提高响应速度**：AI 检索、结构化输入和候选匹配减少反复询问；
- **提升数据质量**：必填校验、描述质量控制和审核责任减少无效需求；
- **建立治理责任**：提交人、责任人、实际审核人和意见均可追溯；
- **降低决策风险**：技术确认与管理终审分离，避免未经验证的销售承诺；
- **沉淀组织知识**：需求、能力、评论、审核依据和文档统一检索；
- **支持资源决策**：覆盖率和能力缺口帮助判断预研与建设优先级。

## 明确不再扩展的范围

根据 2026-07-29 产品决策，本项目以 v2.1 为最终功能范围，不继续建设此前设想的 v2.2/v2.3：

- 不接入企业 SSO、通讯录和真实后端 RBAC；
- 不对接 CRM、Jira/Confluence、Teams 等企业系统；
- 不迁移 PostgreSQL，不建设复杂 BI、移动端或实时通知体系；
- 不继续扩展新的产品模块，后续只允许修复缺陷、维护现有部署和补充试运行数据；
- FastAPI/Qdrant 弃用 API 与前端 bundle 拆包属于维护性技术债，不构成新版本范围。

## 技术栈

- **后端**: FastAPI + SQLModel + SQLite（MVP），使用 uv 管理环境和依赖
- **前端**: React 19 + Vite + TypeScript + Ant Design 6 + Zustand
- **环境管理**: uv（不用 pip/venv）
- **ORM**: SQLModel（合并 Pydantic schema + SQLAlchemy table model）
- **数据库**: SQLite（MVP）→ PostgreSQL（后续可迁移，Alembic 管理迁移）
- **AI**: Qwen OpenAI-compatible API
- **RAG**: Qdrant Client + FastEmbed，测试支持 memory backend
- **生产运行**: Nginx + systemd

### uv 命令速查
- `uv init` — 初始化项目
- `uv add <package>` — 添加依赖
- `uv run <script>` — 运行脚本
- `uv run python <file>` — 运行 Python 文件
- `uv sync` — 同步依赖到虚拟环境

### 前端命令速查
- `npm install` — 安装依赖
- `npm run dev` — 启动 Vite 开发服务器
- `npm test` — 运行前端测试
- `npm run lint` — 运行 ESLint
- `npm run build` — TypeScript 检查并生成生产构建

## 环境配置

### 阿里云部署目标
- **默认部署目标**: `aliyun-home-tunnel`
  - 公网 IP: `8.152.171.142`
  - SSH 用户: `root`
  - 连接命令: `ssh aliyun-home-tunnel`
  - Identity: `~/.ssh/id_ed25519_wenbo_pc`
- **服务器系统**: Ubuntu 24.04 LTS
- **部署目录**: `/opt/action_learning`
- **后端服务**:
  - systemd service: `action-learning`
  - 监听地址: `127.0.0.1:18000`
  - 启动方式: `uv run uvicorn app.main:app --host 127.0.0.1 --port 18000`
- **前端入口**:
  - Nginx 静态站点
  - 对外地址: `http://8.152.171.142/`
  - 内部备用监听: `0.0.0.0:18080`（如果阿里云安全组放通该端口，也可直接访问）
  - `/api/`、`/docs`、`/openapi.json` 反向代理到后端 `127.0.0.1:18000`
- **部署约束**:
  - 不要覆盖服务器 `/etc/action-learning.env`
  - 不要同步本地 `backend/.env`、`backend/database.db`、`backend/.venv`、`frontend/node_modules`、`frontend/dist`
  - `80` 端口由 Nginx 共享；本工程只作为 IP/default server，不要影响 `rednote.wenbo.space` 等已有域名站点
  - 不要占用服务器已有 `8000`、`8080`、`8081` 端口
  - Qwen/LLM 生产环境变量放在服务器 `/etc/action-learning.env`

### 跨平台开发环境

先根据当前实际 shell 选择命令，不要假设固定运行在 Windows。

- macOS / Linux：`./scripts/dev.sh`
- Windows PowerShell：`.\scripts\dev.ps1`

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

## 当前项目结构

```
action_learning/
├── backend/
│   ├── app/
│   │   ├── api/          # 需求、能力、审核、关联、AI、RAG、Chat、Pilot API
│   │   ├── rag/          # 检索、向量存储和数据同步
│   │   ├── models.py
│   │   └── main.py
│   ├── tests/
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── auth/         # 角色权限矩阵与本地身份
│   │   ├── components/   # 全局助手等组件
│   │   ├── pages/        # 角色入口、工作台、审核、知识检索
│   │   ├── services/
│   │   └── stores/
│   └── package.json
├── .planning/        # GSD 项目规划文档
├── deploy/           # systemd / Nginx 基础模板
├── scripts/          # 本地启动和 Ubuntu 部署脚本
├── docs/             # 部署、设计和历史计划
├── AGENTS.md
└── AI工坊平台设计.md
```

## 设计文档

事实来源按以下顺序维护：

1. `AGENTS.md`：当前工程规则、运行环境、业务不变量和能力基线；
2. `AI工坊平台设计.md`：产品定位、角色、流程、功能和业务价值主文档；
3. `.planning/REQUIREMENTS.md`：可追踪需求及完成状态；
4. `.planning/ROADMAP.md`：阶段交付与后续路线；
5. `.planning/STATE.md`：当前里程碑、风险和下一步。

设计或业务规则发生变化时，至少同步更新前两项；不要再引用未创建的历史培训子文档。

## 验证命令

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
