# Domain Pitfalls: 企业信息透明化平台（AI工坊平台）

**Domain:** 企业内部信息透明化 / 协作平台
**Researched:** 2026-04-24
**Context:** 管培生团队（非专职开发），Python+React，Windows环境，公司内网部署，全透明无权限MVP，5-20条手动录入数据

---

## Critical Pitfalls

可能导致项目重写或彻底失败的错误。

### Pitfall 1: 数据录入负担杀死采用率（最致命）

**What goes wrong:** 平台上线后，团队成员发现录入数据的成本远高于收益。销售不愿意花时间填写需求，研发不愿意更新项目状态。数据迅速过时，平台变成"空壳"，最后所有人回到微信群/邮件沟通。

**Why it happens:** 手动录入对数据创建者来说是纯成本、零收益。他们看不到自己录入的信息如何帮助自己。只有消费者（看信息的人）获得价值，但生产者（录入的人）承担负担。这种不对称在管培生团队尤为突出——本职工作已经很忙，录入额外数据更是负担。

**Consequences:** 数据空洞 → 平台无人信任 → 回归原有沟通方式 → 项目目标（信息透明）彻底失败。H-Studio的研究指出：内部工具失败的根源不是UX差，而是"没有设计为系统"——数据信任崩塌后，用户回归Spreadsheet和Slack。

**Prevention:**
1. **为每个角色设计录入场景时，先回答："录入这件事对录入者本人有什么直接好处？"** 如果答案是"没有"，重新设计。
2. **将录入嵌入已有工作流程。** 例如：销售在提交客户需求时，同时自动填充平台数据（而不是额外打开一个平台手动录入）。
3. **降低单条录入的时间成本到 < 2分钟。** 每条数据录入超过2分钟，注定会被放弃。
4. **Phase 1 必须验证：5条数据的完整录入流程是否可在10分钟内完成。** 如果不行，简化表单。

**Detection 信号：**
- 录入表单字段超过5个
- 录入者需要回忆或查找信息才能填写
- 录入后没有即时反馈（如"你的需求已匹配到2个预研项目"）
- 数据更新频率低于每周1次

**Phase mapping:** Phase 1（MVP核心）必须直面此问题。如果Phase 1的录入体验不能通过"录入者有直接好处"测试，整个项目方向需要调整。

---

### Pitfall 2: 把"全透明"理解为"所有人看同一个界面"

**What goes wrong:** MVP设计成所有人看到完全相同的页面布局和内容。但销售关心客户需求匹配度，研发关心项目状态追踪，咨询关心行业趋势——同一个界面无法同时服务5个角色的核心需求。结果：每个角色都觉得平台"有用但不是给我设计的"，采用率低。

**Why it happens:** "全透明"指的是数据权限无区分（所有人能看到所有数据），但被误读为"界面无区分"。这是概念混淆。数据层全透明 ≠ 交互层单一化。5个角色看到同样的原始数据是透明的，但呈现方式需要角色化。

**Consequences:** 每个角色都觉得平台"不够好用" → 各角色回到各自原有工具 → 平台沦为"偶尔看看"的参考站，不是日常工具。

**Prevention:**
1. **数据层：所有人访问同一数据集，无权限区分**（全透明 ✓）
2. **视图层：每个角色有自己关心的信息入口和默认排序**（角色视图 ✓）
3. **MVP至少做2个角色视图：前端角色视图（需求→匹配项目）和后端角色视图（项目→匹配需求）。** 不是5个，先做2个最核心的。
4. **共享一个"全局汇总视图"给管理层/课题汇报用。**

**Detection 信号：**
- 界面设计讨论中出现"所有人看到一样的东西"
- 没有角色化默认排序/筛选
- 信息密度过高，单个角色需要自己过滤大量无关信息

**Phase mapping:** Phase 1（数据模型）就需考虑角色视图需求的数据结构。Phase 2（UI）实现角色视图区分。

---

### Pitfall 3: 数据模型过度设计或结构性缺陷

**What goes wrong:** 两个极端——
- **过度设计：** 管培生团队按照"标准ERP"模式设计数据模型，10+张表、复杂关联、状态机流转。实现周期爆表，5-20条数据完全不需要这种复杂度。
- **结构性缺陷：** 为了"快速上线"，把所有信息塞进一两个表，没有关联关系。后续加"需求匹配度"功能时发现数据结构不支持关联，需要重建。

**Why it happens:** 没有基于实际数据规模（5-20条）和核心查询需求（需求↔项目匹配）来设计模型。MVP数据库设计的核心原则是：定义核心实体和关联关系，但跳过复杂状态流转和冗余字段。

**Consequences:** 过度设计 → 开发周期超3周 → 管培生团队时间不够 → 项目停滞。结构性缺陷 → Phase 2需要重建数据层 → 前期所有录入数据丢失或迁移痛苦。

**Prevention:**
1. **核心实体只3个：Project（预研项目）、Requirement（客户需求）、Tag（行业/业务线标签）。** 加1个关联实体：Match（需求↔项目匹配关系）。
2. **4张表就够了。** 不需要User表（MVP无权限）、不需要Comment表（先用协作记录简单字段）、不需要StatusHistory表。
3. **用 `created_at` / `updated_at` 时间戳，不做状态流转枚举。** MVP阶段用简单字段标记状态，不做workflow engine。
4. **Phase 1 先用 SQLite。** 5-20条数据，SQLite完全够用。PostgreSQL的部署复杂度在管培生+Windows环境下是额外负担。但设计SQL时要保持兼容性，后续可迁移。

**Detection 信号：**
- 数据模型有5+张表
- 有状态流转枚举（如status: draft→review→approved→active）
- 表之间有超过2层嵌套关联
- 争论"这个字段要不要"超过30分钟

**Phase mapping:** Phase 1（核心数据模型）——这是最关键的决策点。模型定错，后续所有功能都在错误基础上叠加。

---

### Pitfall 4: Scope Creep —— 管培生行动学习的特有陷阱

**What goes wrong:** 行动学习课题的时间有限（通常是3-6个月的课题周期），管培生的本职工作已经很忙。项目讨论中，5个角色各自提出"我还需要XXX功能"，导致scope不断膨胀。每次会议都在加功能，没有砍功能的机制。最终上线日期一再推迟，课题到期时平台还没上线。

**Why it happens:** 管培生团队没有专职PM，没有"scope守门人"。5个角色都是利益相关方，都想让自己的需求被满足。行动学习课题的汇报压力让人倾向"什么都做一点"而不是"做透一个核心流程"。N-iX和Ellenox的研究一致指出：MVP最大风险是scope creep，需要一个明确的决策者。

**Consequences:** 永远在开发，永远没上线 → 课题结束时只有半成品 → 汇报时无法展示实际成果。

**Prevention:**
1. **指定一个scope守门人（建议：解决方案工程师角色，因为这个角色天然理解前后端两端的需求且是桥梁）。** 所有新功能提议必须经过此人批准/拒绝。
2. **MVP只做1个核心流程：销售录入需求 → 平台自动/手动关联到研发预研项目 → 双方可查看匹配结果。** 其他一切都是V2。
3. **用MoSCoW方法在每个Phase开始时锁定scope。** Must have / Should have / Could have / Won't have。Must have不超过5条。
4. **每个Phase有明确的上线日期（不超过2周开发周期）。** 2周内做不完的 = scope太大。

**Detection 信号：**
- "我们还需要加XXX" 出现频率 > 每周2次
- 没有人说"这个不做"
- Phase开发周期超过2周还没完成
- 需求列表还在增长而不是收敛

**Phase mapping:** 每个Phase开始时的scope锁定会议。这是持续性的风险，需要在每个Phase checkpoint检查。

---

### Pitfall 5: Windows开发环境 + 内网部署的隐性复杂度

**What goes wrong:** 管培生团队在Windows上开发，但内网部署服务器可能是Linux。两套环境的差异导致：
- 文件路径大小写敏感问题（Windows不敏感，Linux敏感）——React import路径错误只在生产环境出现
- Python依赖的C扩展在Windows和Linux上不同——本地测试通过但部署失败
- uv管理的依赖在Windows上正常，但内网服务器没有网络访问PyPI——依赖安装失败
- 没有Docker经验，手动部署配置差异导致"在我机器上能跑"问题

**Why it happens:** 管培生团队不是专职开发，对跨环境部署问题缺乏经验。Windows开发+Linux生产是经典陷阱。Aptivate的Django内网案例记录了Windows部署的5个bug故事，每一个都是不同平台差异导致的。

**Consequences:** 部署阶段花费1-2周解决环境问题 → 上线延迟 → 或干脆只在本地跑，无法让其他人访问 → 平台价值为零。

**Prevention:**
1. **如果内网服务器是Linux：从Phase 1开始就用Docker。** Docker compose文件同时解决开发环境一致性和部署一致性。管培生不熟悉Docker，但1天的学习成本远低于2周的环境问题排查。
2. **如果内网服务器也是Windows：简化部署但仍需一致性脚本。** 用uv + Vite的标准build流程，写一个一键部署脚本。
3. **内网PyPI访问问题：提前在开发机器上缓存所有依赖。** `uv export` 生成完整依赖清单，然后在内网服务器上用 `uv pip install --no-index --find-links /local/cache/` 安装。
4. **React build必须在CI中验证路径大小写。** 用eslint-plugin-no-relative-parent-imports或手动检查。
5. **Phase 0（项目初始化）必须包含：开发环境搭建 + 部署环境验证。** 第一件事不是写业务代码，而是确保一个空项目能从开发→部署→内网可访问。

**Detection 信号：**
- 讨论部署方案时说"到时候再说"
- 开发只用本地跑，没有验证部署流程
- 依赖列表中没有锁定版本
- 没人知道内网服务器的操作系统和配置

**Phase mapping:** Phase 0（项目初始化）——部署验证是Phase 0的必要产出。Phase 1结束时必须有内网可访问的demo。

---

## Moderate Pitfalls

可能导致功能缺失或体验不佳，但不致命。

### Pitfall 6: 把"需求匹配度"做成自动化算法

**What goes wrong:** MVP阶段尝试实现自动匹配算法（NLP/语义匹配/关键词匹配），花费大量时间调算法，但5-20条数据根本不需要算法——手动关联更快更准。算法在少量数据上的表现还不如人工判断。

**Why it happens:** "匹配度"听起来很酷，技术驱动的管培生容易陷入"做一个智能匹配"的诱惑。但实际上5-20条数据，人一眼就能看出哪些需求对应哪些项目。

**Consequences:** 花费2-3周做算法 → 匹配准确率还不如手动 → 延迟上线 → 后续还要维护算法。

**Prevention:**
1. **MVP做手动关联：** 研发或解决方案工程师手动标记"项目X匹配需求Y"，附带匹配说明。
2. **匹配度显示为人工评级：** 高/中/低，由关联者主观判断。比算法在5-20条数据上更可信。
3. **V2再考虑自动匹配：** 数据量达到100+条时，自动匹配才有价值。

**Detection 信号：** 需求中出现"自动匹配""智能推荐""算法计算匹配度"

**Phase mapping:** Phase 1明确做手动关联。Phase 3+才考虑自动匹配。

---

### Pitfall 7: 没有数据新鲜度管理

**What goes wrong:** 手动录入的数据很快过时——项目状态变了没人更新，需求已满足但还显示"未匹配"。平台变成"历史档案馆"而不是"实时信息源"。Happeo和多家研究指出：数据更新不及时是信息平台被放弃的主要原因之一。

**Why it happens:** 没有设计"谁来更新、何时更新、如何知道需要更新"的机制。录入时没有设置过期提醒，没有定期更新流程。

**Consequences:** 用户发现数据过时 → 不再信任平台 → 回到微信/邮件确认最新信息 → 平台失去核心价值（透明）。

**Prevention:**
1. **每条数据都有 `last_updated` 字段，界面显示"最后更新于X天前"。** 超过7天未更新的数据标记为"可能过时"。
2. **设定简单规则：每周至少更新一次项目状态。** 不是实时，是周级别。
3. **Phase 1：在汇总视图上显示数据新鲜度指标（每条数据的更新天数）。** 这是信任建设的关键。

**Detection 信号：** 数据模型没有 `updated_at` 字段；界面没有显示数据新鲜度

**Phase mapping:** Phase 1（数据模型）包含新鲜度字段。Phase 2（UI）显示新鲜度指标。

---

### Pitfall 8: 前后端联调的CORS陷阱

**What goes wrong:** React前端（Vite dev server，端口5173）和Python后端（端口8000）在开发时需要跨域请求。管培生团队第一次做前后端分离项目，不知道需要配置CORS。开发时API请求全部被浏览器拦截，报错看不懂，浪费1-2天排查。

**Why it happens:** 这是前后端分离项目的"第一天问题"。初学者几乎都会碰到。Vite dev server和Python API server是不同origin，浏览器CORS策略默认阻止跨域请求。

**Consequences:** 开发初期卡1-2天 → 团队信心下降 → 可能放弃前后端分离改回模板渲染（丢失React的价值）。

**Prevention:**
1. **Phase 0就在Python后端配置CORS中间件。** Flask用 `flask-cors`，FastAPI用 `CORSMiddleware`。一行配置解决。
2. **Vite配置proxy作为备用方案：** `vite.config.ts` 中设置 `server.proxy`，开发时前端请求通过Vite代理到后端，完全避开CORS。
3. **写一个明确的开发环境启动文档：** "先启动后端（uv run python main.py），再启动前端（npm run dev），访问 http://localhost:5173"。

**Detection 信号：** 浏览器Console出现CORS错误；讨论"为什么API请求失败"超过1小时

**Phase mapping:** Phase 0（项目初始化）配置CORS。这应该是项目搭建的标准步骤。

---

### Pitfall 9: uv使用方式混淆

**What goes wrong:** 管培生团队习惯用pip/venv，转用uv时混淆了命令语义：
- 用 `uv pip install` 而不是 `uv add`（前者只安装到环境不修改pyproject.toml，后续其他人同步不到）
- 用 `uv run` 和手动activate混淆（环境只在uv run命令期间有效，新终端窗口需要重新sync）
- `.python-version` 文件与实际Python版本冲突导致环境创建失败
- `uv.lock` 合入冲突后无法解析

**Why it happens:** uv的命令语义和pip不同。FixDevs的uv问题汇总指出：`uv add`（修改pyproject.toml+uv.lock）vs `uv pip install`（只修改环境）是最大的混淆源。管培生团队没有Python包管理经验，更容易搞混。

**Consequences:** 依赖不一致 → "在我机器上能跑"问题 → 团队成员间环境差异 → 排查时间浪费。

**Prevention:**
1. **只用 `uv add` 添加依赖，不用 `uv pip install`。** 项目规范明确写在AGENTS.md中。
2. **统一用 `uv run python xxx` 执行脚本，不手动activate虚拟环境。**
3. **Phase 0删掉 `.python-version` 文件（如果uv init自动生成的），在pyproject.toml中指定 `requires-python = ">=3.10"`。**
4. **团队共用同一个uv.lock文件，不单独修改。**

**Detection 信号：** 有人用 `uv pip install`；有人手动activate .venv；pyproject.toml的依赖和实际环境不一致

**Phase mapping:** Phase 0建立uv使用规范，写入项目文档。

---

### Pitfall 10: 忽略"信息追溯"——没有版本记录和变更日志

**What goes wrong:** 需求/项目的信息在平台上更新了，但没人知道"改了什么、什么时候改的、谁改的"。销售看到项目状态从"预研"变成"已落地"，但不清楚什么时候变的、变的原因是什么。透明平台的核心承诺是"信息可追溯"，如果做不到，透明就只是"当前快照"，不是"全流程可见"。

**Why it happens:** MVP追求速度，跳过变更日志功能。"全透明"被理解为"可以看到当前状态"，但漏掉了"可以看到变化历史"。实际业务中，变化历史比当前状态更重要——它回答"为什么是这个状态"。

**Consequences:** 用户无法追溯变化 → 对数据变化有疑问时只能线下问人 → 平台的"透明"承诺失效 → 信息可信度下降。

**Prevention:**
1. **每条核心数据（Project, Requirement）都有一个简单的变更记录：`updated_by`, `updated_at`, `change_note`（可选）。** 不做完整版本树，只记最近一次变更。
2. **界面在数据详情页显示"最后更新"信息。** 超过5条变更记录时才考虑做完整变更历史。
3. **MVP阶段变更记录可以非常轻量：** 甚至只是 `last_updated_by: "张三", last_updated_at: "2026-04-20"`。

**Detection 信号：** 数据模型没有变更相关字段；界面只显示当前状态不显示更新信息

**Phase mapping:** Phase 1（数据模型）加入基本变更字段。Phase 2（UI）显示变更信息。

---

### Pitfall 11: 把行动学习课题当产品项目做

**What goes wrong:** 管培生团队按"正规产品开发"的节奏做事——写详细的产品需求文档、做完整的UI设计稿、搭建CI/CD流水线、做代码review流程。这些对3-6个月课题周期的行动学习项目是过度投入。课题的核心产出是"验证概念"和"展示行动成果"，不是"交付生产级产品"。

**Why it happens:** 管培生中有技术角色，倾向用专业标准做事。但行动学习课题的时间预算有限——管培生本职工作占80%时间，项目只有20%。正规产品开发流程在这个约束下不可行。

**Consequences:** 文档和流程占用了开发时间 → 实际功能开发时间不足 → 课题结束时只有文档没有可用的平台。

**Prevention:**
1. **行动学习课题的目标是：一个能用的demo + 课题汇报材料。** 不是生产级产品。
2. **文档只写必要的：** PROJECT.md（已在.planning中）+ API接口文档 + 数据模型说明。不做完整PRD。
3. **代码质量标准：** 可读、可运行、有基本错误处理。不做完整测试覆盖、不做CI/CD。
4. **课题汇报时展示：平台能做什么 + 团队学到了什么 + 下一步建议。** 而不是"我们做了多少功能"。

**Detection 信号：** 讨论PRD文档超过1天；搭建CI/CD超过半天；UI设计稿有10+个页面

**Phase mapping:** Phase 0明确项目定位——是课题demo不是生产产品。每个Phase checkpoint验证：我们是在做课题还是在做产品？

---

## Minor Pitfalls

小问题，可能造成不便但不影响核心价值。

### Pitfall 12: React组件过度拆分

**What goes wrong:** 管培生团队学了React最佳实践后，把页面拆成过多小组件。5-20条数据的界面有20+个组件文件，增加维护和理解的复杂度。MVP阶段组件拆分的好处（复用、测试）远不如害处（复杂、难追踪）。

**Prevention:** MVP每页1-3个组件文件。数据量小，组件复用价值低。先粗粒度，后按需拆分。

---

### Pitfall 13: 标签系统过度设计

**What goes wrong:** 行业/业务线标签（数据中心、水处理、工业自动化等）被做成层级标签树、多维度标签、标签关联规则。实际上5-20条数据只需要一个简单的flat标签列表。

**Prevention:** MVP标签 = 一个Tag表，name字段 + color字段。不做层级、不做多维度。界面上就是几个彩色标签按钮。

---

### Pitfall 14: 协作记录做成聊天系统

**What goes wrong:** "团队协作记录"被做成类似Slack的消息流系统，有实时消息、@提醒、消息搜索。实际上课题需要的是"就某个需求/项目做了什么决策、谁说的、什么时候"，是一段结构化备注，不是聊天流。

**Prevention:** 协作记录 = 一个 `notes` 文本字段 + `author` + `created_at`。附加在Project或Requirement上。不做独立聊天系统。

---

### Pitfall 15: 没有考虑管培生离职/轮岗后项目持续性

**What goes wrong:** 行动学习课题结束后，管培生轮岗到新岗位。原来维护平台的人离开了，平台无人维护。数据不再更新，最终变成废弃系统。

**Prevention:** 课题期间就考虑交接方案。至少留一份"如何维护这个平台"的简易文档。或者课题结束时，将平台交接给IT部门或下一个管培生小组。

---

## Phase-Specific Warnings

| Phase | Likely Pitfall | Mitigation | Priority |
|-------|---------------|------------|----------|
| Phase 0: 项目初始化 | Windows开发环境配置失误（CORS、uv、部署验证） | Phase 0产出必须包含：可运行的前后端联调demo + 内网部署验证 | ⚠️ Critical |
| Phase 0: 项目初始化 | Scope Creep开始 | 明确Phase 0只做环境搭建，不做业务功能 | ⚠️ Critical |
| Phase 1: 核心数据+录入 | 数据录入负担杀死采用率 | 录入流程<2分钟/条；录入者有直接好处 | 🔴 最Critical |
| Phase 1: 核心数据+录入 | 数据模型过度设计或结构性缺陷 | 4张核心表，SQLite先上 | ⚠️ Critical |
| Phase 1: 核心数据+录入 | 把匹配做成自动化算法 | MVP做手动关联 | Medium |
| Phase 2: 界面+角色视图 | "全透明"误解为"单一界面" | 数据层全透明+视图层角色化 | ⚠️ Critical |
| Phase 2: 界面+角色视图 | 没有数据新鲜度显示 | 每条数据显示"最后更新于X天前" | Medium |
| Phase 2: 界面+角色视图 | 忽略信息追溯 | 基本变更字段+显示 | Medium |
| Phase 3: 协作记录+汇报 | 协作记录做成聊天系统 | 做结构化备注，不做聊天流 | Low |
| Phase 3: 协作记录+汇报 | 把课题当产品做 | demo+汇报材料，不做生产级交付 | Medium |
| Any Phase | 管培生scope creep | 每Phase锁定scope，有守门人 | ⚠️ Critical |
| Any Phase | uv命令混淆 | 团队统一规范：只用uv add | Low |

---

## Research Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| 数据录入采用率陷阱 | HIGH | 多个独立研究源一致证实（H-Studio、Happeo、Veld Systems），且是内部工具失败的top原因 |
| 全透明vs单一界面混淆 | MEDIUM | 基于内部工具采用率研究推导，未找到此特定领域的直接案例 |
| 数据模型设计陷阱 | HIGH | MVP数据库设计模式有成熟的研究和最佳实践（HashBuilds、Near Coding） |
| Scope creep（管培生特有） | MEDIUM | 基于MVP开发研究 + 管培生行动学习项目的推理，无管培生开发项目的直接案例数据 |
| Windows+内网部署陷阱 | HIGH | Aptivate有直接案例，React生产环境差异有明确文档（Skilldham） |
| uv使用混淆 | HIGH | FixDevs、RealPython、Shihab Khan都有详细的uv问题记录 |
| 行动学习课题定位 | LOW | 无行动学习课题的技术项目执行研究，基于推理 |

---

## Sources

- H-Studio: [Why Most Internal Tools Fail Adoption (And It's Not UX)](https://www.h-systems.dev/en/blog/why-most-internal-tools-fail-adoption-not-ux) — HIGH confidence
- Happeo: [Intranet Fails: Reasons Employees Don't Use the Intranet](https://www.happeo.com/blog/intranet-fails-reasons-employees-dont-use-the-intranet-how-to-boost-adoption) — HIGH confidence
- Veld Systems: [Why Internal Tools Always Cost More Than You Think](https://veldsystems.com/blog/why-internal-tools-always-cost-more-than-you-think) — HIGH confidence
- Veld Systems: [Stop Overengineering Your MVP](https://veldsystems.com/blog/stop-overengineering-your-mvp) — HIGH confidence
- N-iX: [MVP development challenges: 7 common pitfalls](https://www.n-ix.com/mvp-development-challenges/) — HIGH confidence
- Ellenox: [MVP Development for Enterprises](https://www.ellenox.com/post/mvp-development-for-enterprises) — HIGH confidence
- HashBuilds: [MVP Database Design: Essential Schema Patterns](https://www.hashbuilds.com/articles/mvp-database-design-essential-schema-patterns-for-fast-launch) — HIGH confidence
- Near Coding: [Designing MVPs That Can Actually Scale](https://nearcoding.com/articles/designing-mvps-that-can-actually-scale-tech-stack-and-architecture-decisions-that-matter/) — MEDIUM confidence
- FixDevs: [uv Not Working — Common Issues](https://www.fixdevs.com/blog/uv-not-working/) — HIGH confidence
- RealPython: [uv vs pip](https://realpython.com/uv-vs-pip/) — HIGH confidence
- Aptivate: [A tale of five bugs: Django Intranets on Windows](https://aptivate.org/en/blog/2012/04/17/a-tale-of-five-bugs-django-intranets-on-windows/) — MEDIUM confidence (2012, but still relevant)
- Skilldham: [React production issues](https://skilldham.com/blog/why-your-react-app-works-fine-locally-but-breaks-in-production) — HIGH confidence
- Josh W Comeau: [Common Beginner Mistakes with React](https://www.joshwcomeau.com/react/common-beginner-mistakes/) — HIGH confidence
- 企业OA信息孤岛研究 (FineReport): OA平台如何打通信息孤岛 — MEDIUM confidence
- 企业沟通失败研究 (简道云): 企业管理沟通失败的原因 — MEDIUM confidence
- Stellar Code: [Top Mistakes Founders Make During MVP Development](https://stellarcode.io/blog/top-mistakes-founders-make-during-mvp-development/) — HIGH confidence
- QQuench AI: [Why Internal Platforms Struggle To Gain Adoption](https://qquench.ai/blog/why-internal-platforms-struggle-to-gain-adoption/) — HIGH confidence
- Jacob Tiedemann: [Why your internal platform has an adoption problem](https://jbpt.medium.com/internal-platform-adoption-problem-ccfef16f568d) — HIGH confidence

---

*Last updated: 2026-04-24*