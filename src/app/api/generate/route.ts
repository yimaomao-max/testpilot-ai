import { NextResponse } from "next/server";
import { generateCandidates } from "@/lib/ai";

export const runtime = "nodejs";

/** 生成器向导第 1 步：根据 URL + 需求描述生成候选测试用例 */
export async function POST(req: Request) {
  let body: { url?: string; requirements?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }

  const url = (body.url ?? "").trim();
  if (!url) {
    return NextResponse.json({ error: "请输入目标 URL" }, { status: 400 });
  }
  const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  try {
    new URL(normalized);
  } catch {
    return NextResponse.json({ error: "URL 格式不正确" }, { status: 400 });
  }

  const { candidates, source } = await generateCandidates(normalized, (body.requirements ?? "").trim());
  return NextResponse.json({ url: normalized, candidates, source });
}
