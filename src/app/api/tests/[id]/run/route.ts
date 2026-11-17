import { NextResponse } from "next/server";
import { getRepo } from "@/lib/repo";
import { runTest } from "@/lib/runner";

export const runtime = "nodejs";
export const maxDuration = 300;

type Params = { params: { id: string } };

export async function POST(_req: Request, { params }: Params) {
  const repo = getRepo();
  const test = await repo.getTest(params.id);
  if (!test) return NextResponse.json({ error: "测试不存在" }, { status: 404 });
  if (test.steps.length === 0) {
    return NextResponse.json({ error: "测试没有可执行的步骤" }, { status: 400 });
  }
  try {
    const run = await runTest(test);
    await repo.saveRun(run);
    return NextResponse.json({ run });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "执行失败" },
      { status: 500 }
    );
  }
}
