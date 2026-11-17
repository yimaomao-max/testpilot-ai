import type { RunResult, TestCase, TestStep } from "./types";
import { STEP_TYPE_LABELS } from "./types";

function escapeStr(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\r?\n/g, " ");
}

function stepToCode(step: TestStep, fallbackUrl: string): string {
  const t = step.timeout ? `, { timeout: ${step.timeout} }` : "";
  switch (step.type) {
    case "goto":
      return `await page.goto('${escapeStr(step.value || fallbackUrl)}');`;
    case "click":
      return `await page.click('${escapeStr(step.selector!)}'${t});`;
    case "fill":
      return `await page.fill('${escapeStr(step.selector!)}', '${escapeStr(step.value ?? "")}'${t});`;
    case "select":
      return `await page.selectOption('${escapeStr(step.selector!)}', { label: '${escapeStr(step.value ?? "")}' }${t});`;
    case "press":
      return `await page.press('${escapeStr(step.selector!)}', '${escapeStr(step.value ?? "Enter")}'${t});`;
    case "waitForSelector":
      return `await page.waitForSelector('${escapeStr(step.selector!)}', { state: 'visible'${t ? `, timeout: ${step.timeout}` : ""} });`;
    case "expectVisible":
      return `await expect(page.locator('${escapeStr(step.selector!)}').first()).toBeVisible(${t ? `{ timeout: ${step.timeout} }` : ""});`;
    case "expectText":
      return `await expect(page.locator('${escapeStr(step.selector!)}').first()).toContainText('${escapeStr(step.value ?? "")}'${t ? `, { timeout: ${step.timeout} }` : ""});`;
    case "wait":
      return `await page.waitForTimeout(${Number(step.value) || 1000});`;
    case "screenshot":
      return `await page.screenshot({ path: 'screenshots/step-${step.id}.png' });`;
    default:
      return `// 不支持的步骤类型：${(step as TestStep).type}`;
  }
}

function comment(step: TestStep): string {
  const label = STEP_TYPE_LABELS[step.type] ?? step.type;
  return step.description ? `  // ${step.description}` : `  // ${label}`;
}

/** 导出为可直接放入 Playwright 项目的 @playwright/test 代码 */
export function exportPlaywrightCode(test: TestCase): string {
  const safeName = test.name.replace(/['"\\]/g, "");
  const lines: string[] = [
    `import { test, expect } from '@playwright/test';`,
    ``,
    `// 由 TestPilot AI 导出 · ${new Date().toISOString().slice(0, 10)}`,
    `// 用例: ${safeName} · 目标: ${test.url}`,
    `test('${safeName}', async ({ page }) => {`,
  ];
  if (test.description) {
    lines.splice(5, 0, `// 说明: ${test.description.replace(/\r?\n/g, " ")}`);
  }
  for (const step of test.steps) {
    lines.push(comment(step));
    lines.push(`  ${stepToCode(step, test.url)}`);
  }
  lines.push(`});`, ``);
  return lines.join("\n");
}

/** 导出 Markdown 测试报告 */
export function exportReportMarkdown(run: RunResult): string {
  const status = run.status === "passed" ? "✅ 通过" : "❌ 失败";
  const lines: string[] = [
    `# 测试报告 · ${run.testName}`,
    ``,
    `- **结果**: ${status}`,
    `- **目标 URL**: ${run.url}`,
    `- **开始时间**: ${run.startedAt}`,
    `- **总耗时**: ${(run.durationMs / 1000).toFixed(1)}s`,
    ``,
    `## 步骤结果`,
    ``,
    `| # | 类型 | 说明 | 结果 | 耗时 | 错误 |`,
    `|---|------|------|------|------|------|`,
  ];
  for (const s of run.steps) {
    const icon = s.status === "passed" ? "✅" : s.status === "failed" ? "❌" : "⏭";
    lines.push(
      `| ${s.index} | ${STEP_TYPE_LABELS[s.type] ?? s.type} | ${s.description ?? "-"} | ${icon} ${s.status} | ${s.durationMs}ms | ${s.error ? `\`${s.error.slice(0, 120)}\`` : "-"} |`
    );
  }
  if (run.consoleLogs.length > 0) {
    lines.push(``, `## 控制台日志（错误/警告）`, ``);
    for (const log of run.consoleLogs.slice(-30)) {
      lines.push(`- \`${log}\``);
    }
  }
  if (run.aiAnalysis) {
    lines.push(``, `## AI 失败分析`, ``, run.aiAnalysis);
  }
  lines.push(``);
  return lines.join("\n");
}
