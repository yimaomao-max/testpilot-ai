"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { RunResult, StepType, TestCase, TestStep } from "@/lib/types";
import { STEP_TYPE_LABELS } from "@/lib/types";

const STEP_TYPE_OPTIONS: StepType[] = [
  "click",
  "fill",
  "press",
  "waitForSelector",
  "expectText",
  "expectVisible",
  "wait",
  "screenshot",
];

export default function TestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [test, setTest] = useState<TestCase | null>(null);
  const [runs, setRuns] = useState<RunResult[]>([]);
  const [selectedRun, setSelectedRun] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  // 步骤编辑状态
  const [steps, setSteps] = useState<TestStep[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newStep, setNewStep] = useState<{ type: StepType; selector: string; value: string; description: string }>({
    type: "click",
    selector: "",
    value: "",
    description: "",
  });

  const load = useCallback(async () => {
    const res = await fetch(`/api/tests/${id}`);
    if (!res.ok) {
      setError("测试不存在");
      return;
    }
    const data = await res.json();
    setTest(data.test);
    setSteps(data.test.steps);
    setRuns(data.runs ?? []);
    setSelectedRun((prev) => (prev ? (data.runs ?? []).find((r: RunResult) => r.id === prev.id) ?? (data.runs?.[0] ?? null) : (data.runs?.[0] ?? null)));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const statusIcon = (s: string) =>
    s === "passed" ? "✅" : s === "failed" ? "❌" : "⏭";

  async function handleRun() {
    if (running) return;
    setRunning(true);
    setError("");
    try {
      const res = await fetch(`/api/tests/${id}/run`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "执行失败");
      await load();
      setSelectedRun(data.run);
    } catch (err) {
      setError(err instanceof Error ? err.message : "执行失败");
    } finally {
      setRunning(false);
    }
  }

  async function handleSaveSteps() {
    setSaving(true);
    try {
      const res = await fetch(`/api/tests/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      setTest(data.test);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("确定删除该测试用例及其步骤吗？")) return;
    await fetch(`/api/tests/${id}`, { method: "DELETE" });
    router.push("/tests");
  }

  function addStep() {
    if (!newStep.selector && !["wait", "screenshot"].includes(newStep.type)) return;
    const step: TestStep = {
      id: `s${Date.now().toString(36)}`,
      type: newStep.type,
      selector: newStep.selector.trim() || undefined,
      value: newStep.value.trim() || undefined,
      description: newStep.description.trim() || undefined,
    };
    setSteps([...steps, step]);
    setDirty(true);
    setNewStep({ type: "click", selector: "", value: "", description: "" });
  }

  const lastStatus = useMemo(() => runs[0]?.status, [runs]);

  if (error && !test) {
    return (
      <main className="card text-center">
        <p className="text-rose-400">{error}</p>
        <Link href="/" className="btn-ghost mt-4">
          返回首页
        </Link>
      </main>
    );
  }
  if (!test) return <main className="card text-sm text-slate-500">加载中…</main>;

  return (
    <main className="space-y-6">
      <nav>
        <Link href="/tests" className="text-sm text-slate-400 hover:text-sky-400">
          ← 返回测试列表
        </Link>
      </nav>

      <header className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">{test.name}</h1>
            <a
              href={test.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block truncate text-sm text-sky-400 hover:underline"
            >
              {test.url}
            </a>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={handleRun} disabled={running}>
              {running ? "执行中…" : "▶ 运行测试"}
            </button>
            <Link className="btn-ghost" href={`/tests/${id}/code`}>
              查看代码
            </Link>
            <a className="btn-ghost" href={`/api/tests/${id}/export?type=code`}>
              导出 .spec.ts
            </a>
            <button className="btn-danger" onClick={handleDelete}>
              删除
            </button>
          </div>
        </div>
        {lastStatus && (
          <p className="mt-3 text-sm text-slate-400">
            最近一次运行：{lastStatus === "passed" ? "✅ 通过" : "❌ 失败"} ·{" "}
            {new Date(runs[0].startedAt).toLocaleString("zh-CN")}
          </p>
        )}
        {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
      </header>

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-400">测试步骤（{steps.length}）</h2>
          {dirty && (
            <button className="btn-primary" onClick={handleSaveSteps} disabled={saving}>
              {saving ? "保存中…" : "保存步骤修改"}
            </button>
          )}
        </div>

        <ol className="space-y-2">
          {steps.map((s, i) => (
            <li key={s.id} className="flex items-center gap-3 rounded-lg bg-slate-950 px-3 py-2 text-sm">
              <span className="w-5 text-center text-xs text-slate-500">{i + 1}</span>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-sky-300">
                {STEP_TYPE_LABELS[s.type]}
              </span>
              {s.selector && (
                <code className="truncate text-xs text-slate-400">{s.selector}</code>
              )}
              {s.value && <span className="truncate text-xs text-slate-400">“{s.value}”</span>}
              <span className="flex-1 truncate text-right text-xs text-slate-500">
                {s.description}
              </span>
              <button
                className="text-xs text-slate-600 hover:text-rose-400"
                title="删除步骤"
                onClick={() => {
                  setSteps(steps.filter((x) => x.id !== s.id));
                  setDirty(true);
                }}
              >
                ✕
              </button>
            </li>
          ))}
          {steps.length === 0 && (
            <li className="text-sm text-slate-500">暂无步骤，可在下方手动添加</li>
          )}
        </ol>

        <div className="grid gap-2 border-t border-slate-800 pt-3 md:grid-cols-[120px_1fr_1fr_1fr_auto]">
          <select
            className="input"
            value={newStep.type}
            onChange={(e) => setNewStep({ ...newStep, type: e.target.value as StepType })}
          >
            {STEP_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {STEP_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <input
            className="input"
            placeholder="选择器（如 header、text=登录）"
            value={newStep.selector}
            onChange={(e) => setNewStep({ ...newStep, selector: e.target.value })}
          />
          <input
            className="input"
            placeholder="值（文本 / 按键 / 毫秒）"
            value={newStep.value}
            onChange={(e) => setNewStep({ ...newStep, value: e.target.value })}
          />
          <input
            className="input"
            placeholder="步骤说明（可选）"
            value={newStep.description}
            onChange={(e) => setNewStep({ ...newStep, description: e.target.value })}
          />
          <button className="btn-ghost" onClick={addStep}>
            添加
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-400">运行历史（{runs.length}）</h2>
        {runs.length === 0 ? (
          <div className="card text-sm text-slate-500">还没有运行记录，点击「运行测试」开始</div>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {runs.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => setSelectedRun(r)}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                    selectedRun?.id === r.id
                      ? "border-sky-600 bg-sky-950 text-sky-300"
                      : "border-slate-800 text-slate-400 hover:bg-slate-900"
                  }`}
                >
                  {statusIcon(r.status)} {new Date(r.startedAt).toLocaleTimeString("zh-CN")} ·{" "}
                  {(r.durationMs / 1000).toFixed(1)}s
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedRun && (
        <section className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-400">
              测试报告 ·{" "}
              <span className={selectedRun.status === "passed" ? "text-emerald-400" : "text-rose-400"}>
                {selectedRun.status === "passed" ? "通过" : "失败"}
              </span>
            </h2>
            <div className="flex gap-2">
              <Link className="btn-primary" href={`/reports/${selectedRun.id}`}>
                查看完整报告 →
              </Link>
              <a
                className="btn-ghost"
                href={`/api/tests/${id}/export?type=report&runId=${selectedRun.id}`}
              >
                导出 Markdown 报告
              </a>
            </div>
          </div>

          <ol className="space-y-3">
            {selectedRun.steps.map((s) => (
              <li key={s.stepId} className="rounded-lg border border-slate-800 p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span>{statusIcon(s.status)}</span>
                  <span className="text-slate-500">#{s.index}</span>
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-sky-300">
                    {STEP_TYPE_LABELS[s.type]}
                  </span>
                  <span className="text-slate-300">{s.description ?? "-"}</span>
                  <span className="ml-auto text-xs text-slate-600">{s.durationMs}ms</span>
                </div>
                {s.error && (
                  <p className="mt-2 break-all rounded bg-rose-950/50 p-2 text-xs text-rose-300">
                    {s.error}
                  </p>
                )}
                {s.screenshot && (
                  <a
                    href={`/api/screenshots/${selectedRun.id}/${s.screenshot}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/screenshots/${selectedRun.id}/${s.screenshot}`}
                      alt={`步骤 ${s.index} 截图`}
                      className="w-full max-w-md rounded border border-slate-800 hover:opacity-90"
                    />
                  </a>
                )}
              </li>
            ))}
          </ol>

          {selectedRun.aiAnalysis && (
            <div className="rounded-lg border border-amber-900/60 bg-amber-950/30 p-4">
              <h3 className="mb-2 text-sm font-semibold text-amber-400">🤖 AI 失败分析</h3>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-amber-100/90">
                {selectedRun.aiAnalysis}
              </div>
            </div>
          )}

          {selectedRun.consoleLogs.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-slate-400">
                控制台日志（{selectedRun.consoleLogs.length}）
              </summary>
              <pre className="mt-2 max-h-60 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-400">
                {selectedRun.consoleLogs.join("\n")}
              </pre>
            </details>
          )}
        </section>
      )}
    </main>
  );
}
