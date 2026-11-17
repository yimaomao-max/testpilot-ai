import { NextResponse } from "next/server";
import { exportPlaywrightCode, exportReportMarkdown } from "@/lib/codegen";
import { getRepo } from "@/lib/repo";

export const runtime = "nodejs";

type Params = { params: { id: string } };

/** ?type=code 导出 Playwright 代码；?type=report&runId=xxx 导出测试报告 */
export async function GET(req: Request, { params }: Params) {
  const test = await getRepo().getTest(params.id);
  if (!test) return NextResponse.json({ error: "测试不存在" }, { status: 404 });

  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "code";

  if (type === "report") {
    const runId = url.searchParams.get("runId") ?? "";
    const run = await getRepo().getRun(runId);
    if (!run) return NextResponse.json({ error: "运行记录不存在" }, { status: 404 });
    const md = exportReportMarkdown(run);
    return new NextResponse(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="report-${run.id}.md"`,
      },
    });
  }

  const code = exportPlaywrightCode(test);
  return new NextResponse(code, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${test.id}.spec.ts"`,
    },
  });
}
