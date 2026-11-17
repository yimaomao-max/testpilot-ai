import { NextResponse } from "next/server";
import { getScreenshot } from "@/lib/storage";

export const runtime = "nodejs";

type Params = { params: { runId: string; file: string } };

export async function GET(_req: Request, { params }: Params) {
  const buffer = await getScreenshot(params.runId, params.file);
  if (!buffer) return NextResponse.json({ error: "截图不存在" }, { status: 404 });
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=3600" },
  });
}
