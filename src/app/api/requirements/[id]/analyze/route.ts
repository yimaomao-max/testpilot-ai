import { NextResponse } from "next/server";
import { parseRequirementText } from "@/lib/ai";
import { getRepo } from "@/lib/repo";

export const runtime = "nodejs";

type Params = { params: { id: string } };

/** A1 需求解析：场景 + 验收标准（含规则降级） */
export async function POST(_req: Request, { params }: Params) {
  const repo = getRepo();
  const requirement = await repo.getRequirement(params.id);
  if (!requirement) return NextResponse.json({ error: "需求不存在" }, { status: 404 });

  const project = await repo.getProject(requirement.projectId);
  const targetUrl = project?.targetUrl;

  const { scenarios, acs, source } = await parseRequirementText(requirement.body, targetUrl);
  requirement.scenarios = scenarios;
  requirement.acs = acs;
  requirement.status = "analyzed";
  await repo.saveRequirement(requirement);

  return NextResponse.json({ requirement, source });
}