"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Project {
  id: string;
  name: string;
  targetUrl: string;
  description?: string;
  createdAt: string;
}

interface StatsLite {
  totalTests: number;
  totalRuns: number;
  passRate: number | null;
}

export default function ProjectsHubPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<StatsLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/projects").then((r) => r.json()),
      fetch("/api/stats").then((r) => r.json()),
    ])
      .then(([p, s]) => {
        setProjects(p.projects ?? []);
        setStats({
          totalTests: s.totalTests ?? 0,
          totalRuns: s.totalRuns ?? 0,
          passRate: s.passRate ?? null,
        });
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || creating) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, targetUrl, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "创建失败");
      router.push(`/projects/${data.project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <main className="card text-sm text-slate-500">加载中…</main>;

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">项目工作台</h1>
          <p className="mt-1 text-sm text-slate-500">
            需求 → 验收标准 → 用例 → 执行追溯（Phase 2）
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/generate" className="btn-ghost">
            生成器
          </Link>
          <button type="button" className="btn-primary" onClick={() => setShowForm((v) => !v)}>
            + 新建项目
          </button>
        </div>
      </div>

      {stats && (
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="card py-3">
            <p className="text-xs text-slate-500">测试用例</p>
            <p className="text-2xl font-semibold text-sky-300">{stats.totalTests}</p>
          </div>
          <div className="card py-3">
            <p className="text-xs text-slate-500">累计运行</p>
            <p className="text-2xl font-semibold text-slate-200">{stats.totalRuns}</p>
          </div>
          <div className="card py-3">
            <p className="text-xs text-slate-500">最近通过率</p>
            <p className="text-2xl font-semibold text-emerald-400">
              {stats.passRate === null ? "—" : `${stats.passRate}%`}
            </p>
          </div>
        </section>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="card mx-auto max-w-xl space-y-3">
          <h2 className="text-sm font-semibold text-slate-300">新建项目</h2>
          <div>
            <label className="label" htmlFor="proj-name">
              项目名称 *
            </label>
            <input
              id="proj-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：官网回归"
            />
          </div>
          <div>
            <label className="label" htmlFor="proj-url">
              目标站点 URL
            </label>
            <input
              id="proj-url"
              className="input"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://example.com"
            />
          </div>
          <div>
            <label className="label" htmlFor="proj-desc">
              备注
            </label>
            <input
              id="proj-desc"
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={creating}>
              {creating ? "创建中…" : "创建并进入"}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>
              取消
            </button>
          </div>
        </form>
      )}

      <section className="card">
        <h2 className="mb-4 text-sm font-semibold text-slate-400">我的项目</h2>
        {projects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-700 px-6 py-10 text-center text-sm text-slate-500">
            还没有项目。点击「新建项目」开始，或先用{" "}
            <Link href="/generate" className="text-sky-400 hover:underline">
              生成器
            </Link>{" "}
            快速创建用例。
          </div>
        ) : (
          <ul className="divide-y divide-slate-800">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-4 transition-colors hover:bg-slate-800/30 px-2 -mx-2 rounded-lg"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-100">{p.name}</p>
                    {p.targetUrl && (
                      <p className="truncate text-xs text-slate-500">{p.targetUrl}</p>
                    )}
                    {p.description && (
                      <p className="mt-0.5 text-xs text-slate-600">{p.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-sky-400">进入工作台 →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}