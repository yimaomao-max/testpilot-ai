import { NextResponse } from "next/server";
import { generateSteps } from "@/lib/ai";
import { getRepo } from "@/lib/repo";
import { newId } from "@/lib/storage";
import type { TestCase, TestStep } from "@/lib/types";

export const runtime = "nodejs";

const VALID_STEP_TYPES = new Set([
  "goto", "click", "fill", "press", "select", "waitForSelector",
  "expectText", "expectVisible", "wait", "screenshot",
]);

export async function GET(req: Request) {
  const projectId = new URL(req.url).searchParams.get("projectId") ?? undefined;
  return NextResponse.json({ tests: await getRepo().listTests(projectId) });
}

export async function POST(req: Request) {
  let body: {
    url?: string;
    name?: string;
    description?: string;
    projectId?: string;
    requirementId?: string;
    acIds?: string[];
    steps?: TestStep[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }

  const url = (body.url ?? "").trim();
  if (!url) {
    return NextResponse.json({ error: "请输入目标 URL" }, { status: 400 });
  }
  const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  try {
    new URL(normalized);
  } catch {
    return NextResponse.json({ error: "URL 格式不正确" }, { status: 400 });
  }

  // 支持直接传入步骤（生成器向导批量创建），否则由 AI 生成
  let steps: TestStep[];
  let source: TestCase["source"];
  if (Array.isArray(body.steps) && body.steps.length > 0) {
    steps = body.steps
      .filter((s) => s && VALID_STEP_TYPES.has(s.type))
      .map((s, i) => ({
        id: s.id || `s${i + 1}`,
        type: s.type,
        selector: s.selector,
        selectorCandidates: Array.isArray(s.selectorCandidates)
          ? s.selectorCandidates
              .filter((c: unknown): c is string => typeof c === "string" && c.trim().length > 0)
              .slice(0, 4)
          : undefined,
        value: s.value,
        description: s.description,
        timeout: typeof s.timeout === "number" ? s.timeout : undefined,
      }));
    source = "manual";
  } else {
    ({ steps, source } = await generateSteps(normalized));
  }
  if (steps.length === 0) {
    return NextResponse.json({ error: "没有有效的测试步骤" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const test: TestCase = {
    id: newId("test"),
    name: body.name?.trim() || `${normalized} 测试`,
    url: normalized,
    description: body.description?.trim() || undefined,
    source,
    projectId: body.projectId?.trim() || undefined,
    requirementId: body.requirementId?.trim() || undefined,
    acIds: Array.isArray(body.acIds) ? body.acIds : undefined,
    reviewStatus: "unreviewed",
    steps,
    createdAt: now,
    updatedAt: now,
  };
  await getRepo().saveTest(test);
  return NextResponse.json({ test }, { status: 201 });
}
