import { NextResponse } from "next/server";
import { getRepo } from "@/lib/repo";

export const runtime = "nodejs";

type Params = { params: { id: string } };

interface TraceCase {
  id: string;
  code?: string;
  title: string;
  reviewStatus: string;
  lastRun?: { id: string; status: string; startedAt: string };
}

interface TraceAc {
  id: string;
  code: string;
  given: string;
  when: string;
  then: string;
  category: string;
  caseIds: string[];
  covered: boolean;
  lastRunStatus?: string;
}

/** T1.5 需求追溯查询：Requirement → AC → Test Case → 最近执行 */
export async function GET(_req: Request, { params }: Params) {
  const repo = getRepo();
  const project = await repo.getProject(params.id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  const [requirements, tests, allRuns] = await Promise.all([
    repo.listRequirements(project.id),
    repo.listTests(project.id),
    repo.listAllRuns(),
  ]);

  // 每个用例的最近一次运行
  const lastRunByTest = new Map<string, { id: string; status: string; startedAt: string }>();
  for (const run of allRuns) {
    if (!tests.some((t) => t.id === run.testId)) continue;
    if (!lastRunByTest.has(run.testId)) {
      lastRunByTest.set(run.testId, {
        id: run.id,
        status: run.status,
        startedAt: run.startedAt,
      });
    }
  }

  const rows = requirements.map((req) => {
    const reqCases = tests.filter((t) => t.requirementId === req.id);
    const acs: TraceAc[] = (req.acs ?? []).map((ac) => {
      const linked = reqCases.filter((t) => (t.acIds ?? []).includes(ac.id));
      const statuses = linked
        .map((t) => lastRunByTest.get(t.id)?.status)
        .filter((s): s is string => Boolean(s));
      return {
        id: ac.id,
        code: ac.code,
        given: ac.given,
        when: ac.when,
        then: ac.then,
        category: ac.category,
        caseIds: linked.map((t) => t.id),
        covered: linked.length > 0,
        lastRunStatus: statuses.length
          ? statuses.every((s) => s === "passed")
            ? "passed"
            : "failed"
          : undefined,
      };
    });
    return {
      requirement: {
        id: req.id,
        title: req.title,
        status: req.status,
        acCount: (req.acs ?? []).length,
        caseCount: reqCases.length,
      },
      acs,
      cases: reqCases.map(
        (t): TraceCase => ({
          id: t.id,
          code: t.code,
          title: t.name,
          reviewStatus: t.reviewStatus ?? "unreviewed",
          lastRun: lastRunByTest.get(t.id),
        })
      ),
    };
  });

  // 未关联需求的用例
  const unlinkedCases: TraceCase[] = tests
    .filter((t) => !t.requirementId)
    .map((t) => ({
      id: t.id,
      code: t.code,
      title: t.name,
      reviewStatus: t.reviewStatus ?? "unreviewed",
      lastRun: lastRunByTest.get(t.id),
    }));

  const allAcs = rows.flatMap((r) => r.acs);
  const coveredCount = allAcs.filter((a) => a.covered).length;
  const lastStatuses = Array.from(lastRunByTest.values()).map((r) => r.status);

  return NextResponse.json({
    project,
    rows,
    unlinkedCases,
    summary: {
      requirementCount: requirements.length,
      acTotal: allAcs.length,
      acCovered: coveredCount,
      coverageRate: allAcs.length ? Math.round((coveredCount / allAcs.length) * 100) : null,
      passRate: lastStatuses.length
        ? Math.round(
            (lastStatuses.filter((s) => s === "passed").length / lastStatuses.length) * 100
          )
        : null,
    },
  });
}
