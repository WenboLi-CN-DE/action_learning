# Roadmap: AI工坊平台

## Overview

AI工坊平台从零开始，经历骨架搭建、核心数据录入与关联、可视化汇总、协作完善四个阶段，最终交付一个让前端（销售/咨询）和后端（研发/产品）信息双向透明的内部工具。项目是管培生行动学习课题，全透明无权限区分，数据量极少（5-20条），技术栈为 FastAPI + SQLModel + SQLite + React + Ant Design。

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: 项目骨架与环境验证** - 前后端联调空项目可运行，开发环境与部署验证完毕 *(Completed 2026-04-24)*
- [ ] **Phase 2: 核心数据录入与关联** - 用户可录入预研项目和客户需求，按标签分类，手动关联需求与项目
- [ ] **Phase 3: 匹配可视化与汇总面板** - 用户可在汇总面板查看关键统计和匹配覆盖率可视化
- [ ] **Phase 4: 协作记录与详情完善** - 用户可在详情页查看完整信息和关联列表，添加和查看评论

## Phase Details

### Phase 1: 项目骨架与环境验证
**Goal**: 前后端联调项目可运行，开发环境验证完毕，部署流程已确认
**Depends on**: Nothing (first phase)
**Requirements**: None (基础设施阶段，为后续所有需求开发扫清障碍)
**Success Criteria** (what must be TRUE):
  1. FastAPI 后端服务启动后返回健康检查响应（`/health` 返回 200）
  2. React 前端应用启动后可通过 Vite proxy 访问后端 API，无 CORS 错误
  3. 前后端联调 demo 页面可显示从后端获取的测试数据
  4. 内网部署验证流程已确认（服务器环境、部署方式已记录）
**Plans**: 2

Plans:
- [x] 01-01: 后端项目初始化（FastAPI + SQLModel + SQLite + uv）
- [x] 01-02: 前端项目初始化与前后端联调验证（React + Vite + Ant Design + proxy）

### Phase 2: 核心数据录入与关联
**Goal**: 用户可以录入预研项目和客户需求，按行业标签分类，手动关联需求与项目，在列表中查看所有数据
**Depends on**: Phase 1
**Requirements**: PROJ-01, PROJ-02, PROJ-03, REQM-01, REQM-02, TAG-01, TAG-02, MATCH-01, MATCH-02
**Success Criteria** (what must be TRUE):
  1. 用户可以创建和编辑预研项目（填写名称、描述、负责人、行业标签、状态）
  2. 销售/咨询可以提交客户需求（填写描述、客户信息、紧急程度、行业标签）
  3. 用户可以在项目列表查看所有预研项目及当前状态，在需求列表查看所有客户需求及状态
  4. 管理员可以定义行业/业务线标签，用户可以按标签筛选项目列表和需求列表
  5. 用户可以手动将需求关联到预研项目并标注覆盖状态（已覆盖/部分覆盖/未覆盖）
**Plans**: 3

Plans:
- [ ] 02-01: 数据模型与 CRUD API（4张核心表 + 3张关联表 + 6个API Router）
- [ ] 02-02: 前端录入与列表页面（项目表单/列表、需求表单/列表、标签管理）
- [ ] 02-03: 需求-项目关联功能（手动关联 + 覆盖状态标注 + 标签筛选）

### Phase 3: 匹配可视化与汇总面板
**Goal**: 用户可以在汇总面板查看关键统计和匹配覆盖率，按行业标签切换视图，直观看到信息双向透明的核心价值
**Depends on**: Phase 2
**Requirements**: MATCH-03, MATCH-04, DASH-01, DASH-02
**Success Criteria** (what must be TRUE):
  1. 用户可以在汇总面板上同时查看项目数量、需求数量、匹配覆盖率等关键统计
  2. 用户可以在汇总面板上快速切换行业/业务线视图，查看不同领域的数据
  3. 用户可以在匹配度面板查看整体匹配覆盖率统计（百分比、图表）
  4. 用户可以按行业/业务线查看特定领域的匹配覆盖率
**Plans**: 2

Plans:
- [ ] 03-01: 汇总面板页面（统计概览 + 行业/业务线视图切换）
- [ ] 03-02: 匹配度可视化面板（覆盖率统计 + 图表 + 按领域筛选）

**UI hint**: yes

### Phase 4: 协作记录与详情完善
**Goal**: 用户可以在项目/需求详情页查看完整信息和关联列表，添加和查看评论讨论，平台具备完整闭环
**Depends on**: Phase 2
**Requirements**: PROJ-04, REQM-03, COLLAB-01, COLLAB-02
**Success Criteria** (what must be TRUE):
  1. 用户可以在项目详情页查看完整信息（名称、描述、负责人、进度）和关联的需求列表
  2. 用户可以在需求详情页查看完整信息（描述、客户信息、紧急程度）和关联的项目列表
  3. 用户可以对项目或需求添加文字评论/讨论
  4. 用户可以查看项目或需求下的所有评论历史
**Plans**: 2

Plans:
- [ ] 04-01: 项目与需求详情页面（完整信息展示 + 关联列表）
- [ ] 04-02: 协作记录功能（评论添加 + 评论历史查看）

**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4
Phase 3 and Phase 4 both depend on Phase 2 but can be planned sequentially (3 before 4, since visualization delivers core value first).

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. 项目骨架与环境验证 | 2/2 | Complete | 2026-04-24 |
| 2. 核心数据录入与关联 | 0/3 | Not started | - |
| 3. 匹配可视化与汇总面板 | 0/2 | Not started | - |
| 4. 协作记录与详情完善 | 0/2 | Not started | - |

---
*Roadmap created: 2026-04-24*
*Granularity: coarse (3-5 phases)*