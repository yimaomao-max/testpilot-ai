"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authConfigured, setAuthToken, signIn, signUp } from "@/lib/client-api";

export default function LoginPage() {
  const router = useRouter();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((d) => setConfigured(!!d.authEnabled))
      .catch(() => setConfigured(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (mode === "signin") await signIn(email, password);
      else await signUp(email, password);
      setAuthToken((await sessionToken()) ?? null);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  async function sessionToken(): Promise<string | null> {
    if (!authConfigured()) return null;
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await sb.auth.getSession();
    return data.session?.access_token ?? null;
  }

  if (configured === null) {
    return <main className="card text-sm text-slate-500">加载中…</main>;
  }

  return (
    <main className="mx-auto max-w-md space-y-6 pt-8">
      <h1 className="text-center text-2xl font-bold">
        登录 Spec2Test <span className="text-sky-400">AI</span>
      </h1>

      {!configured ? (
        <div className="card space-y-3 text-center">
          <p className="text-sm text-slate-300">当前为本地模式（未配置 Supabase）</p>
          <p className="text-xs text-slate-500">
            数据保存在本机 data/ 目录，无需登录即可使用全部功能。
            配置 NEXT_PUBLIC_SUPABASE_URL 与 NEXT_PUBLIC_SUPABASE_ANON_KEY 后启用云端账号。
          </p>
          <Link href="/" className="btn-primary">
            进入工作台
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label" htmlFor="email">邮箱</label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="password">密码</label>
            <input
              id="password"
              type="password"
              className="input"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "处理中…" : mode === "signin" ? "登录" : "注册"}
          </button>
          <button
            type="button"
            className="w-full text-center text-xs text-slate-400 hover:text-sky-400"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "没有账号？注册" : "已有账号？登录"}
          </button>
        </form>
      )}
    </main>
  );
}
