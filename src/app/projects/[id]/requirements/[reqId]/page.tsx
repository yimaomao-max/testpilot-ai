"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { AcceptanceCriterion, Requirement } from "@/lib/types";

export default function RequirementDetailPage() {
  const { id: projectId, reqId } = useParams() as { id: string; reqId: string };
  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [projectUrl, setProjectUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [parseSource, setParseSource] = useState<"ai" | "rule" | null>(null);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    Promise.all([
      fetch(`/api/requirements/${reqId}`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}`).then((r) => r.json()),
    ])
      .then(([reqJson, projJson]) => {
        if (reqJson.error) throw new Error(reqJson.error);
        setRequirement(reqJson.requirement);
        setBody(reqJson.requirement.body);
        setProjectUrl(projJson.project?.targetUrl ?? "");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [reqId, projectId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAnalyze() {
    setAnalyzing(true);
    setError("");
    try {
      const res = await fetch(`/api/requirements/${reqId}/analyze`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "解析失败");
      setRequirement(data.requirement);
      setParseSource(data.source);
    } catch (err) {
      setError(err instanceof Error ? err.message : "解析失败");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSaveBody() {
    if (!requirement || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/requirements/${reqId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, status: "draft" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      setRequirement(data.requirement);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  function handleAcField(idx: number, field: keyof AcceptanceCriterion, value: string) {
    if (!requirement?.acs) return;
    const acs = [...requirement.acs];
    acs[idx] = { ...acs[idx], [field]: value };
    setRequirement({ ...requirement, acs });
  }

  async function saveAcs() {
    if (!requirement?.acs) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/requirements/${reqId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acs: requirement.acs, status: requirement.status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      setRequirement(data.requirement);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="card text-sm text-slate-500">加载需求…</main>;
  if (!requirement) return <main className="card text-sm text-rose-400">{error || "不存在"}</main>;

  const generateHref =
    `/generate?projectId=${projectId}&requirementId=${reqId}` +
    (projectUrl ? `&url=${encodeURIComponent(projectUrl)}` : "") +
    `&requirements=${encodeURIComponent(body.slice(0, 2000))}`;

  return (
    <main className="space-y-6">
      <div>
        <Link href={`/projects/${projectId}`} className="text-xs text-slate-500 hover:text-sky-400">
          ← 项目工作台
        </Link>
        <h1 className="mt-1 text-xl font-bold">{requirement.title}</h1>
        <p className="text-xs text-slate-500">
          状态：{requirement.status}
          {parseSource && (
            <span className="ml-2 text-sky-400">最近解析：{parseSource === "ai" ? "AI" : "规则"}</span>
          )}
        </p>
      </div>

      <section className="card space-y-3">
        <h2 className="text-sm font-semibold text-slate-400">需求原文</h2>
        <textarea
          className="input min-h-[120px] font-mono text-xs"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" onClick={handleSaveBody} disabled={saving}>
            保存正文
          </button>
          <button type="button" className="btn-primary" onClick={handleAnalyze} disabled={analyzing}>
            {analyzing ? "AI 解析中…" : "解析场景与 AC"}
          </button>
          <Link href={generateHref} className="btn-primary">
            据此生成用例 →
          </Link>
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
      </section>

      {requirement.scenarios && requirement.scenarios.length > 0 && (
        <section className="card">
          <h2 className="mb-2 text-sm font-semibold text-slate-400">业务场景</h2>
          <ul className="space-y-2 text-sm">
            {requirement.scenarios.map((s, i) => (
              <li key={i} className="rounded-lg bg-slate-800/50 px-3 py-2">
                <span className="font-medium">{s.name}</span>
                {s.actor && <span className="text-slate-500"> · {s.actor}</span>}
                {s.preconditions?.length ? (
                  <ul className="mt-1 list-inside list-disc text-xs text-slate-500">
                    {s.preconditions.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-400">验收标准 (AC)</h2>
          {requirement.acs && requirement.acs.length > 0 && (
            <button type="button" className="btn-ghost text-xs" onClick={saveAcs} disabled={saving}>
              保存 AC 编辑
            </button>
          )}
        </div>
        {!requirement.acs?.length ? (
          <p className="text-sm text-slate-500">点击「解析场景与 AC」从需求文本提取验收标准。</p>
        ) : (
          <ul className="space-y-3">
            {requirement.acs.map((ac, idx) => (
              <li key={ac.id} className="rounded-lg border border-slate-800 p-3 text-sm">
                <p className="mb-2 font-mono text-xs text-sky-400">{ac.code}</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div>
                    <span className="label">Given</span>
                    <input
                      className="input text-xs"
                      value={ac.given}
                      onChange={(e) => handleAcField(idx, "given", e.target.value)}
                    />
                  </div>
                  <div>
                    <span className="label">When</span>
                    <input
                      className="input text-xs"
                      value={ac.when}
                      onChange={(e) => handleAcField(idx, "when", e.target.value)}
                    />
                  </div>
                  <div>
                    <span className="label">Then</span>
                    <input
                      className="input text-xs"
                      value={ac.then}
                      onChange={(e) => handleAcField(idx, "then", e.target.value)}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}