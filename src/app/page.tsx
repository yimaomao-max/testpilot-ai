"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Stats {
  totalTests: number;
  totalRuns: number;
  passRate: number | null;
  distribution: { passed: number; failed: number; notRun: number };
  trend: { date: string; total: number; failed: number }[];
  tests: {
    id: string;
    name: string;
    url: string;
    stepCount: number;
    source: string;
    updatedAt: string;
    lastRun: { id: string; status: string; startedAt: string; durationMs: number } | null;
  }[];
}

function Donut({ percent }: { percent: number | null }) {
  const size = 140;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const value = percent ?? 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e293b" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={percent === null ? "#475569" : value >= 80 ? "#10b981" : value >= 50 ? "#f59e0b" : "#f43f5e"}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${(value / 100) * c} ${c}`}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-slate-100 text-2xl font-bold"
        transform={`rotate(90 ${size / 2} ${size / 2})`}
      >
        {percent === null ? "—" : `${percent}%`}
      </text>
    </svg>
  );
}

function Bars({ dist }: { dist: { passed: number; failed: number; notRun: number } }) {
  const items = [
    { label: "通过", value: dist.passed, color: "bg-emerald-500" },
    { label: "失败", value: dist.failed, color: "bg-rose-500" },
    { label: "未运行", value: dist.notRun, color: "bg-slate-600" },
  ];
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="flex h-44 items-end gap-8 px-4">
      {items.map((i) => (
        <div key={i.label} className="flex flex-1 flex-col items-center gap-2">
          <span className="text-sm text-slate-300">{i.value}</span>
          <div
            className={`w-full max-w-16 rounded-t ${i.color}`}
            style={{ height: `${(i.value / max) * 120}px` }}
          />
          <span className="text-xs text-slate-500">{i.label}</span>
        </div>
      ))}
    </div>
  );
}

function Trend({ trend }: { trend: { date: string; total: number; failed: number }[] }) {
  const w = 560;
  const h = 160;
  const max = Math.max(1, ...trend.map((t) => t.total));
  const pt = (v: number, i: number) =>
    `${(i / (trend.length - 1)) * (w - 20) + 10},${h - 10 - (v / max) * (h - 30)}`;
  const totalPts = trend.map((t, i) => pt(t.total, i)).join(" ");
  const failedPts = trend.map((t, i) => pt(t.failed, i)).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      <polyline points={totalPts} fill="none" stroke="#38bdf8" strokeWidth="2" />
      <polyline points={failedPts} fill="none" stroke="#fb7185" strokeWidth="2" />
      {trend.map((t, i) => (
        <circle key={i} cx={pt(t.total, i).split(",")[0]} cy={pt(t.total, i).split(",")[1]} r="2.5" fill="#38bdf8" />
      ))}
    </svg>
  );
}

const STATUS_BADGE: Record<string, string> = {
  passed: "bg-emerald-950 text-emerald-400",
  failed: "bg-rose-950 text-rose-400",
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => undefined);
  }, []);

  if (!stats) return <main className="card text-sm text-slate-500">加载中…</main>;

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">总览</h1>
        <Link href="/generate" className="btn-primary">
          ✨ 生成新测试
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card flex items-center gap-6">
          <Donut percent={stats.passRate} />
          <div className="space-y-2 text-sm">
            <p className="font-medium text-slate-300">最近一次通过率</p>
            <p className="text-slate-500">
              共 {stats.totalTests} 个用例 · 累计 {stats.totalRuns} 次运行
            </p>
            <div className="flex gap-4 pt-2">
              <div>
                <p className="text-xs text-slate-500">通过</p>
                <p className="text-lg font-semibold text-emerald-400">{stats.distribution.passed}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">失败</p>
                <p className="text-lg font-semibold text-rose-400">{stats.distribution.failed}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">未运行</p>
                <p className="text-lg font-semibold text-slate-400">{stats.distribution.notRun}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <h2 className="mb-2 text-sm font-semibold text-slate-400">用例状态分布</h2>
          <Bars dist={stats.distribution} />
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="card lg:col-span-3">
          <h2 className="mb-2 text-sm font-semibold text-slate-400">近 14 天运行趋势</h2>
          <div className="flex gap-4 pb-1 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <i className="inline-block h-2 w-2 rounded-full bg-sky-400" /> 总运行
            </span>
            <span className="flex items-center gap-1">
              <i className="inline-block h-2 w-2 rounded-full bg-rose-400" /> 失败
            </span>
          </div>
          <Trend trend={stats.trend} />
          <div className="flex justify-between text-[10px] text-slate-600">
            {stats.trend.filter((_, i) => i % 3 === 0).map((t) => (
              <span key={t.date}>{t.date}</span>
            ))}
          </div>
        </section>

        <section className="card lg:col-span-2 overflow-hidden">
          <h2 className="mb-3 text-sm font-semibold text-slate-400">用例汇总</h2>
          <div className="max-h-64 space-y-2 overflow-auto">
            {stats.tests.length === 0 && (
              <p className="text-sm text-slate-500">还没有测试用例，去「生成器」创建第一个</p>
            )}
            {stats.tests.map((t) => (
              <Link
                key={t.id}
                href={`/tests/${t.id}`}
                className="flex items-center gap-3 rounded-lg border border-slate-800 px-3 py-2 text-sm hover:border-sky-700"
              >
                {t.lastRun ? (
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${STATUS_BADGE[t.lastRun.status]}`}>
                    {t.lastRun.status === "passed" ? "通过" : "失败"}
                  </span>
                ) : (
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">未运行</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{t.name}</span>
                  <span className="block truncate text-xs text-slate-500">{t.url}</span>
                </span>
                <span className="text-xs text-slate-600">{t.stepCount} 步</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
