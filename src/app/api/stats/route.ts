import { NextResponse } from "next/server";
import { getRepo } from "@/lib/repo";

export const runtime = "nodejs";

/** 仪表盘统计：通过率、结果分布、近 14 天趋势、每个用例最近一次运行状态 */
export async function GET() {
  const repo = getRepo();
  const [tests, runs] = await Promise.all([repo.listTests(), repo.listAllRuns()]);
  const lastRunByTest = new Map<string, (typeof runs)[number]>();
  for (const run of runs) {
    if (!lastRunByTest.has(run.testId)) lastRunByTest.set(run.testId, run);
  }

  const lastRuns = Array.from(lastRunByTest.values());
  const passed = lastRuns.filter((r) => r.status === "passed").length;
  const failed = lastRuns.filter((r) => r.status === "failed").length;
  const notRun = tests.length - lastRuns.length;

  // 近 14 天趋势
  const trend: { date: string; total: number; failed: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dayRuns = runs.filter((r) => r.startedAt.slice(0, 10) === key);
    trend.push({
      date: key.slice(5),
      total: dayRuns.length,
      failed: dayRuns.filter((r) => r.status === "failed").length,
    });
  }

  return NextResponse.json({
    totalTests: tests.length,
    totalRuns: runs.length,
    passRate: lastRuns.length > 0 ? Math.round((passed / lastRuns.length) * 100) : null,
    distribution: { passed, failed, notRun },
    trend,
    tests: tests.map((t) => {
      const last = lastRunByTest.get(t.id);
      return {
        id: t.id,
        name: t.name,
        url: t.url,
        stepCount: t.steps.length,
        source: t.source,
        updatedAt: t.updatedAt,
        lastRun: last
          ? { id: last.id, status: last.status, startedAt: last.startedAt, durationMs: last.durationMs }
          : null,
      };
    }),
  });
}
