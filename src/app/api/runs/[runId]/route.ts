import { NextResponse } from "next/server";
import { getRun } from "@/lib/storage";

export const runtime = "nodejs";

type Params = { params: { runId: string } };

export async function GET(_req: Request, { params }: Params) {
  const run = await getRun(params.runId);
  if (!run) return NextResponse.json({ error: "运行记录不存在" }, { status: 404 });
  return NextResponse.json({ run });
}
