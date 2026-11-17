"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface TracePayload {
  project: { id: string; name: string; targetUrl: string; description?: string };
  summary: {
    requirementCount: number;
    acTotal: number;
    acCovered: number;
    coverageRate: number | null;
    passRate: number | null;
  };
  rows: {
    requirement: { id: string; title: string; status: string; acCount: number; caseCount: number };
    cases: { id: string; title: string; reviewStatus: string; lastRun?: { status: string } }[];
  }[];
  unlinkedCases: { id: string; title: string; reviewStatus: string }[];
}

const REQ_STATUS: Record<string, string> = {
  draft: "草稿",
  analyzed: "已解析",
  generated: "已生成用例",
};

export default function ProjectWorkbenchPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [data, setData] = useState<TracePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReqForm, setShowReqForm] = useState(false);
  const [reqTitle, setReqTitle] = useState("");
  const [reqBody, setReqBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/projects/${id}/traceability`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreateRequirement(e: React.FormEvent) {
    e.preventDefault();
    if (!reqBody.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: id,
          title: reqTitle,
          body: reqBody,
          source: "paste",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "保存失败");
      setShowReqForm(false);
      setReqTitle("");
      setReqBody("");
      router.push(`/projects/${id}/requirements/${json.requirement.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="card text-sm text-slate-500">加载工作台…</main>;
  if (!data) return <main className="card text-sm text-rose-400">{error || "项目不存在"}</main>;

  const { project, summary } = data;
  const genHref =
    `/generate?projectId=${project.id}` +
    (project.targetUrl ? `&url=${encodeURIComponent(project.targetUrl)}` : "");

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/" className="text-xs text-slate-500 hover:text-sky-400">
            ← 全部项目
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{project.name}</h1>
          {project.targetUrl && (
            <p className="text-sm text-slate-500">{project.targetUrl}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={genHref} className="btn-primary">
            生成测试用例
          </Link>
          <button type="button" className="btn-ghost" onClick={() => setShowReqForm(true)}>
            + 导入需求
          </button>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card py-3">
          <p className="text-xs text-slate-500">需求数</p>
          <p className="text-xl font-semibold">{summary.requirementCount}</p>
        </div>
        <div className="card py-3">
          <p className="text-xs text-slate-500">AC 覆盖率</p>
          <p className="text-xl font-semibold text-sky-300">
            {summary.coverageRate === null ? "—" : `${summary.coverageRate}%`}
          </p>
          <p className="text-[10px] text-slate-600">
            {summary.acCovered}/{summary.acTotal} 条 AC 已关联用例
          </p>
        </div>
        <div className="card py-3">
          <p className="text-xs text-slate-500">最近通过率</p>
          <p className="text-xl font-semibold text-emerald-400">
            {summary.passRate === null ? "—" : `${summary.passRate}%`}
          </p>
        </div>
        <div className="card py-3">
          <p className="text-xs text-slate-500">未关联需求的用例</p>
          <p className="text-xl font-semibold text-amber-400">{data.unlinkedCases.length}</p>
        </div>
      </section>

      {showReqForm && (
        <form onSubmit={handleCreateRequirement} className="card space-y-3">
          <h2 className="text-sm font-semibold">粘贴需求文本</h2>
          <div>
            <label className="label" htmlFor="req-title">
              标题（可选）
            </label>
            <input
              id="req-title"
              className="input"
              value={reqTitle}
              onChange={(e) => setReqTitle(e.target.value)}
              placeholder="登录模块 v1"
            />
          </div>
          <div>
            <label className="label" htmlFor="req-body">
              需求正文 *
            </label>
            <textarea
              id="req-body"
              className="input min-h-[140px] font-mono text-xs"
              value={reqBody}
              onChange={(e) => setReqBody(e.target.value)}
              placeholder="每行一条验收要点，或使用 Given/When/Then 段落…"
            />
          </div>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "保存中…" : "保存并打开"}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setShowReqForm(false)}>
              取消
            </button>
          </div>
        </form>
      )}

      <section className="card">
        <h2 className="mb-3 text-sm font-semibold text-slate-400">需求列表</h2>
        {data.rows.length === 0 ? (
          <p className="text-sm text-slate-500">导入第一条需求后，可 AI 解析验收标准并生成用例。</p>
        ) : (
          <ul className="space-y-2">
            {data.rows.map((row) => (
              <li
                key={row.requirement.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 px-3 py-3"
              >
                <div>
                  <Link
                    href={`/projects/${id}/requirements/${row.requirement.id}`}
                    className="font-medium text-slate-100 hover:text-sky-300"
                  >
                    {row.requirement.title}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {REQ_STATUS[row.requirement.status] ?? row.requirement.status} ·{" "}
                    {row.requirement.acCount} AC · {row.requirement.caseCount} 用例
                  </p>
                </div>
                <div className="flex gap-2 text-xs">
                  {row.cases.slice(0, 3).map((c) => (
                    <Link
                      key={c.id}
                      href={`/tests/${c.id}`}
                      className="rounded bg-slate-800 px-2 py-1 text-slate-400 hover:text-sky-300"
                    >
                      {c.title.slice(0, 12)}
                      {c.lastRun?.status === "failed" ? " ✗" : c.lastRun ? " ✓" : ""}
                    </Link>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.unlinkedCases.length > 0 && (
        <section className="card">
          <h2 className="mb-2 text-sm font-semibold text-slate-400">未挂需求的用例</h2>
          <ul className="space-y-1 text-sm">
            {data.unlinkedCases.map((c) => (
              <li key={c.id}>
                <Link href={`/tests/${c.id}`} className="text-sky-400 hover:underline">
                  {c.title}
                </Link>
                <span className="ml-2 text-xs text-slate-600">{c.reviewStatus}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}