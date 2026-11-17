import { NextResponse } from "next/server";
import { getRepo } from "@/lib/repo";
import { newId } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ projects: await getRepo().listProjects() });
}

export async function POST(req: Request) {
  let body: { name?: string; targetUrl?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "请输入项目名称" }, { status: 400 });

  const now = new Date().toISOString();
  const project = {
    id: newId("proj"),
    name,
    targetUrl: (body.targetUrl ?? "").trim(),
    description: body.description?.trim() || undefined,
    createdAt: now,
  };
  await getRepo().saveProject(project);
  return NextResponse.json({ project }, { status: 201 });
}
