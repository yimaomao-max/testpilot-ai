import { NextResponse } from "next/server";
import { getRepo } from "@/lib/repo";
import { newId } from "@/lib/storage";
import type { AcceptanceCriterion, Requirement, Scenario } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const projectId = new URL(req.url).searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "缺少 projectId 参数" }, { status: 400 });
  }
  return NextResponse.json({ requirements: await getRepo().listRequirements(projectId) });
}

export async function POST(req: Request) {
  let body: {
    projectId?: string;
    title?: string;
    body?: string;
    source?: Requirement["source"];
    scenarios?: Scenario[];
    acs?: AcceptanceCriterion[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }
  const projectId = (body.projectId ?? "").trim();
  const text = (body.body ?? "").trim();
  if (!projectId || !text) {
    return NextResponse.json({ error: "缺少 projectId 或需求内容" }, { status: 400 });
  }
  const repo = getRepo();
  if (!(await repo.getProject(projectId))) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  const requirement: Requirement = {
    id: newId("req"),
    projectId,
    title: (body.title ?? "").trim() || text.split(/\n/)[0].slice(0, 40),
    body: text,
    source: body.source ?? "paste",
    status: "draft",
    scenarios: body.scenarios,
    acs: body.acs,
    createdAt: new Date().toISOString(),
  };
  await repo.saveRequirement(requirement);
  return NextResponse.json({ requirement }, { status: 201 });
}
