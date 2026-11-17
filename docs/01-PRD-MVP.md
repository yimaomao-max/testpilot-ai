# Spec2Test AI · MVP PRD(V1.0 基线)

> 依据:`docs/00-创业规划基线-V1.0.md`。范围:Web SaaS 部分(插件与 Local Runner 在 41–55 天阶段另立 PRD)。

## 1. 用户核心旅程

```
创建项目 → 导入需求 → AI 解析(场景/验收标准) → 生成测试用例(正常/异常/边界)
→ 人工审核用例 → 生成 Playwright TS → 执行(Runner) → 失败分类分析 → 报告与追溯
```

North Star:用户每周把它纳入开发流程(而不是注册体验一次)。

## 2. 第一版四个页面

| # | 页面 | 路由(现有代码库) | 现状 |
|---|---|---|---|
| P1 | 项目工作台 | `/` | 改造:从"测试总览"升级为 项目 → 需求 → 用例 → 执行 的四层工作台 |
| P2 | 需求分析 | `/generate` | 改造:现有三步向导升级为 需求导入 → AI 解析 → 用例生成审核 |
| P3 | 测试代码 | `/tests/[id]/code` | 已有:增加需求追溯标注 |
| P4 | 执行报告 | `/reports/[runId]` | 已有:增加失败分类 + 证据面板 + 需求覆盖 |

### P1 项目工作台

- 项目列表(名称、目标站点、用例数、最近执行状态、需求覆盖率)
- 进入项目:需求列表(状态:草稿/已解析/已生成)、用例列表(按需求分组)、最近执行
- 顶部概览卡:需求覆盖率(已关联用例的验收标准 / 全部验收标准)、通过率、近 7 天执行
- 操作:新建项目、导入需求、运行全部、进入 P2/P3/P4

### P2 需求分析(产品核心)

**Step 1 导入需求**:粘贴文本 / 上传 .md;可选 URL(用于后续脚本生成的站点上下文)。
**Step 2 AI 解析**:输出结构化结果 ——
- 业务场景列表(每个场景:名称、角色、前置条件)
- 验收标准(AC,编号 AC-001…,来自 Given/When/Then 或需求要点)
- 边界条件与异常分支提示
**Step 3 用例生成与审核**:
- 按 AC 生成用例:正常流 / 异常流 / 边界流,每条含:步骤(操作+选择器建议)、预期结果、关联 AC、优先级、**生成理由**、**待确认项**
- 人工审核:可编辑、可删除、可标记"确认有效";只有已审核用例才能进入 P3 生成脚本

### P3 测试代码

- 用例 → Playwright TypeScript(.spec.ts)生成:describe 按需求分组、test标题含 TC 编号、Locator 策略(getByRole/getByLabel/text 优先,CSS 兜底)、断言、测试数据常量
- 编辑器视图(行号/高亮/状态栏)+ 下载导出
- 每个测试头部注释块:关联 Requirement / AC / 生成时间 / 审核 —— 实现代码级追溯

### P4 执行报告

- 概览:Pass/Fail 圆环、需求覆盖率、耗时、环境(Runner 标识)
- 失败区:每条失败按**失败分类**组织 —— `application_bug | locator_changed | script_error | environment | data_issue | unknown`
- 每条失败展示证据卡:截图、控制台错误、网络错误(Phase 2:Trace)、预期 vs 实际、AI 诊断(结论 + 置信度 + 建议下一步)
- 追溯视图:Requirement → AC → TC → 执行结果 对照表;未覆盖 AC 高亮

## 3. AI 输入输出契约

### A1 需求解析(`POST /api/requirements/[id]/analyze`)
- 输入:`{ requirementText: string, targetUrl?: string }`
- 输出(JSON):`{ scenarios: [{ name, actor, preconditions[] }], acceptanceCriteria: [{ id, given, when, then, category }] }`
- 失败降级:规则模式(按段落/要点切分 AC)并明确标注"未使用 AI"

### A2 用例生成(`POST /api/requirements/[id]/generate-cases`)
- 输入:`{ acceptanceCriteria: AC[], targetUrl?: string }`
- 输出:`{ cases: [{ title, type: normal|exception|boundary, acIds[], priority, reason, openQuestions[], steps: [{ action, selectorHint?, inputData?, expected }] }] }`
- 约束:每 AC 至少 1 条正常流;异常/边界按 AC 语义判断;禁止编造不存在的页面元素(selectorHint 仅作建议并标注 `unverified: true`)

### A3 失败分析(`POST /api/runs/[id]/analyze`)
- 输入:`{ failedSteps, screenshots(引用), consoleLogs, networkErrors?(P2), expected, actual }`
- 输出:`{ failureType, confidence: 0-1, scenario, expected, actual, evidenceRefs[], diagnosis, suggestedNextStep }`
- 约束:输出必须引用证据;置信度 <0.6 时归类 `unknown` 并要求人工判断

## 4. 非功能需求

- 用例必须经人工审核才生成脚本(AI 不落库为"已确认")
- 全部 AI 调用记录 usage(供额度计费)
- 未配置 AI Key 时全链路可走通(规则模式),保证演示与开发不受阻
- 截图/日志等产物提供删除入口(隐私)

## 5. 验收标准(对照基线指标)

| 指标 | 目标 |
|---|---|
| 首次生成测试(导入需求→可运行脚本) | ≤5 分钟 |
| 生成用例可审核率(审核通过/生成) | ≥80% |
| 脚本首次可执行率 | ≥70% |
| 失败分类可用性 | ≥4 类可区分且附证据 |
| 需求覆盖率计算 | AC 级别可追溯到用例与执行 |
