import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** 是否已配置 Supabase Auth；未配置时为本地单用户模式 */
export function authEnabled(): boolean {
  return Boolean(SUPABASE_URL && ANON_KEY);
}

export interface AuthUser {
  id: string;
  email?: string;
}

/**
 * 从请求头 Authorization: Bearer <supabase-access-token> 验证用户。
 * 本地模式（未配置 Supabase）返回固定本地用户，不拦截。
 */
export async function getAuthUser(req: Request): Promise<AuthUser | null> {
  if (!authEnabled()) return { id: "local-user" };
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const sb = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? undefined };
}

/** 鉴权守卫：已配置 Supabase 且未携带有效 token 时返回 401 响应，否则返回 null（放行） */
export async function requireAuth(
  req: Request
): Promise<Response | null> {
  const user = await getAuthUser(req);
  if (user) return null;
  return new Response(JSON.stringify({ error: "未登录" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
