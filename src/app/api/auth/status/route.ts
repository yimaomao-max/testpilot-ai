import { NextResponse } from "next/server";
import { authEnabled } from "@/lib/auth";

export const runtime = "nodejs";

/** 前端启动时探测鉴权模式 */
export async function GET() {
  return NextResponse.json({ authEnabled: authEnabled() });
}
