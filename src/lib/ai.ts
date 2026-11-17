import type { RunResult, StepType, TestStep } from "./types";

const API_KEY = process.env.OPENAI_API_KEY || "";
const BASE_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export function aiEnabled(): boolean {
  return API_KEY.length > 0;
}

/** 调用 OpenAI 兼容接口，失败返回 null（由调用方降级处理） */
async function chat(system: string, user: string, maxTokens = 2000): Promise<string | null> {
  if (!aiEnabled()) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error("未找到 JSON 内容");
  const lastBrace = Math.max(candidate.lastIndexOf("]"), candidate.lastIndexOf("}"));
  return JSON.parse(candidate.slice(start, lastBrace + 1));
}

// ---------- 生成测试步骤 ----------

const GEN_SYSTEM = `你是资深 Web 自动化测试工程师。根据用户提供的 URL，推断该网站类型并生成一份精简的冒烟测试步骤清单（3-8 步）。
只返回 JSON，不要任何多余文字。格式：
{
  "name": "测试名称（中文，10 字以内）",
  "steps": [
    { "type": "goto|click|fill|press|waitForSelector|expectText|expectVisible|wait|screenshot",
      "selector": "CSS 选择器或 text=按钮文本（goto/wait/screenshot 可省略）",
      "value": "输入值/期望文本/按键/毫秒数（按需）",
      "description": "步骤中文说明" }
  ]
}
规则：第一步必须是 goto；最后一步必须是 screenshot；优先断言页面核心元素可见（header、主按钮、表单等）；选择器要宽容（优先语义化标签、role、text=）。`;

function fallbackSteps(url: string): { name: string; steps: TestStep[] } {
  let host = url;
  try {
    host = new URL(url).hostname;
  } catch {
    // 保持原样
  }
  return {
    name: `${host} 冒烟测试`,
    steps: [
      { id: "s1", type: "goto", description: `打开 ${url}` },
      { id: "s2", type: "expectVisible", selector: "body", description: "页面主体加载成功" },
      { id: "s3", type: "screenshot", description: "首页截图" },
    ],
  };
}

export async function generateSteps(
  url: string
): Promise<{ name: string; steps: TestStep[]; source: "ai" | "rule" }> {
  const content = await chat(GEN_SYSTEM, `网站 URL：${url}`);
  if (content) {
    try {
      const parsed = extractJson(content) as { name?: string; steps?: Partial<TestStep>[] };
      if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
        const steps: TestStep[] = [];
        // 强制第一步 goto
        steps.push({
          id: "s1",
          type: "goto",
          description: `打开 ${url}`,
        });
        for (const s of parsed.steps) {
          const type = s.type as StepType;
          if (type === "goto" || !VALID_STEP_TYPES.has(type)) continue;
          if (steps.length >= 10) break;
          steps.push({
            id: `s${steps.length + 1}`,
            type,
            selector: typeof s.selector === "string" ? s.selector : undefined,
            value: typeof s.value === "string" ? s.value : undefined,
            description: typeof s.description === "string" ? s.description : undefined,
          });
        }
        if (!steps.some((s) => s.type === "screenshot")) {
          steps.push({ id: `s${steps.length + 1}`, type: "screenshot", description: "结束截图" });
        }
        return {
          name: typeof parsed.name === "string" ? parsed.name.slice(0, 30) : "AI 生成测试",
          steps,
          source: "ai",
        };
      }
    } catch {
      // 降级
    }
  }
  const fb = fallbackSteps(url);
  return { ...fb, source: "rule" };
}

const VALID_STEP_TYPES = new Set<StepType>([
  "goto",
  "click",
  "fill",
  "press",
  "select",
  "waitForSelector",
  "expectText",
  "expectVisible",
  "wait",
  "screenshot",
]);

/** 清洗 AI 返回的步骤：强制第一步 goto、末尾补截图、剔除非法类型 */
function sanitizeSteps(
  raw: Partial<TestStep>[],
  url: string,
  max = 10
): TestStep[] {
  const steps: TestStep[] = [
    { id: "s1", type: "goto", description: `打开 ${url}` },
  ];
  for (const s of raw) {
    const type = s.type as StepType;
    if (type === "goto" || !VALID_STEP_TYPES.has(type)) continue;
    if (steps.length >= max - 1) break;
    steps.push({
      id: `s${steps.length + 1}`,
      type,
      selector: typeof s.selector === "string" ? s.selector : undefined,
      value: typeof s.value === "string" ? s.value : undefined,
      description: typeof s.description === "string" ? s.description : undefined,
    });
  }
  if (!steps.some((s) => s.type === "screenshot")) {
    steps.push({ id: `s${steps.length + 1}`, type: "screenshot", description: "结束截图" });
  }
  return steps;
}

// ---------- 分析失败原因 ----------

const ANALYZE_SYSTEM = `你是 Web 自动化测试专家。根据 Playwright 测试的失败记录，分析失败原因并给出修复建议。
用简洁中文回答，按以下结构输出：
【失败原因】1-2 句最可能的原因
【修复建议】2-3 条可操作的建议（如修改选择器、增加等待、检查登录态等）`;

export async function analyzeFailure(run: RunResult): Promise<string> {
  const failed = run.steps.filter((s) => s.status === "failed");
  const info = {
    url: run.url,
    失败步骤: failed.map((s) => ({
      动作: s.type,
      描述: s.description,
      错误: s.error,
    })),
    最近控制台日志: run.consoleLogs.slice(-20),
  };

  const content = await chat(ANALYZE_SYSTEM, JSON.stringify(info, null, 2));
  if (content) return content;

  // 降级：规则分析
  const lines: string[] = [];
  for (const s of failed) {
    const err = s.error || "";
    if (/timeout|Timeout/i.test(err)) {
      lines.push(
        `【失败原因】步骤「${s.description || s.type}」等待超时：目标元素未在规定时间内出现，可能是选择器失效、网络慢或页面结构变化。`
      );
      lines.push("【修复建议】1) 用浏览器 DevTools 确认元素选择器是否仍有效；2) 适当增大该步骤的 timeout；3) 若是登录/接口驱动的页面，先补一个登录准备步骤。");
    } else if (/strict mode violation|resolved to/i.test(err)) {
      lines.push(
        `【失败原因】步骤「${s.description || s.type}」的选择器命中了多个元素，Playwright 无法确定操作对象。`
      );
      lines.push("【修复建议】1) 收窄选择器范围（如加上父容器限定）；2) 使用 .first() 或更精确的 text=/role= 选择器。");
    } else {
      lines.push(
        `【失败原因】步骤「${s.description || s.type}」执行失败：${err.slice(0, 200) || "未知错误"}。`
      );
      lines.push("【修复建议】1) 查看失败步骤截图确认页面状态；2) 检查页面是否存在弹窗/遮罩拦截操作；3) 核对选择器与输入值。");
    }
  }
  return lines.join("\n\n");
}

// ---------- 生成候选测试用例（生成器向导） ----------

const CANDIDATES_SYSTEM = `你是资深 Web 自动化测试工程师。根据网站 URL 和产品需求描述，设计候选测试用例（2-5 个）。
只返回 JSON，不要任何多余文字。格式：
{
  "candidates": [
    {
      "name": "用例名（中文，12 字以内）",
      "description": "一句话说明该用例验证什么",
      "steps": [
        { "type": "goto|click|fill|press|waitForSelector|expectText|expectVisible|wait|screenshot",
          "selector": "CSS 选择器或 text=按钮文本（goto/wait/screenshot 可省略）",
          "value": "输入值/期望文本/按键/毫秒数（按需）",
          "description": "步骤中文说明" }
      ]
    }
  ]
}
规则：每个用例 3-8 步，第一步必须 goto，最后一步必须是 screenshot；优先覆盖需求描述中提到的核心功能；选择器要宽容（优先语义化标签、role、text=）。`;

export interface CandidateTest {
  name: string;
  description: string;
  steps: TestStep[];
}

export async function generateCandidates(
  url: string,
  requirements: string
): Promise<{ candidates: CandidateTest[]; source: "ai" | "rule" }> {
  const user = `网站 URL：${url}\n产品需求描述：\n${requirements || "（未提供，按常见冒烟场景设计）"}`;
  const content = await chat(CANDIDATES_SYSTEM, user, 3000);
  if (content) {
    try {
      const parsed = extractJson(content) as { candidates?: { name?: string; description?: string; steps?: Partial<TestStep>[] }[] };
      if (Array.isArray(parsed.candidates) && parsed.candidates.length > 0) {
        const candidates = parsed.candidates
          .slice(0, 5)
          .filter((c) => Array.isArray(c.steps) && c.steps.length > 0)
          .map((c) => ({
            name: (typeof c.name === "string" ? c.name : "候选用例").slice(0, 30),
            description: typeof c.description === "string" ? c.description : "",
            steps: sanitizeSteps(c.steps!, url, 9),
          }));
        if (candidates.length > 0) return { candidates, source: "ai" };
      }
    } catch {
      // 降级
    }
  }

  // 降级：规则模式给出两个基础候选
  let host = url;
  try {
    host = new URL(url).hostname;
  } catch {
    // 保持原样
  }
  return {
    source: "rule",
    candidates: [
      {
        name: `${host} 冒烟测试`,
        description: "验证页面可正常加载并完成核心交互路径",
        steps: [
          { id: "s1", type: "goto" as StepType, description: `打开 ${url}` },
          { id: "s2", type: "expectVisible" as StepType, selector: "body", description: "页面主体加载成功" },
          { id: "s3", type: "screenshot" as StepType, description: "首页截图" },
        ],
      },
      {
        name: "核心内容断言",
        description: "验证页面标题与主内容区域可见",
        steps: [
          { id: "s1", type: "goto" as StepType, description: `打开 ${url}` },
          { id: "s2", type: "expectVisible" as StepType, selector: "h1, h2, main, header", description: "标题或主内容可见" },
          { id: "s3", type: "expectText" as StepType, selector: "body", value: " ", description: "页面包含文本内容" },
          { id: "s4", type: "screenshot" as StepType, description: "结束截图" },
        ],
      },
    ],
  };
}
