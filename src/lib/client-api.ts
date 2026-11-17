"use client";

import { createClient } from "@supabase/supabase-js";

/**
 * 客户端 fetch 封装：Supabase 模式下自动附加登录令牌。
 * 本地模式行为与原生 fetch 一致。
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function authConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

let cachedToken: string | null = null;

export function setAuthToken(token: string | null): void {
  cachedToken = token;
}

export async function signIn(email: string, password: string): Promise<void> {
  if (!authConfigured()) throw new Error("未配置 Supabase，当前为本地模式");
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  setAuthToken(data.session?.access_token ?? null);
}

export async function signUp(email: string, password: string): Promise<void> {
  if (!authConfigured()) throw new Error("未配置 Supabase，当前为本地模式");
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw error;
  setAuthToken(data.session?.access_token ?? null);
}

export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (cachedToken) headers.set("Authorization", `Bearer ${cachedToken}`);
  return fetch(input, { ...init, headers });
}
