import { NextResponse } from "next/server";
import { getRepo } from "@/lib/repo";

export const runtime = "nodejs";

type Params = { params: { id: string } };

/** 项目详情：项目 + 需求列表 + 用例列表（工作台 P1 数据源） */
export async function GET(_req: Request, { params }: Params) {
  const repo = getRepo();
  const project = await repo.getProject(params.id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  const [requirements, tests] = await Promise.all([
    repo.listRequirements(project.id),
    repo.listTests(project.id),
  ]);
  return NextResponse.json({ project, requirements, tests });
}

export async function PUT(req: Request, { params }: Params) {
  const repo = getRepo();
  const project = await repo.getProject(params.id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as {
    name?: string;
    targetUrl?: string;
    description?: string;
  } | null;
  if (!body) return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  if (body.name?.trim()) project.name = body.name.trim();
  if (typeof body.targetUrl === "string") project.targetUrl = body.targetUrl.trim();
  if (typeof body.description === "string") project.description = body.description.trim();
  await repo.saveProject(project);
  return NextResponse.json({ project });
}

export async function DELETE(_req: Request, { params }: Params) {
  const ok = await getRepo().deleteProject(params.id);
  if (!ok) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
