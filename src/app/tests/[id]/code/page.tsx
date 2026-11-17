"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

/** 轻量语法高亮：关键字 / 字符串 / 注释 / URL */
function highlightLine(line: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /(\/\/.*$)|('[^']*')|\b(import|from|await|async|const|test|expect)\b/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) parts.push(line.slice(last, m.index));
    const cls = m[1]
      ? "text-slate-500 italic"
      : m[2]
        ? "text-emerald-400"
        : "text-violet-400";
    parts.push(
      <span key={key++} className={cls}>
        {m[0]}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return parts;
}

export default function CodePage() {
  const { id } = useParams<{ id: string }>();
  const [test, setTest] = useState<{ name: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/tests/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("加载失败"))))
      .then((d) => setTest(d.test))
      .catch((e) => setError(e.message));
    fetch(`/api/tests/${id}/export?type=code`)
      .then((r) => r.text())
      .then(setCode);
  }, [id]);

  const lines = useMemo(() => code.replace(/\n$/, "").split("\n"), [code]);

  if (error) {
    return (
      <main className="card text-center">
        <p className="text-rose-400">{error}</p>
        <Link href={`/tests/${id}`} className="btn-ghost mt-4">返回详情</Link>
      </main>
    );
  }

  return (
    <main className="space-y-4">
      <nav className="flex items-center justify-between">
        <Link href={`/tests/${id}`} className="text-sm text-slate-400 hover:text-sky-400">
          ← 返回用例详情
        </Link>
        <a className="btn-ghost" href={`/api/tests/${id}/export?type=code`}>
          下载 .spec.ts
        </a>
      </nav>

      <h1 className="text-xl font-bold">
        Playwright 代码{test ? <span className="ml-2 text-sm font-normal text-slate-500">{test.name}</span> : null}
      </h1>

      {/* 编辑器外观 */}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-950 px-4 py-2.5">
          <span className="text-lg text-amber-400">△</span>
          <span className="rounded bg-slate-800 px-3 py-1 text-xs text-slate-300">
            {id}.spec.ts
          </span>
          <span className="ml-auto text-xs text-slate-600">TypeScript · UTF-8 · LF</span>
        </div>
        <div className="overflow-auto">
          <pre className="min-w-max px-0 py-3 font-mono text-[13px] leading-6">
            {lines.map((line, i) => (
              <div key={i} className="flex hover:bg-slate-800/40">
                <span className="w-12 shrink-0 select-none pr-4 text-right text-slate-600">
                  {i + 1}
                </span>
                <code className="text-slate-300">{highlightLine(line)}</code>
              </div>
            ))}
            {lines.length === 0 && <div className="px-4 text-slate-500">加载中…</div>}
          </pre>
        </div>
        <div className="flex items-center gap-6 border-t border-slate-800 bg-slate-950 px-4 py-1.5 text-xs text-slate-500">
          <span>0 错误 · 0 警告</span>
          <span>Ln {lines.length}, Col 1</span>
          <span className="ml-auto">由 TestPilot AI 生成</span>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        提示：将该文件放入含 @playwright/test 的项目的 tests/ 目录即可直接运行（npm init playwright@latest 初始化项目）。
      </p>
    </main>
  );
}
