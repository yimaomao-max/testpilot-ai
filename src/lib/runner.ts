import { chromium } from "playwright";
import type { Browser, Page } from "playwright";
import { analyzeFailure } from "./ai";
import { newId, saveScreenshot } from "./storage";
import type { RunResult, StepResult, TestCase, TestStep } from "./types";

const DEFAULT_TIMEOUT = 10_000;

function requireSelector(step: TestStep): string {
  const sel = step.selector?.trim();
  if (!sel) throw new Error(`步骤「${step.type}」缺少选择器`);
  return sel;
}

/** 主选择器 + 候选选择器去重后的有序列表（录制插件自愈回退用） */
function candidateSelectors(step: TestStep): string[] {
  const all = [step.selector, ...(step.selectorCandidates ?? [])]
    .map((s) => s?.trim())
    .filter((s): s is string => !!s);
  return Array.from(new Set(all));
}

/** 依次尝试主选择器与候选选择器，全部失败才抛出最后一个错误 */
async function trySelectors(
  step: TestStep,
  act: (sel: string) => Promise<void>
): Promise<void> {
  const selectors = candidateSelectors(step);
  if (selectors.length === 0) {
    throw new Error(`步骤「${step.type}」缺少选择器`);
  }
  let lastErr: unknown;
  for (const sel of selectors) {
    try {
      await act(sel);
      return;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(String(lastErr ?? "执行失败"));
}

async function executeStep(page: Page, step: TestStep): Promise<void> {
  const timeout = step.timeout ?? DEFAULT_TIMEOUT;
  switch (step.type) {
    case "goto":
      // goto 步骤的 URL 由 runTest 统一注入到 step.value
      await page.goto(step.value || "about:blank", { waitUntil: "load", timeout });
      break;
    case "click":
      await trySelectors(step, (sel) => page.click(sel, { timeout }));
      break;
    case "fill":
      await trySelectors(step, (sel) => page.fill(sel, step.value ?? "", { timeout }));
      break;
    case "select":
      // value 记录的是选项文本；优先按标签选择，兼容 value 匹配
      await trySelectors(step, async (sel) => {
        await page
          .selectOption(sel, { label: step.value ?? "" }, { timeout })
          .catch(async () => {
            await page.selectOption(sel, step.value ?? "", { timeout });
          });
      });
      break;
    case "press":
      await trySelectors(step, (sel) => page.press(sel, step.value ?? "Enter", { timeout }));
      break;
    case "waitForSelector":
      await trySelectors(step, async (sel) => {
        await page.waitForSelector(sel, { state: "visible", timeout });
      });
      break;
    case "expectVisible":
      await trySelectors(step, async (sel) => {
        await page.waitForSelector(sel, { state: "visible", timeout });
      });
      break;
    case "expectText": {
      await trySelectors(step, async (sel) => {
        const locator = page.locator(sel).first();
        await locator.waitFor({ state: "visible", timeout });
        const text = await locator.textContent();
        const expected = step.value ?? "";
        if (!text || !text.includes(expected)) {
          throw new Error(
            `断言文本失败：期望包含「${expected}」，实际为「${(text ?? "").slice(0, 200)}」`
          );
        }
      });
      break;
    }
    case "wait": {
      const ms = Math.min(Number(step.value) || 1000, 30_000);
      await page.waitForTimeout(ms);
      break;
    }
    case "screenshot":
      // 截图统一由 runTest 在每步之后处理
      break;
    default:
      throw new Error(`不支持的步骤类型：${(step as TestStep).type}`);
  }
}

/**
 * 使用 Playwright 无头浏览器执行测试步骤。
 * 每步之后截图，失败即停止并记录失败步骤 + 控制台日志 + AI 分析。
 */
export async function runTest(test: TestCase): Promise<RunResult> {
  const runId = newId("run");
  const startedAt = new Date().toISOString();
  const stepResults: StepResult[] = [];
  const consoleLogs: string[] = [];

  // goto 步骤统一使用测试用例的 URL
  const steps = test.steps.map((s) =>
    s.type === "goto" ? { ...s, value: test.url, selector: undefined } : s
  );

  let browser: Browser | null = null;
  let passed = true;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 TestPilotAI/0.1",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(DEFAULT_TIMEOUT);

    page.on("console", (msg) => {
      if (["error", "warning"].includes(msg.type())) {
        consoleLogs.push(`[${msg.type()}] ${msg.text().slice(0, 300)}`);
      }
    });
    page.on("pageerror", (err) => {
      consoleLogs.push(`[pageerror] ${String(err).slice(0, 300)}`);
    });

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const started = Date.now();
      const shotName = `${String(i + 1).padStart(2, "0")}-${step.type}.png`;
      let screenshot: string | undefined;
      try {
        await executeStep(page, step);
        try {
          const buffer = await page.screenshot({ fullPage: false });
          screenshot = await saveScreenshot(runId, shotName, buffer);
        } catch {
          // 截图失败不影响步骤结果
        }
        stepResults.push({
          stepId: step.id,
          index: i + 1,
          type: step.type,
          description: step.description,
          status: "passed",
          screenshot,
          durationMs: Date.now() - started,
        });
      } catch (err) {
        passed = false;
        try {
          const buffer = await page.screenshot({ fullPage: false });
          screenshot = await saveScreenshot(runId, shotName, buffer);
        } catch {
          // 页面可能已崩溃
        }
        stepResults.push({
          stepId: step.id,
          index: i + 1,
          type: step.type,
          description: step.description,
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
          screenshot,
          durationMs: Date.now() - started,
        });
        // 剩余步骤标记为跳过
        for (let j = i + 1; j < steps.length; j++) {
          stepResults.push({
            stepId: steps[j].id,
            index: j + 1,
            type: steps[j].type,
            description: steps[j].description,
            status: "skipped",
            durationMs: 0,
          });
        }
        break;
      }
    }
  } catch (err) {
    // 浏览器启动等致命错误
    passed = false;
    stepResults.push({
      stepId: "fatal",
      index: stepResults.length + 1,
      type: "goto",
      description: "浏览器初始化",
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
      durationMs: 0,
    });
  } finally {
    await browser?.close().catch(() => undefined);
  }

  const run: RunResult = {
    id: runId,
    testId: test.id,
    testName: test.name,
    url: test.url,
    startedAt,
    durationMs: Date.now() - new Date(startedAt).getTime(),
    status: passed ? "passed" : "failed",
    steps: stepResults,
    consoleLogs,
  };

  if (!passed) {
    run.aiAnalysis = await analyzeFailure(run);
  }
  return run;
}
