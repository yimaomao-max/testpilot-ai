import { NextResponse } from "next/server";
import { getRepo } from "@/lib/repo";
import type { TestStep } from "@/lib/types";

export const runtime = "nodejs";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const repo = getRepo();
  const test = await repo.getTest(params.id);
  if (!test) return NextResponse.json({ error: "测试不存在" }, { status: 404 });
  const runs = await repo.listRunsByTest(test.id);
  return NextResponse.json({ test, runs });
}

export async function PUT(req: Request, { params }: Params) {
  const repo = getRepo();
  const test = await repo.getTest(params.id);
  if (!test) return NextResponse.json({ error: "测试不存在" }, { status: 404 });

  let body: {
    name?: string;
    steps?: TestStep[];
    url?: string;
    reviewStatus?: "unreviewed" | "reviewed" | "rejected";
    requirementId?: string | null;
    acIds?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }

  if (typeof body.name === "string" && body.name.trim()) test.name = body.name.trim();
  if (typeof body.url === "string" && body.url.trim()) test.url = body.url.trim();
  if (body.reviewStatus && ["unreviewed", "reviewed", "rejected"].includes(body.reviewStatus)) {
    test.reviewStatus = body.reviewStatus;
  }
  if (body.requirementId !== undefined) test.requirementId = body.requirementId || undefined;
  if (Array.isArray(body.acIds)) test.acIds = body.acIds;
  if (Array.isArray(body.steps)) {
    test.steps = body.steps
      .filter(
        (s) =>
          s &&
          typeof s.type === "string" &&
          ["goto", "click", "fill", "press", "select", "waitForSelector", "expectText", "expectVisible", "wait", "screenshot"].includes(s.type)
      )
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
  }
  test.updatedAt = new Date().toISOString();
  await repo.saveTest(test);
  return NextResponse.json({ test });
}

export async function DELETE(_req: Request, { params }: Params) {
  const ok = await getRepo().deleteTest(params.id);
  if (!ok) return NextResponse.json({ error: "测试不存在" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
