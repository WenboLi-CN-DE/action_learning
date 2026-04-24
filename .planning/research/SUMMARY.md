# AI工坊平台 项目研究总结

**Project:** AI工坊平台（企业信息透明化平台）
**Domain:** 企业内部协作/信息透明化平台（管培生行动学习课题）
**Researched:** 2026-04-24
**Confidence:** MEDIUM-HIGH

## Executive Summary

AI工坊平台是一个打通公司前端（销售/咨询）与后端（研发/产品）的信息透明化内部工具，属于管培生行动学习课题而非商业产品。这类平台的成功关键是**数据录入体验**和**信息关联可视化**——让录入者有直接好处（而非只服务信息消费者），让需求和项目的关联不再是两条平行线。

推荐采用**单体三层架构**（React SPA + FastAPI + SQLite），这是小型内部工具的业界标准做法。前后端通过 Vite proxy 开发联调，生产环境用 Nginx 反向代理，SQLite 单文件零运维部署。技术栈选型（FastAPI/SQLModel/Ant Design/Zustand）全部围绕"最少代码量实现最大功能"原则，因为管培生团队时间有限、非专职开发。

**最关键的风险是数据录入负担杀死采用率**——如果录入者觉得录入是纯成本无收益，平台会迅速变成空壳。其次是**scope creep**——管培生团队没有专职PM，5个角色都会加需求。预防策略：每条录入<2分钟、每Phase锁定scope不超过5条Must-have、指定scope守门人。

## Key Findings

### Recommended Stack

选择围绕"管培生团队 + 小数据量 + 内网部署"三个约束优化，全部选最简实现路径：

**Core technologies:**
- **FastAPI** (0.115+): Web API 框架 — 自动OpenAPI文档、类型驱动、async支持、DI系统；FastAPI官方模板标准
- **SQLModel** (0.0.22+): ORM+数据模型 — 合并Pydantic schema+SQLAlchemy table，消除双份维护；FastAPI官方模板使用
- **SQLite**: MVP 数据库 — 5-20条数据零运维零部署，后期改URL即可迁移PostgreSQL
- **Ant Design** (5.x): UI组件库 — 企业中后台首选，Table组件功能强大，内置中文本地化`zh_CN`
- **Zustand** (5.x): 全局状态管理 — ~1KB轻量，hook-based无boilerplate，2025-2026 React生态事实标准
- **Vite** (7+): 构建工具 — HMR极速，proxy配置消除CORS，React+FastAPI联调标配
- **uv**: 环境管理 — AGENTS.md已约定，10-100x比pip快，lockfile保证可复现

> 详细技术选型 rationale 和 alternatives 见 [STACK.md](./STACK.md)

### Expected Features

**Must have (table stakes) — Phase 1:**
- **项目状态可视化面板** — 核心承诺，无此平台无意义
- **客户需求提交表单** — 信息流另一端必须可录入
- **行业/业务线标签分类** — 多业务线场景的基础组织维度
- **需求-项目手动关联** — 双向透明的实质（手动关联即可，不做自动匹配）
- **全透明同视图展示** — 数据层无权限区分，最简实现
- **基础搜索** — SQLite FTS5足够，低成本体验关键
- **操作人/时间戳** — 可追溯最低要求

**Should have (competitive) — Phase 1增值同步:**
- **标签过滤视图** — 低复杂度，解决"全透明信息过载"
- **变更高亮标记** — 低成本替代推送通知，解决"什么变了"

**Phase 2 增值:**
- **匹配度可视化** — 关联可量化（覆盖3个需求/匹配2个项目）
- **评论/协作记录** — 决策存档和沟通记录（结构化备注，不做聊天系统）
- **数据导出** — 管培生成果展示需要

**明确推迟 (v2+):**
- 实时推送通知、RBAC权限、CRM对接、AI自动匹配、移动端App、社交化功能、工作流自动化、全文知识库

> 详细feature依赖链和竞品参考见 [FEATURES.md](./FEATURES.md)

### Architecture Approach

**单体三层架构**（Three-Layer Monolith）：浏览器 → React SPA → FastAPI REST API → SQLite。数据量5-20条、内网单机部署、管培生团队——微服务拆分是过度工程。

**Major components:**
1. **前端层** — React SPA + Ant Design + Zustand，6个页面（Dashboard/Projects/Demands/Matching/Collaborations/Feedback），统一API service层
2. **后端层** — FastAPI单体应用，按领域分组6个APIRouter（projects/demands/tags/collaborations/matching/dashboard），CRUD层+聚合查询层分离
3. **数据存储层** — SQLite单文件数据库，SQLModel定义4张核心表+3张关联表（DemandProjectLink/DemandTagLink/ProjectTagLink）

**Key patterns:**
- SQLModel Base/Create/Public/Update四层继承模式（消除Pydantic+SQLAlchemy双份定义）
- FastAPI Depends(get_session)依赖注入获取数据库session
- Vite proxy `/api` 开发代理消除CORS
- 前端统一API service层（组件不直接fetch）
- 多对多关联用显式Link Model + Relationship

> 详细数据模型、API端点、代码示例见 [ARCHITECTURE.md](./ARCHITECTURE.md)

### Critical Pitfalls

1. **数据录入负担杀死采用率** — 为每个录入者设计直接好处，单条录入<2分钟，Phase 1必须验证5条数据10分钟可完成
2. **"全透明"误解为"单一界面"** — 数据层全透明✓，视图层角色化✓，MVP至少做2个角色视图（前端视角：需求→匹配项目；后端视角：项目→匹配需求）
3. **数据模型过度设计** — 4张核心表+3张关联表即可，不做状态流转枚举/10+张表/User表/完整审计日志
4. **Scope Creep（管培生特有）** — 指定scope守门人，每Phase Must-have不超过5条，2周开发周期做不完=scope太大
5. **Windows开发+内网部署环境差异** — Phase 0必须产出可运行前后端联调demo+内网部署验证；部署验证先于业务代码

> 全部15个pitfall和phase-specific warnings见 [PITFALLS.md](./PITFALLS.md)

## Implications for Roadmap

### Phase 0: 项目骨架与环境验证
**Rationale:** 前后端联调+CORS+部署验证是Phase 0的必要产出。如果骨架跑不起来，后续所有业务代码都无法开发。Windows+内网部署的隐性复杂度必须在第一天解决，而不是"到时候再说"。
**Delivers:** 可运行的前后端联调空项目 + uv/依赖规范 + 内网部署验证流程 + scope守门人指定
**Avoids:** Pitfall 5（Windows环境复杂度）、Pitfall 8（CORS陷阱）、Pitfall 9（uv混淆）、Pitfall 4（scope creep起始）
**Uses:** FastAPI + Vite + uv + SQLite基础配置

### Phase 1: 核心数据层 + 基础录入
**Rationale:** 数据模型是所有功能的地基。先验证全链路（database → model → CRUD → router → API），用最简单的Tag实体打通链路后再做Project/Demand。录入体验必须在此Phase验证——如果录入流程>2分钟/条，需要立即简化。
**Delivers:** 4张核心表（Project/Demand/Tag/DemandProjectLink） + 6个CRUD API端点 + 标签系统 + 需求提交表单 + 项目状态面板 + 手动关联功能 + 基础搜索 + 操作人/时间戳 + 变更高亮标记
**Addresses:** 所有7条Table Stakes + 2条Phase 1增值feature
**Avoids:** Pitfall 1（录入负担）、Pitfall 3（模型过度设计）、Pitfall 6（自动匹配算法）、Pitfall 7（无数据新鲜度）、Pitfall 10（无变更追溯）
**Uses:** SQLModel + SQLite + Alembic + Ant Design Table/Form + Zustand stores

### Phase 2: 角色视图 + 匹配可视化 + 过滤增强
**Rationale:** Phase 1的数据层全透明✓，但需要Phase 2的视图层角色化。前端角色视角（需求→匹配项目）和后端角色视角（项目→匹配需求）是"双向透明"的完整实现。匹配度可视化让关联可量化。
**Delivers:** 2个角色视图 + 匹配度可视化（覆盖数/匹配数） + 标签过滤视图增强 + 数据新鲜度显示（"最后更新于X天前"） + 变更信息展示
**Addresses:** Differentiator features — 匹配度可视化、标签过滤、数据新鲜度
**Avoids:** Pitfall 2（全透明=单一界面）、Pitfall 7（无新鲜度显示）

### Phase 3: 协作记录 + 数据导出 + 汇报优化
**Rationale:** 协作记录是增值层但不是MVP必须——挂在Project/Demand实体上的结构化备注即可。数据导出是管培生课题汇报的刚需。此Phase完成后平台具备完整闭环。
**Delivers:** 协作记录（结构化备注，不做聊天） + CSV数据导出 + 课题汇报视图优化
**Avoids:** Pitfall 11（把课题当产品做）—— 此Phase的核心产出是可汇报的demo，不是生产级交付

### Phase Ordering Rationale

- **Phase 0 → Phase 1 硬依赖**：没有可运行骨架就无法开发业务功能；没有部署验证就无法让团队访问
- **数据层先于API层先于前端层**：这是ARCHITECTURE.md中的Build Order原则——models → CRUD → routers → 前端页面
- **Phase 1用Tag打通全链路**：Tag是最简单实体，用它验证架构可行后再做Project/Demand
- **角色视图放在Phase 2而非Phase 1**：Phase 1先保证数据可录入、可查看；Phase 2再优化不同角色的信息入口
- **协作记录推迟到Phase 3**：依赖基础实体和关联，但不是MVP核心流程（销售录需求→手动关联→查看匹配）

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (角色视图):** 需要研究角色化视图的UI设计模式——全透明+角色化筛选的交互设计，目前基于推理而非直接案例
- **Phase 0 (内网部署):** 需要确认内网服务器环境（操作系统/配置/网络策略），目前未知

Phases with standard patterns (skip research-phase):
- **Phase 0 (项目骨架):** FastAPI+Vite+SQLite初始化，Context7+官方模板验证，文档充分
- **Phase 1 (数据层+CRUD):** SQLModel Base/Create/Public/Update模式和CRUD，Context7官方教程+fastapi/full-stack-fastapi-template验证
- **Phase 3 (协作记录+导出):** Ant Design Comment组件+CSV导出，标准模式无需额外研究

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Context7官方文档+GitHub开源模板+多源交叉验证；SQLModel maturity较低(0.0.x)但MVP数据模型简单，胜任 |
| Features | MEDIUM | 竞品分析+生态调研充分，但本项目是管培生课题而非商业产品，部分商业feature需裁剪；最核心的风险（录入负担）基于推理而非直接案例 |
| Architecture | HIGH | Context7官方文档+fastapi/full-stack-fastapi-template验证+GitHub代码搜索验证；单体三层是小型内部工具的标准模式 |
| Pitfalls | MEDIUM | 数据录入陷阱和Windows部署陷阱有HIGH confidence多源验证；全透明vs单一界面混淆和scope creep基于推理，无管培生开发项目直接案例 |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **内网服务器环境未知:** Phase 0需要确认服务器OS/配置/网络策略，决定Docker部署还是直接部署方案。建议Phase 0第一步就是调查内网环境。
- **角色视图设计模式:** "数据层全透明+视图层角色化"在内部工具领域缺乏直接案例参考。Phase 2 planning时需要做交互原型验证。
- **SQLModel 0.0.x maturity:** SQLModel版本较低，复杂查询场景可能需要退回SQLAlchemy。MVP数据模型简单（4表+3关联表）风险可控，但需在Phase 1留出退回预案。
- **管培生团队实际执行力:** 所有时间估算基于"管培生本职80%+项目20%"的约束，实际可用时间可能更少。Phase 0应确认团队实际可用开发时间。

## Sources

### Primary (HIGH confidence)
- Context7 `/fastapi/fastapi` — Pydantic模型、路由结构、依赖注入模式
- Context7 `/websites/sqlmodel_tiangolo` — 多对多Relationship、Base/Create/Public/Update模式、FastAPI集成
- Context7 `/vitejs/vite` — server proxy配置、React项目设置
- fastapi/full-stack-fastapi-template (GitHub) — 项目结构、模型分层、CRUD模式
- FastAPI/SQLModel/Vite/Ant Design/Zustand 官方文档

### Secondary (MEDIUM confidence)
- Exa WebSearch — 企业信息透明化平台架构、FastAPI+React+SQLite小型工具模式
- GitHub代码搜索 — SQLModel多对多模型实际用法、full-stack项目栈参考
- Productboard/Aha!/Mythrilite/Arkweaver/Aligni — 商业PM平台feature谱系参考（裁剪后适用）
- HBR "Transparency Trap"、Steven Brough — 透明度设计研究

### Tertiary (LOW confidence)
- Mythrilite/Arkweaver — 新兴平台，工程-业务映射思路可借鉴但无成熟案例
- 管培生行动学习课题定位 — 无直接案例数据，基于推理
- Paradigm Red "Trust Illusion" — 强制透明的信任悖论研究

---
*Research completed: 2026-04-24*
*Ready for roadmap: yes*