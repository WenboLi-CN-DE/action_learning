# Requirements: AI工坊平台

**Defined:** 2026-04-24
**Core Value:** 信息双向透明汇总——让前端能看到后端在做什么，让后端能看到客户需要什么，所有信息在统一面板上可见、可关联、可追溯。

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### 项目管理

- [x] **PROJ-01**: 用户可以创建预研项目（名称、描述、负责人、行业标签、状态）
- [x] **PROJ-02**: 用户可以编辑预研项目信息（更新描述、状态、进度等）
- [x] **PROJ-03**: 用户可以在项目状态面板查看所有预研项目列表及当前状态（预研/进行中/已完成/搁置）
- [x] **PROJ-04**: 用户可以在项目详情页查看项目名称、描述、负责人、进度、关联的需求列表

### 需求管理

- [x] **REQM-01**: 用户（销售/咨询）可以提交客户需求（需求描述、客户信息、紧急程度、行业标签）
- [x] **REQM-02**: 用户可以在需求列表查看所有客户需求及状态（待评估/已评估/已匹配/已搁置）
- [x] **REQM-03**: 用户可以在需求详情页查看需求描述、客户信息、紧急程度、关联的项目列表

### 需求-项目匹配

- [x] **MATCH-01**: 用户可以手动将需求关联到预研项目
- [x] **MATCH-02**: 用户可以为每个关联标注覆盖状态（已覆盖/部分覆盖/未覆盖）
- [x] **MATCH-03**: 用户可以在匹配度可视化面板查看整体匹配覆盖率统计（百分比、图表）
- [x] **MATCH-04**: 用户可以按行业/业务线查看该领域的匹配覆盖率

### 标签分类

- [x] **TAG-01**: 系统管理员可以定义行业/业务线标签（数据中心、水处理、工业自动化等）
- [x] **TAG-02**: 用户可以按行业/业务线标签筛选项目列表和需求列表

### 协作记录

- [x] **COLLAB-01**: 用户可以对项目或需求添加文字评论/讨论
- [x] **COLLAB-02**: 用户可以查看项目或需求下的所有评论历史

### 汇总面板

- [x] **DASH-01**: 用户可以在汇总面板上同时查看项目数量、需求数量、匹配覆盖率等关键统计
- [x] **DASH-02**: 用户可以在汇总面板上快速切换行业/业务线视图

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### 增值功能

- **PROJ-ADV-01**: 项目进度条/时间线可视化
- **PROJ-ADV-02**: 项目变更高亮（标注最近更新的项目）
- **REQM-ADV-01**: 需求紧急度标注（高/中/低）——v1已有紧急度字段，v2增强为可视化标注
- **REQM-ADV-02**: 需求变更高亮
- **TAG-ADV-01**: 标签颜色标识
- **COLLAB-ADV-01**: 决策记录结构化
- **COLLAB-ADV-02**: @提及提醒

### 基础设施

- **INFRA-01**: 对接公司现有系统（CRM/项目管理工具）自动拉取数据
- **INFRA-02**: 实时推送通知（关键状态变更即时通知）
- **INFRA-03**: 用户认证系统（登录/角色管理）——v2.0 先以 ROLE-01 入口自选身份落地，真实认证仍延后
- **INFRA-04**: 角色权限区分（不同角色看到不同信息）——界面级部分由 ROLE-02/03/04 覆盖

## v2.0 平台化 Requirements

Defined 2026-07-27. 决策：角色为入口自选身份（无密码登录）；管理员为独立角色。
映射到 Phase 8-10（见 ROADMAP.md）。

### 角色与权限（入口自选身份）

- [x] **ROLE-01**: 用户进入平台先选择身份（销售/咨询、研发、管理员），无需密码，身份保存在本地（Zustand + localStorage）
- [x] **ROLE-02**: 销售/咨询以需求池为主视图，可创建和编辑需求；能力池只读
- [x] **ROLE-03**: 研发以能力池为主视图，可维护能力（预研项目）；需求池只读，但可评估需求并确认匹配
- [x] **ROLE-04**: 管理员为独立角色，可访问全部视图并执行审核操作
- [x] **ROLE-05**: 界面操作按角色显隐（界面级权限，非安全边界；真实认证见 INFRA-03）

### 角色视角可视化

- [x] **VIEW-01**: 销售视图：我的需求卡片流（匹配度进度、状态标签、业务场景/匹配能力摘要）+ 常驻 AI 需求助手
- [x] **VIEW-02**: 研发视图：能力池维护 + 待评估需求收件箱 + 匹配确认入口
- [x] **VIEW-03**: 管理员视图：汇总统计面板 + 审核队列

### 审核工作流

- [x] **REVIEW-01**: 需求具有明确状态机：草稿 → 待审核 → 已受理 → 匹配中 → 已匹配 / 已搁置
- [x] **REVIEW-02**: 销售提交需求后进入"待审核"，由管理员审核受理
- [x] **REVIEW-03**: 匹配（手动/AI）创建后为待确认状态，由研发或管理员确认后生效，记录审核人与时间
- [x] **REVIEW-04**: 审核动作在需求/匹配详情中留痕可见（谁、何时、结论）

### Chatbot 与知识库

- [x] **CHAT-01**: 平台内置对话助手，基于 RAG 检索回答平台使用和业务知识问题，回答附引用来源
- [x] **CHAT-02**: 对话助手可引导操作：从自然语言生成需求草稿（复用 AI 结构化能力）
- [x] **KB-01**: 知识库文档管理界面：已导入文档列表、来源、时间，支持删除与重建索引（吸收 Phase 7 的 RAG 生命周期项）
- [x] **KB-02**: 知识库与对话助手打通，chatbot 回答基于知识库内容

## Out of Scope

| Feature | Reason |
|---------|--------|
| AI自动匹配算法 | 手动关联已满足MVP需求，自动匹配技术复杂度高且准确性难保证 |
| 实时协作/WebSocket | 信息更新不需要实时性，手动刷新查看即可 |
| Wiki/文档管理 | 平台核心是信息汇总而非知识管理，超出课题范围 |
| 移动端App | Web优先，内网环境下移动端访问额外复杂度 |
| RBAC权限系统 | MVP阶段全透明，权限控制推迟到v2 |
| 数据导入/导出Excel | v1数据量极少（5-20条），手动录入即可 |
| 邮件通知系统 | 内网环境邮件基础设施不确定，且非核心需求 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROJ-01 | Phase 2 | Complete |
| PROJ-02 | Phase 2 | Complete |
| PROJ-03 | Phase 2 | Complete |
| PROJ-04 | Phase 4 | Complete |
| REQM-01 | Phase 2 | Complete |
| REQM-02 | Phase 2 | Complete |
| REQM-03 | Phase 4 | Complete |
| MATCH-01 | Phase 2 | Complete |
| MATCH-02 | Phase 2 | Complete |
| MATCH-03 | Phase 3 | Complete |
| MATCH-04 | Phase 3 | Complete |
| TAG-01 | Phase 2 | Complete |
| TAG-02 | Phase 2 | Complete |
| COLLAB-01 | Phase 4 | Complete |
| COLLAB-02 | Phase 4 | Complete |
| DASH-01 | Phase 3 | Complete |
| DASH-02 | Phase 3 | Complete |
| ROLE-01~05 | Phase 8 | Complete |
| VIEW-01~03 | Phase 8 | Complete |
| REVIEW-01~04 | Phase 9 | Complete |
| CHAT-01~02 | Phase 10 | Complete |
| KB-01~02 | Phase 10 | Complete |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-24*
*Last updated: 2026-07-27 — v2.0 平台化需求（角色/视图/审核/Chatbot/知识库）定义*
