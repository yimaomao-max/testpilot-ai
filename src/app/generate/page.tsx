"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type { CandidateTest } from "@/lib/ai";
import { STEP_TYPE_LABELS } from "@/lib/types";

const STEP_TITLES = ["Define Requirements", "Review, Edit and Select", "Generate Test Cases"];
const STEP_TITLES_ZH = ["填写需求", "评审并选择用例", "生成测试用例"];

function GeneratePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [url, setUrl] = useState("");
  const [requirements, setRequirements] = useState("");
  const [projectId, setProjectId] = useState("");
  const [requirementId, setRequirementId] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [candidates, setCandidates] = useState<(CandidateTest & { selected: boolean })[]>([]);
  const [source, setSource] = useState<"ai" | "rule">("ai");
  const [createdIds, setCreatedIds] = useState<string[]>([]);

  useEffect(() => {
    const u = searchParams.get("url");
    const r = searchParams.get("requirements");
    const pid = searchParams.get("projectId");
    const rid = searchParams.get("requirementId");
    if (u) setUrl(u);
    if (r) setRequirements(r);
    if (pid) setProjectId(pid);
    if (rid) setRequirementId(rid);
  }, [searchParams]);

  async function handleSuggest() {
    if (!url.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), requirements }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "生成失败");
      setResultUrl(data.url);
      setSource(data.source);
      setCandidates(
        (data.candidates as CandidateTest[]).map((c) => ({ ...c, selected: true }))
      );
      setStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    const selected = candidates.filter((c) => c.selected);
    if (selected.length === 0 || creating) return;
    setCreating(true);
    setError("");
    try {
      const ids: string[] = [];
      for (const c of selected) {
        const res = await fetch("/api/tests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: resultUrl,
            name: c.name,
            description: c.description,
            steps: c.steps,
            projectId: projectId || undefined,
            requirementId: requirementId || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "创建失败");
        ids.push(data.test.id);
      }
      if (requirementId) {
        await fetch(`/api/requirements/${requirementId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "generated" }),
        });
      }
      setCreatedIds(ids);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setCreating(false);
    }
  }

  const selectedCount = candidates.filter((c) => c.selected).length;

  return (
    <main className="space-y-6">
      <div className="card">
        <h1 className="mb-6 flex items-center gap-2 text-lg font-semibold">
          <span className="text-fuchsia-400">✦</span> 测试用例生成器
        </h1>
        {projectId && (
          <p className="mb-4 text-xs text-sky-400">
            已关联项目
            {requirementId ? "与需求" : ""}，新建的用例将写入追溯链。
          </p>
        )}

        {/* 步骤条 */}
        <div className="mx-auto mb-8 flex max-w-2xl items-center">
          {STEP_TITLES.map((title, i) => (
            <div key={title} className={`flex items-center ${i > 0 ? "flex-1" : ""}`}>
              {i > 0 && <div className={`mx-3 h-px flex-1 ${step >= i ? "bg-sky-500" : "bg-slate-700"}`} />}
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                    step > i
                      ? "bg-emerald-500 text-white"
                      : step === i
                        ? "bg-sky-500 text-white"
                        : "border border-slate-600 text-slate-500"
                  }`}
                >
                  {step > i ? "✓" : i + 1}
                </span>
                <span className={`text-sm ${step >= i ? "text-slate-200" : "text-slate-500"}`}>
                  {title}
                  <span className="ml-1 text-xs text-slate-500">{STEP_TITLES_ZH[i]}</span>
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* 第 1 步：填写需求 */}
        {step === 0 && (
          <div className="mx-auto max-w-2xl space-y-4">
            <div>
              <label className="label" htmlFor="gen-url">目标网站 URL *</label>
              <input
                id="gen-url"
                className="input"
                placeholder="例如：https://shop.example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="label" htmlFor="gen-req">
                  产品需求描述 <span className="text-slate-600">（可选，越具体覆盖越精准）</span>
                </label>
                <button className="text-xs text-sky-400 hover:underline" onClick={() => setRequirements("")}>
                  Clear
                </button>
              </div>
              <textarea
                id="gen-req"
                className="input min-h-40 resize-y"
                placeholder={`例如：\n- 允许用户使用 Visa / MasterCard / PayPal 完成支付\n- 支持在结账时选择币种（USD/EUR/GBP）\n- 支付失败时展示明确的错误信息`}
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <div className="flex justify-end">
              <button className="btn-primary" onClick={handleSuggest} disabled={!url.trim() || loading}>
                {loading ? "AI 分析中…" : "下一步：生成候选用例"}
              </button>
            </div>
          </div>
        )}

        {/* 第 2 步：评审并选择 */}
        {step === 1 && (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card flex flex-col">
              <h2 className="mb-3 text-sm font-semibold text-slate-300">
                Review, edit, and select test cases for AI to generate.
              </h2>
              <ul className="flex-1 space-y-2">
                {candidates.map((c, i) => (
                  <li
                    key={i}
                    className={`rounded-lg border p-3 transition-colors ${
                      c.selected ? "border-sky-700 bg-sky-950/30" : "border-slate-800"
                    }`}
                  >
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={c.selected}
                        onChange={(e) => {
                          const next = [...candidates];
                          next[i] = { ...c, selected: e.target.checked };
                          setCandidates(next);
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{c.name}</span>
                        {c.description && (
                          <span className="mt-0.5 block text-xs text-slate-400">{c.description}</span>
                        )}
                        <span className="mt-2 block text-[11px] text-slate-500">
                          {c.steps.length} 步：{" "}
                          {c.steps.map((s) => STEP_TYPE_LABELS[s.type]).join(" → ")}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-center justify-between">
                <button
                  className="btn-ghost"
                  onClick={handleGenerate}
                  disabled={selectedCount === 0 || creating}
                >
                  {creating ? "创建中…" : `✨ Generate (${selectedCount}) Test Cases`}
                </button>
              </div>
            </section>

            <section className="card flex flex-col">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-300">
                  Product Requirements <span className="text-rose-400">*</span>
                </h2>
                <button
                  className="text-xs text-sky-400 hover:underline"
                  onClick={() => setStep(0)}
                >
                  返回修改
                </button>
              </div>
              <p className="mb-1 text-xs text-slate-500">
                目标网站：<span className="text-slate-300">{resultUrl}</span>
              </p>
              <div className="flex-1 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm leading-relaxed text-slate-300">
                {requirements.trim() ? (
                  <ul className="list-disc space-y-1 pl-5">
                    {requirements.split(/\n+/).filter(Boolean).map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-slate-500">（未提供需求，按常见冒烟场景生成）</span>
                )}
              </div>
              <p className="mt-2 text-xs text-slate-600">
                {source === "ai" ? "由 AI 根据需求生成" : "AI 未配置，使用规则模式生成"}
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button className="btn-ghost" onClick={() => router.push("/tests")}>
                  Cancel
                </button>
                <button className="btn-primary" onClick={handleSuggest} disabled={loading}>
                  {loading ? "重新生成中…" : "✦ Regenerate Test Cases"}
                </button>
              </div>
            </section>
          </div>
        )}

        {/* 第 3 步：生成完成 */}
        {step === 2 && (
          <div className="mx-auto max-w-xl space-y-4 text-center">
            <p className="text-4xl">🎉</p>
            <h2 className="text-lg font-semibold">已创建 {createdIds.length} 个测试用例</h2>
            <p className="text-sm text-slate-400">现在可以运行测试、导出 Playwright 代码或查看报告</p>
            <div className="flex justify-center gap-3 pt-2">
              {createdIds[0] && (
                <Link href={`/tests/${createdIds[0]}`} className="btn-primary">
                  打开第一个用例
                </Link>
              )}
              {projectId ? (
                <Link href={`/projects/${projectId}`} className="btn-ghost">
                  回到项目工作台
                </Link>
              ) : (
                <button className="btn-ghost" onClick={() => router.push("/tests")}>
                  查看全部用例
                </button>
              )}
              <button
                className="btn-ghost"
                onClick={() => {
                  setStep(0);
                  setCreatedIds([]);
                  setCandidates([]);
                }}
              >
                再生成一批
              </button>
            </div>
          </div>
        )}

        {error && step > 0 && <p className="text-sm text-rose-400">{error}</p>}
      </div>
    </main>
  );
}

export default function GeneratePage() {
  return (
    <Suspense fallback={<main className="card text-sm text-slate-500">加载中…</main>}>
      <GeneratePageInner />
    </Suspense>
  );
}
