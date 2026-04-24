# AI工坊平台

## What This Is

AI工坊平台是一个打通公司前端（销售/咨询）和后端（研发/产品）的信息透明化平台。全团队成员可以在统一的汇总面板上查看后端预研项目状态、前端客户需求、两者匹配度以及团队协作记录，消除信息孤岛。平台数据内容按行业/业务线标签分类（数据中心、水处理、工业自动化等），让公司多条业务线的信息都能被有效汇总。

## Core Value

信息双向透明汇总——让前端能看到后端在做什么，让后端能看到客户需要什么，所有信息在统一面板上可见、可关联、可追溯。

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] 双向信息汇总面板：后端预研项目状态可视化 + 前端客户需求列表展示
- [ ] 需求匹配度：自动或手动关联客户需求与后端预研项目的覆盖情况
- [ ] 前端需求反馈通道：销售/咨询可以直接提交和跟踪客户需求
- [ ] 团队协作记录：前后端就某个需求/项目的沟通记录和决策存档
- [ ] 行业/业务线标签分类：数据中心、水处理、工业自动化等，让多条业务线信息有序汇总
- [ ] 全透明无权限区分：所有5个角色（销售、咨询、研发、技术支持、解决方案工程师）看到完全一样的信息

### Out of Scope

- 实时推送通知 — MVP阶段信息不需要即时推送，手动刷新查看即可
- 对接公司现有系统（CRM/项目管理工具） — MVP阶段以手动录入为主，但预留接口设计空间
- 公网部署 — 平台仅在公司内网使用
- 移动端App — Web优先
- 角色权限区分 — MVP阶段全透明，后续按需添加

## Context

- 公司管培生行动学习课题，团队角色覆盖：销售、咨询、研发、技术支持、解决方案工程师
- 公司业务多线并行（数据中心、水处理、工业自动化等），课题只能落实1-2条具体行动
- 技术栈已定：Python后端（uv管理）、React前端（Vite）
- Windows开发环境
- 初期数据量少（5-20个预研项目和需求）
- 信息更新以手动录入为主，不需要实时性

## Constraints

- **Tech Stack**: Python后端 + React前端 — AGENTS.md已明确约定
- **Environment**: uv管理Python环境（不用pip/venv） — 团队规范
- **Deployment**: 公司内网 — 安全要求
- **Team**: 管培生行动学习小组，非专职开发团队 — 人力和时间有限
- **Data Scale**: 初期少量数据（5-20条） — 不需要复杂的分页/筛选系统

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 全透明无权限区分 | MVP阶段追求极致透明，降低使用门槛 | — Pending |
| 手动录入为主 | 避免对接现有系统的复杂性，快速上线 | — Pending |
| 行业/业务线标签分类 | 覆盖公司多业务线信息，但标签维度仅用行业/业务线 | — Pending |
| Python + React 技术栈 | 团队熟悉度和技术生态考量 | Phase 1 验证通过 |
| Vite proxy + CORS | 开发环境前后端联调，生产环境同域消除CORS | Phase 1 验证通过 |
| SQLite 零运维 | MVP数据量极少，单文件数据库足够 | Phase 1 验证通过 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-24 after Phase 1 completion*