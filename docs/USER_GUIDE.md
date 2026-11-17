# TestPilot AI · 用户使用指南

**语言 · Languages:** [中文](USER_GUIDE.md) | [English](USER_GUIDE.en.md)

本指南带你从零到第一次成功执行测试，并说明进阶能力（生成向导、报告、导出、插件、云端模式）。

---

## 目录

1. [30 秒心智模型](#1-30-秒心智模型)
2. [安装与首次启动](#2-安装与首次启动)
3. [路径 A：快速冒烟（单 URL）](#3-路径-a快速冒烟单-url)
4. [路径 B：需求向导（多候选用例）](#4-路径-b需求向导多候选用例)
5. [编辑步骤与运行](#5-编辑步骤与运行)
6. [读懂测试报告](#6-读懂测试报告)
7. [导出 Playwright 代码](#7-导出-playwright-代码)
8. [Chrome 录制插件](#8-chrome-录制插件)
9. [项目与需求追溯](#9-项目与需求追溯)
10. [Supabase 云端部署](#10-supabase-云端部署)
11. [常见问题 FAQ](#11-常见问题-faq)

---

## 1. 30 秒心智模型

TestPilot 中有四个持久化概念：

```
项目 Project  →  需求 Requirement  →  测试用例 TestCase  →  执行记录 Run
     │                  │                    │
     └──── 追溯链（可选，小团队可先只用 TestCase）────┘
```

**最短路径**：在首页或用例 API 直接创建一个 `TestCase`（带 URL + 步骤）→ 点击运行 → 打开报告。

**推荐路径**：在 `/generate` 用自然语言描述场景 → AI 给出多条候选 → 勾选创建 → 在详情页微调 → 运行。

---

## 2. 安装与首次启动

```bash
git clone https://github.com/yimaomao-max/testpilot-ai.git
cd testpilot-ai
npm install
cp .env.example .env.local   # 可选
npm run dev
```

浏览器打开 **http://localhost:3000**。

| 检查项 | 方式 |
|--------|------|
| 服务存活 | 首页仪表盘能加载 |
| AI 是否启用 | 打开 http://localhost:3000/api/status → `aiEnabled: true/false` |
| Chromium | 首次 `npm install` 已执行 `playwright install chromium` |

### 配置 AI（推荐）

编辑 `.env.local`：

```env
OPENAI_API_KEY=你的密钥
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

重启 `npm run dev`。未配置时：

- 单 URL 创建用例会生成 **3 步规则冒烟**（打开 → 断言 body → 截图）
- 生成向导仍可返回基于规则的候选集（响应里 `source: "rule"`）

---

## 3. 路径 A：快速冒烟（单 URL）

适合：**只想验证某个站点能否打开、主体是否可见**。

### 在 UI 中操作

1. 进入首页或 **测试用例** 列表
2. 填写目标 **URL** 并创建用例（若提供「从 URL 生成」入口）
3. 进入用例详情 `/tests/{id}`
4. 点击 **运行测试**
5. 完成后跳转或打开 `/reports/{runId}`

### 通过 API（适合自动化集成）

```bash
# 创建
curl -s -X POST http://localhost:3000/api/tests \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}' | jq

# 运行（将 {id} 替换为上一步返回的 id）
curl -s -X POST http://localhost:3000/api/tests/{id}/run | jq
```

创建接口在配置了 AI 时会调用 `lib/ai.ts` 中的步骤生成；否则使用 `fallbackSteps`。

---

## 4. 路径 B：需求向导（多候选用例）

适合：**一个页面多种场景**（登录、搜索、表单校验等）。

### 三步向导 `/generate`

| 步骤 | 名称 | 你要做的 |
|------|------|----------|
| 1 | Define Requirements | 填写 **URL** + **需求描述**（中文自然语言即可） |
| 2 | Review, Edit and Select | 查看 AI 返回的多条 **候选用例**，取消不需要的勾选 |
| 3 | Generate Test Cases | 批量创建，跳转到用例列表 |

示例需求描述：

```text
目标：电商首页冒烟
1. 顶部搜索框可输入并回车
2. 导航栏至少 3 个类目链接可点击
3. 页脚包含「联系我们」文案
```

响应字段说明：

- `source`: `"ai"` | `"rule"` — 是否走大模型
- `candidates[]`: 每条含 `name`、`description`、`steps[]`

---

## 5. 编辑步骤与运行

### 步骤编辑器

在 `/tests/[id]` 可：

- 增删改步骤顺序
- 修改 `type`、`selector`、`value`、`description`
- 为录制/脆弱页面配置 **`selectorCandidates`**（Runner 按序回退）

### 执行行为（`lib/runner.ts`）

- 使用 **Chromium 无头** 模式
- 默认单步超时 **10s**（步骤级可覆盖 `timeout`）
- **遇错即停**，后续步骤标记为跳过
- 每步尝试截图；失败步骤保留错误信息与截图路径
- 失败时调用 **AI 失败分析**（无 Key 时规则分析）

### 运行

详情页 **运行** 或：

```bash
curl -X POST http://localhost:3000/api/tests/{id}/run
```

返回体包含 `runId`，用于打开报告。

---

## 6. 读懂测试报告

路由：**`/reports/[runId]`**

### 视觉结构

- **通过率圆环** — 本次 run 的步骤/用例维度汇总
- **时间线与耗时** — `startedAt`、`durationMs`
- **步骤列表** — 逐步状态（pass / fail / skipped）
- **失败区** — 聚合失败步骤，展示：
  - 错误消息
  - 预期 vs 实际（断言类步骤）
  - **AI 诊断**（结论、置信度、建议下一步）
  - 截图缩略图（点击放大）

### 截图访问

```
GET /api/screenshots/{runId}/{filename}
```

文件落在本地 `data/` 下（不上传 Git）。

---

## 7. 导出 Playwright 代码

路由：**`/tests/[id]/code`**（UI）或：

```bash
# Playwright TypeScript
curl "http://localhost:3000/api/tests/{id}/export?format=code"

# Markdown 报告（基于最近一次或指定 run，视实现参数而定）
curl "http://localhost:3000/api/tests/{id}/export?format=report"
```

导出代码特点（见 `lib/codegen.ts`）：

- 标准 `@playwright/test` 结构
- 步骤映射为 `page.goto`、`getByRole` / locator、`expect` 等
- 可下载后在本地 `npx playwright test` 独立运行

---

## 8. Chrome 录制插件

目录：**`extension/`**

### 加载插件

1. Chrome → `chrome://extensions` → 开发者模式
2. 加载已解压 → 选择 `extension` 文件夹

### 与本地服务联调

插件硬编码对接 **`http://localhost:3100`**。请用 3100 端口启动：

```bash
npm run dev -- -p 3100
```

### 录制流程

1. 在待测网站点击扩展图标 → **开始录制**
2. 执行点击、输入、导航等操作
3. **停止录制** → 在弹窗中调整步骤顺序
4. 选择 **项目** / **需求**（需先通过 API 或后续 UI 创建）
5. **创建用例** → 浏览器打开 `http://localhost:3100/tests/{id}`

录制步骤会带上多候选选择器，利于 Runner **自愈**。

---

## 9. 项目与需求追溯

Phase 1 数据模型（`src/lib/types.ts`）支持：

- **Project** — 名称、`targetUrl`
- **Requirement** — 归属项目、正文、解析状态
- **TestCase** — 可挂 `projectId`、`requirementId`、`acIds`、`code`（TC-xxx）
- **追溯查询** — `GET /api/projects/{id}/traceability`

典型 REST：

```bash
# 创建项目
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"Demo","targetUrl":"https://example.com"}'

# 创建需求
curl -X POST http://localhost:3000/api/requirements \
  -H "Content-Type: application/json" \
  -d '{"projectId":"...","title":"登录模块","body":"..."}'
```

PRD 中的「验收标准 AC-001」与审核流在文档 **01-PRD-MVP.md** 中有完整定义；部分 UI 仍在迭代，API 可先集成。

---

## 10. Supabase 云端部署

### 适用场景

- 多人共用一台 SaaS 实例
- 需要登录与 PostgreSQL 持久化
- 准备部署到 Vercel 等 Serverless 宿主（注意 Playwright 执行对宿主的限制）

### 步骤摘要

1. 创建 Supabase 项目
2. 在 SQL Editor 执行 `supabase/migrations/0001_init.sql`
3. 配置环境变量（见 `.env.example`）
4. `npm run build && npm start`
5. 访问 `/login` 完成认证流程（`src/lib/auth.ts`）

未配置 Supabase 时，`getRepo()` 自动使用 **MemoryRepo**（JSON 文件）。

---

## 11. 常见问题 FAQ

### Q：AI 一直显示 rule 模式？

- 检查 `.env.local` 中 `OPENAI_API_KEY` 是否非空
- 重启 dev server
- 访问 `/api/status` 确认 `aiEnabled`

### Q：运行时报 Chromium 找不到？

```bash
npx playwright install chromium
```

### Q：插件连不上 API？

- 确认使用 **3100** 端口启动
- 检查 `extension/manifest.json` 中 `host_permissions`

### Q：断言频繁失败？

1. 在详情页把脆弱 CSS 改为 `text=` 或 role 类选择器
2. 增加 `selectorCandidates`
3. 对动态页面在断言前增加 `wait` 或 `waitForSelector`

### Q：`data/` 目录可以删吗？

可以。删除后本地用例与运行记录清空；不影响代码。该目录已被 Git 忽略。

### Q：生产环境能用内置 Runner 吗？

内置 Runner 适合 **Demo / 小规模**。高负载或安全隔离场景请等待 **Local Runner CLI**（见 README 路线图）在本地执行并上报结果。

---

## 下一步

- 阅读 [API 参考](./API_REFERENCE.md) 做 CI 集成
- 阅读 [PRD](./01-PRD-MVP.md) 了解即将上线的审核流与失败六分类
- 在 GitHub 提 Issue 描述你的使用场景