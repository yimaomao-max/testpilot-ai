export type StepType =
  | "goto"
  | "click"
  | "fill"
  | "press"
  | "select"
  | "waitForSelector"
  | "expectText"
  | "expectVisible"
  | "wait"
  | "screenshot";

export interface TestStep {
  id: string;
  type: StepType;
  /** CSS / text= 等 Playwright 选择器（goto/wait/screenshot 时可空） */
  selector?: string;
  /** 候选选择器（按优先级排序），主选择器失败时按序回退 —— 录制插件自愈能力 */
  selectorCandidates?: string[];
  /** fill 的输入值 / expectText 的期望文本 / wait 的毫秒数 / press 的按键 */
  value?: string;
  description?: string;
  /** 超时毫秒数，默认 10000 */
  timeout?: number;
}

export interface TestCase {
  id: string;
  name: string;
  url: string;
  description?: string;
  /** 生成方式：ai | manual | rule */
  source: "ai" | "manual" | "rule";
  /** 归属项目（Phase 1 追溯链） */
  projectId?: string;
  /** 关联需求 */
  requirementId?: string;
  /** 关联验收标准 ID 列表 */
  acIds?: string[];
  /** 用例编号（TC-001），追溯展示用 */
  code?: string;
  /** 审核状态：未审核的 AI 用例不允许生成脚本 */
  reviewStatus?: "unreviewed" | "reviewed" | "rejected";
  steps: TestStep[];
  createdAt: string;
  updatedAt: string;
}

// ---------- 追溯链实体（Phase 1） ----------

export interface Project {
  id: string;
  name: string;
  targetUrl: string;
  description?: string;
  createdAt: string;
}

export interface Scenario {
  name: string;
  actor?: string;
  preconditions?: string[];
}

export interface AcceptanceCriterion {
  id: string;
  /** 编号 AC-001 */
  code: string;
  given: string;
  when: string;
  then: string;
  category: "normal" | "exception" | "boundary";
}

export interface Requirement {
  id: string;
  projectId: string;
  title: string;
  body: string;
  /** 来源：粘贴 | Markdown 上传 | Jira */
  source: "paste" | "markdown" | "jira";
  /** 状态：draft → analyzed → generated */
  status: "draft" | "analyzed" | "generated";
  scenarios?: Scenario[];
  acs?: AcceptanceCriterion[];
  createdAt: string;
}

export type StepStatus = "passed" | "failed" | "skipped";

export interface StepResult {
  stepId: string;
  index: number;
  type: StepType;
  description?: string;
  status: StepStatus;
  error?: string;
  /** 截图文件名（存于 data/screenshots/<runId>/ 下） */
  screenshot?: string;
  durationMs: number;
}

export interface RunResult {
  id: string;
  testId: string;
  testName: string;
  url: string;
  startedAt: string;
  durationMs: number;
  status: "passed" | "failed";
  steps: StepResult[];
  consoleLogs: string[];
  aiAnalysis?: string;
}

export const STEP_TYPE_LABELS: Record<StepType, string> = {
  goto: "打开页面",
  click: "点击元素",
  fill: "输入文本",
  press: "按下按键",
  select: "选择下拉项",
  waitForSelector: "等待元素出现",
  expectText: "断言文本",
  expectVisible: "断言可见",
  wait: "等待时间",
  screenshot: "截图",
};
