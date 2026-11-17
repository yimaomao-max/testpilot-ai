import { NextResponse } from "next/server";
import { aiEnabled } from "@/lib/ai";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ aiEnabled: aiEnabled() });
}
