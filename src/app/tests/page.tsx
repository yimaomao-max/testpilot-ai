"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { TestCase } from "@/lib/types";
import { STEP_TYPE_LABELS } from "@/lib/types";

export default function TestListPage() {
  const [tests, setTests] = useState<TestCase[]>([]);
  const [url, setUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/tests");
    const data = await res.json();
    setTests(data.tests ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || creating) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "创建失败");
      setUrl("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">测试用例</h1>
        <Link href="/generate" className="btn-primary">
          ✨ 打开生成器
        </Link>
      </div>

      <form onSubmit={handleCreate} className="card space-y-3">
        <label className="label" htmlFor="url">
          快速创建：输入目标网站 URL，AI 自动生成冒烟步骤
        </label>
        <div className="flex gap-2">
          <input
            id="url"
            className="input flex-1"
            placeholder="例如：https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={creating || !url.trim()}>
            {creating ? "AI 生成中…" : "生成测试"}
          </button>
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
      </form>

      {tests.length === 0 ? (
        <div className="card text-center text-sm text-slate-500">
          还没有测试用例，输入 URL 或使用生成器开始创建
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {tests.map((t) => (
            <li key={t.id}>
              <Link
                href={`/tests/${t.id}`}
                className="card block transition-colors hover:border-sky-700"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{t.name}</span>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
                      t.source === "ai"
                        ? "bg-sky-950 text-sky-400"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {t.source === "ai" ? "AI 生成" : t.source === "manual" ? "向导创建" : "规则生成"}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">{t.url}</p>
                <p className="mt-3 text-xs text-slate-400">
                  {t.steps.length} 个步骤 ·{" "}
                  {t.steps
                    .slice(0, 3)
                    .map((s) => STEP_TYPE_LABELS[s.type])
                    .join(" → ")}
                  {t.steps.length > 3 ? " …" : ""}
                </p>
                <p className="mt-1 text-[11px] text-slate-600">
                  更新于 {new Date(t.updatedAt).toLocaleString("zh-CN")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
