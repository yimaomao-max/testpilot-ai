# TestPilot AI —— AI 测试开发助手（MVP）

一句话：让开发者用自然语言快速创建和运行自动化测试。

## MVP 功能

- ✅ 输入 URL 自动生成测试步骤（OpenAI 兼容接口；未配置时降级为规则模式）
- ✅ 测试用例生成器向导：URL + 需求描述 → AI 生成多个候选用例 → 勾选批量创建
- ✅ Playwright 无头浏览器自动执行
- ✅ 每步自动截图，失败步骤单独记录
- ✅ AI 分析失败原因并给出修复建议
- ✅ 导出可直接使用的 Playwright 代码（.spec.ts）与 Markdown 测试报告
- ✅ 手动编辑/添加测试步骤

## 四个核心页面

| 页面 | 路由 | 对标 |
|------|------|------|
| 总览仪表盘 | `/` | 通过率环形图、用例状态分布、近 14 天趋势、用例汇总 |
| 测试用例生成器 | `/generate` | 三步向导：Define Requirements → Review & Select → Generate |
| 用例详情 / 代码导出 | `/tests`、`/tests/[id]`、`/tests/[id]/code` | 编辑器视图展示可运行的 `.spec.ts` |
| 测试报告 | `/reports/[runId]` | 深色报告页：通过率圆环、失败分组 + AI 分析、截图放大 |

## 技术栈

- Next.js 14（App Router）+ TypeScript + Tailwind CSS
- Playwright（Node 服务端执行，chromium）
- 存储：本地 JSON 文件（`data/` 目录，MVP 阶段无需数据库）

## 快速开始

```bash
npm install                # 安装依赖（postinstall 会自动安装 chromium）
cp .env.example .env.local # 可选：配置 AI 接口
npm run dev                # 打开 http://localhost:3000
```

## AI 配置（可选）

在 `.env.local` 中配置任意 OpenAI 兼容接口：

```
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.openai.com/v1   # 或其他兼容服务
OPENAI_MODEL=gpt-4o-mini
```

未配置时仍可使用：将生成基础冒烟步骤（打开页面 → 断言主体可见 → 截图），
失败分析降级为基于错误信息的规则分析。

## 目录结构

```
src/
  app/
    page.tsx                  # 仪表盘：创建用例 + 用例列表
    tests/[id]/page.tsx       # 详情：步骤编辑 / 运行 / 报告 / 导出
    api/tests/route.ts        # GET 列表 / POST 创建（AI 生成步骤）
    api/tests/[id]/route.ts   # GET 详情 / PUT 更新 / DELETE
    api/tests/[id]/run/route.ts      # POST 执行测试
    api/tests/[id]/export/route.ts   # 导出代码 / 报告
    api/screenshots/[runId]/[file]/  # 截图访问
  lib/
    ai.ts       # AI 生成步骤 + AI 失败分析（含降级）
    runner.ts   # Playwright 执行引擎
    codegen.ts  # 代码导出 / 报告导出
    storage.ts  # JSON 文件存储
    types.ts    # 类型定义
```

## 商业模式（产品规划）

| 版本 | 价格 | 内容 |
|------|------|------|
| Free | $0 | 基础执行额度 |
| Pro | $19/月 | 更高额度 + AI 分析 |
| Team | $49/月起 | 协作 + 多成员 |

差异化：不跟大型测试平台拼全套功能，专注小团队的测试创建和调试效率。

## 后续路线（非 MVP）

- 登录态/多页面流程录制（浏览器插件）
- 定时回归 + Webhook 通知
- 云端执行额度计费与账号体系
