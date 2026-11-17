# TestPilot AI · API 参考

**语言 · Languages:** [中文](API_REFERENCE.md) | [English](API_REFERENCE.en.md)

基础 URL 默认为 `http://localhost:3000`（开发环境）。所有 JSON 接口 `Content-Type: application/json`，除非另有说明。

**运行时**：API Routes 使用 Node.js runtime（Playwright 与文件 IO 需要）。

---

## 系统

### `GET /api/status`

检查 AI 配置是否生效。

**响应示例**

```json
{ "aiEnabled": true }
```

### `GET /api/auth/status`

Supabase 模式下返回当前登录状态（未配置时返回未认证）。

---

## 统计

### `GET /api/stats`

仪表盘数据：用例总数、执行次数、通过率、分布、14 日趋势、用例摘要列表。

---

## 测试用例

### `GET /api/tests`

查询参数：

| 参数 | 说明 |
|------|------|
| `projectId` | 可选，按项目过滤 |

### `POST /api/tests`

创建用例。

**Body（常见字段）**

```json
{
  "url": "https://example.com",
  "name": "可选名称",
  "steps": [],
  "projectId": "可选",
  "requirementId": "可选",
  "source": "manual"
}
```

若 `steps` 为空且提供 `url`，服务端会调用 AI 或规则生成步骤。

**响应**：完整 `TestCase` 对象。

### `GET /api/tests/:id`

返回单个用例含 `steps[]`。

### `PUT /api/tests/:id`

更新用例字段与步骤列表。

### `DELETE /api/tests/:id`

删除用例及关联数据（视 repo 实现）。

### `POST /api/tests/:id/run`

触发 Playwright 执行。

**响应（要点）**

```json
{
  "runId": "run_xxx",
  "status": "passed | failed",
  "results": [ { "stepId": "...", "status": "...", "error": "...", "screenshot": "..." } ]
}
```

### `GET /api/tests/:id/export`

| Query | 说明 |
|-------|------|
| `format=code` | Playwright TypeScript 源码 |
| `format=report` | Markdown 测试报告 |

---

## 生成向导

### `POST /api/generate`

**Body**

```json
{
  "url": "https://example.com",
  "requirements": "自然语言需求描述"
}
```

**响应**

```json
{
  "url": "https://example.com",
  "source": "ai",
  "candidates": [
    {
      "name": "用例标题",
      "description": "说明",
      "steps": [ { "type": "goto", "description": "..." } ]
    }
  ]
}
```

---

## 执行记录

### `GET /api/runs/:runId`

单次运行的完整 `RunResult`（步骤结果、耗时、失败分析等）。

### `GET /api/screenshots/:runId/:file`

返回 PNG/JPEG 截图二进制流。

---

## 项目

### `GET /api/projects`

列出所有项目。

### `POST /api/projects`

```json
{ "name": "项目名", "targetUrl": "https://...", "description": "可选" }
```

### `GET /api/projects/:id`

### `PUT /api/projects/:id`

### `DELETE /api/projects/:id`

### `GET /api/projects/:id/traceability`

需求 → 验收标准 → 用例 → 最近执行状态的追溯视图（JSON）。

---

## 需求

### `GET /api/requirements?projectId=`

按项目列出需求。

### `POST /api/requirements`

```json
{
  "projectId": "...",
  "title": "需求标题",
  "body": "需求正文"
}
```

### `GET /api/requirements/:id`

### `PUT /api/requirements/:id`

### `DELETE /api/requirements/:id`

---

## 类型：`TestStep`

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 步骤 ID |
| `type` | StepType | 见 README 步骤表 |
| `selector` | string? | 主选择器 |
| `selectorCandidates` | string[]? | 回退选择器 |
| `value` | string? | 输入/期望/等待毫秒等 |
| `description` | string? | 中文说明 |
| `timeout` | number? | 毫秒，默认 10000 |

---

## 错误处理

失败时通常返回：

```json
{ "error": "可读错误信息" }
```

HTTP 状态码：`400` 参数错误，`404` 资源不存在，`500` 服务端异常。

---

## 扩展阅读

- 实现：`src/app/api/**/route.ts`
- 领域类型：`src/lib/types.ts`
- 存储抽象：`src/lib/repo/`