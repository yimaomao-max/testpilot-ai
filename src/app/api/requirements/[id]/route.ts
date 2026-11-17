import { NextResponse } from "next/server";
import { getRepo } from "@/lib/repo";
import type { AcceptanceCriterion, Requirement, Scenario } from "@/lib/types";

export const runtime = "nodejs";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const requirement = await getRepo().getRequirement(params.id);
  if (!requirement) return NextResponse.json({ error: "需求不存在" }, { status: 404 });
  return NextResponse.json({ requirement });
}

/** 更新需求（标题/内容/状态/AI 解析结果回写） */
export async function PUT(req: Request, { params }: Params) {
  const repo = getRepo();
  const requirement = await repo.getRequirement(params.id);
  if (!requirement) return NextResponse.json({ error: "需求不存在" }, { status: 404 });

  let body: {
    title?: string;
    body?: string;
    status?: Requirement["status"];
    scenarios?: Scenario[];
    acs?: AcceptanceCriterion[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }

  if (body.title?.trim()) requirement.title = body.title.trim();
  if (typeof body.body === "string" && body.body.trim()) requirement.body = body.body.trim();
  if (body.status && ["draft", "analyzed", "generated"].includes(body.status)) {
    requirement.status = body.status;
  }
  if (Array.isArray(body.scenarios)) requirement.scenarios = body.scenarios;
  if (Array.isArray(body.acs)) requirement.acs = body.acs;

  await repo.saveRequirement(requirement);
  return NextResponse.json({ requirement });
}

export async function DELETE(_req: Request, { params }: Params) {
  const ok = await getRepo().deleteRequirement(params.id);
  if (!ok) return NextResponse.json({ error: "需求不存在" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
