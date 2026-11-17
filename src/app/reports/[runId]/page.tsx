"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { RunResult } from "@/lib/types";
import { STEP_TYPE_LABELS } from "@/lib/types";

function Ring({ passed, failed }: { passed: number; failed: number }) {
  const size = 150;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = Math.max(1, passed + failed);
  const passedFrac = passed / total;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e293b" strokeWidth={stroke} />
      {passed > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#10b981"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${passedFrac * c * 0.92} ${c}`}
        />
      )}
      {failed > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r - stroke}
          fill="none"
          stroke="#f43f5e"
          strokeWidth={stroke * 0.7}
          strokeLinecap="round"
          strokeDasharray={`${(1 - passedFrac) * c * 0.7} ${c}`}
          strokeDashoffset={-passedFrac * c * 0.92}
        />
      )}
    </svg>
  );
}

export default function ReportPage() {
  const { runId } = useParams<{ runId: string }>();
  const [run, setRun] = useState<RunResult | null>(null);
  const [error, setError] = useState("");
  const [showPassed, setShowPassed] = useState(true);
  const [zoom, setZoom] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/runs/${runId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("运行记录不存在"))))
      .then((d) => setRun(d.run))
      .catch((e) => setError(e.message));
  }, [runId]);

  if (error) {
    return (
      <main className="card text-center">
        <p className="text-rose-400">{error}</p>
        {run?.testId && (
          <Link href={`/tests/${run.testId}`} className="btn-ghost mt-4">返回用例</Link>
        )}
      </main>
    );
  }
  if (!run) return <main className="card text-sm text-slate-500">加载中…</main>;

  const failedSteps = run.steps.filter((s) => s.status === "failed");
  const passedSteps = run.steps.filter((s) => s.status === "passed");
  const skippedSteps = run.steps.filter((s) => s.status === "skipped");

  return (
    <main className="space-y-6">
      <nav>
        <Link href={`/tests/${run.testId}`} className="text-sm text-slate-400 hover:text-sky-400">
          ← 返回用例「{run.testName}」
        </Link>
      </nav>

      {/* 顶部：圆环 + 元信息 */}
      <div className="grid gap-4 lg:grid-cols-5">
        <section className="card flex items-center gap-6 lg:col-span-2">
          <Ring passed={passedSteps.length} failed={failedSteps.length} />
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-emerald-400">
              ✓ {passedSteps.length} Passed
            </p>
            <p className="flex items-center gap-2 text-rose-400">
              ✗ {failedSteps.length} Failed
            </p>
            {skippedSteps.length > 0 && (
              <p className="text-xs text-slate-500">{skippedSteps.length} 步因失败跳过</p>
            )}
            <p
              className={`rounded px-2 py-0.5 text-center text-xs ${
                run.status === "passed"
                  ? "bg-emerald-950 text-emerald-400"
                  : "bg-rose-950 text-rose-400"
              }`}
            >
              {run.status === "passed" ? "report is complete" : "needs investigation"}
            </p>
          </div>
        </section>

        <section className="card space-y-2 text-sm lg:col-span-3">
          <div className="flex gap-2">
            <span className="w-24 shrink-0 text-slate-500">test URL:</span>
            <a href={run.url} target="_blank" rel="noreferrer" className="truncate text-sky-400 hover:underline">
              {run.url}
            </a>
          </div>
          <div className="flex gap-2">
            <span className="w-24 shrink-0 text-slate-500">用例:</span>
            <span>{run.testName}</span>
          </div>
          <div className="flex gap-2">
            <span className="w-24 shrink-0 text-slate-500">ran at:</span>
            <span>{new Date(run.startedAt).toLocaleString("zh-CN")}</span>
          </div>
          <div className="flex gap-2">
            <span className="w-24 shrink-0 text-slate-500">耗时:</span>
            <span>{(run.durationMs / 1000).toFixed(1)}s</span>
          </div>
          <div className="flex justify-between pt-2">
            <a className="btn-ghost" href={`/api/tests/${run.testId}/export?type=report&runId=${run.id}`}>
              导出 Markdown 报告
            </a>
            <button
              className="btn-primary"
              onClick={async () => {
                await fetch(`/api/tests/${run.testId}/run`, { method: "POST" });
                location.reload();
              }}
            >
              rerun all
            </button>
          </div>
        </section>
      </div>

      {/* 失败测试 */}
      {(failedSteps.length > 0 || run.aiAnalysis) && (
        <section className="card space-y-3 border-rose-900/60">
          <h2 className="flex items-center gap-2 font-semibold text-rose-400">
            ✗ failed steps
            <span className="text-xs font-normal text-slate-500">
              review all steps to determine whether there is a problem with your app or with the test
            </span>
          </h2>
          {run.aiAnalysis && (
            <div className="rounded-lg border border-amber-900/60 bg-amber-950/30 p-4">
              <h3 className="mb-2 text-sm font-semibold text-amber-400">🤖 AI 失败分析</h3>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-amber-100/90">
                {run.aiAnalysis}
              </div>
            </div>
          )}
          <ul className="space-y-3">
            {failedSteps.map((s) => (
              <li key={s.stepId} className="rounded-lg border border-rose-900/60 bg-rose-950/20 p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-rose-400">✗</span>
                  <span className="text-slate-500">#{s.index}</span>
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-sky-300">
                    {STEP_TYPE_LABELS[s.type]}
                  </span>
                  <span>{s.description ?? "-"}</span>
                  <span className="ml-auto text-xs text-slate-600">{s.durationMs}ms</span>
                </div>
                {s.error && (
                  <p className="mt-2 break-all rounded bg-slate-950 p-2 text-xs text-rose-300">{s.error}</p>
                )}
                {s.screenshot && (
                  <button
                    className="mt-2 block w-full max-w-md"
                    onClick={() => setZoom(`/api/screenshots/${run.id}/${s.screenshot}`)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/screenshots/${run.id}/${s.screenshot}`}
                      alt={`失败步骤 ${s.index} 截图`}
                      className="w-full rounded border border-slate-800 hover:opacity-90"
                    />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 通过测试 */}
      <section className="card">
        <button
          className="flex w-full items-center gap-2 font-semibold text-emerald-400"
          onClick={() => setShowPassed(!showPassed)}
        >
          ✓ passed steps
          <span className="text-xs font-normal text-slate-500">you are all good here</span>
          <span className="ml-auto text-slate-500">{showPassed ? "⌃" : "⌄"}</span>
        </button>
        {showPassed && (
          <ul className="mt-3 space-y-2">
            {passedSteps.length === 0 && <li className="text-sm text-slate-500">没有通过的步骤</li>}
            {passedSteps.map((s) => (
              <li key={s.stepId} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 p-2.5 text-sm">
                <span className="text-emerald-400">✓</span>
                <span className="text-slate-500">#{s.index}</span>
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-sky-300">
                  {STEP_TYPE_LABELS[s.type]}
                </span>
                <span className="text-slate-300">{s.description ?? "-"}</span>
                <span className="ml-auto text-xs text-slate-600">{s.durationMs}ms</span>
                {s.screenshot && (
                  <button className="text-xs text-sky-400 hover:underline" onClick={() => setZoom(`/api/screenshots/${run.id}/${s.screenshot}`)}>
                    截图
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 控制台日志 */}
      {run.consoleLogs.length > 0 && (
        <details className="card text-sm">
          <summary className="cursor-pointer text-slate-400">
            控制台日志（{run.consoleLogs.length}）
          </summary>
          <pre className="mt-2 max-h-60 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-400">
            {run.consoleLogs.join("\n")}
          </pre>
        </details>
      )}

      {/* 截图放大 */}
      {zoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setZoom(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="截图放大" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </main>
  );
}
