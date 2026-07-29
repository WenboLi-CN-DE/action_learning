# AI 工坊前端

React + TypeScript + Vite 前端，为销售/咨询、研发和管理员提供角色化工作台。

## 主要页面

| 路由 | 页面 | 说明 |
|------|------|------|
| `/role` | 身份选择 | 选择销售/咨询、研发或管理员，身份保存在当前浏览器 |
| `/` | 角色工作台 | 根据角色显示需求池、能力池、总览和审核入口 |
| `/search` | 知识检索 | RAG 检索、问答、引用；管理员可管理知识文档 |

工作台中的核心能力包括：

- 销售：新建/编辑需求、查看审核和匹配进展；
- 研发：维护能力、处理待评估需求和技术确认；
- 管理员：审核责任人指派、需求审核、关联终审和知识管理；
- v2.1：个人待办、SLA 风险、数据质量、AI 评测和试运行指标；
- 全局：详情、评论、AI 结构化输入、图片识别和悬浮问答助手。

## 目录

```text
src/
├── auth/               # 角色类型、能力矩阵和本地身份状态
├── components/         # 全局组件，例如 ChatAssistant
├── pages/              # 身份入口、工作台、审核队列和知识检索
├── services/           # 后端 API 与浏览器 LLM 临时设置
├── stores/             # 助手等 Zustand 状态
├── App.tsx             # 路由和身份保护
└── types.ts            # 共享业务类型
```

## 本地运行

```bash
npm install
npm run dev
```

默认由 Vite 将 `/api` 代理到后端。项目根目录的一键开发脚本会自动传入后端地址：

```bash
../scripts/dev.sh
```

## 验证

```bash
npm test
npm run lint
npm run build
```

当前基线：9 项前端测试通过，ESLint 与生产构建通过。

## 身份与安全边界

身份保存在 `localStorage` 的 `action_learning_identity` 中，用于：

- 选择默认工作区；
- 控制界面入口和操作显隐；
- 为评论、提交和审核操作带入当前身份。

它不是登录认证。正式企业使用前需要接入 SSO/通讯录，并在后端执行真实 RBAC 校验。

## API 与 AI

- 统一 API 客户端位于 `src/services/api.ts`；
- Qwen 浏览器临时配置位于 `src/services/llmSettings.ts`；
- 浏览器配置只用于演示覆盖，生产默认配置由后端环境提供；
- AI 匹配、结构化和问答结果都需要使用者核实，不能视为自动批准。

更多产品说明见项目根目录 [README](../README.md)。
