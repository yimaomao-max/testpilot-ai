import type { Repo } from "./types";
import { MemoryRepo } from "./memory";
import { SupabaseRepo } from "./supabase";

let instance: Repo | null = null;

/**
 * 仓库工厂：配置了 Supabase 环境变量时使用 PostgreSQL（云端模式），
 * 否则回落到 JSON 文件存储（本地模式），保证全链路始终可用。
 */
export function getRepo(): Repo {
  if (!instance) {
    instance =
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
        ? new SupabaseRepo()
        : new MemoryRepo();
  }
  return instance;
}

export type { Repo } from "./types";
