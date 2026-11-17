import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Project, Requirement, RunResult, TestCase } from "../types";
import type { Repo } from "./types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

type Row = Record<string, unknown>;

function rowToRequirement(r: Row): Requirement {
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    title: r.title as string,
    body: r.body as string,
    source: (r.source as Requirement["source"]) ?? "paste",
    status: (r.status as Requirement["status"]) ?? "draft",
    scenarios: (r.scenarios as Requirement["scenarios"]) ?? undefined,
    acs: (r.acs as Requirement["acs"]) ?? undefined,
    createdAt: r.created_at as string,
  };
}

/** 服务端实现：service role key 直连（绕过 RLS，由业务层保证归属） */
export class SupabaseRepo implements Repo {
  private sb: SupabaseClient;

  constructor() {
    this.sb = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });
  }

  // ---------- 项目 ----------
  async listProjects(): Promise<Project[]> {
    const { data, error } = await this.sb
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(
      (r: Row): Project => ({
        id: r.id as string,
        name: r.name as string,
        targetUrl: (r.target_url as string) ?? "",
        description: (r.description as string) ?? undefined,
        createdAt: r.created_at as string,
      })
    );
  }

  async getProject(id: string): Promise<Project | null> {
    const { data, error } = await this.sb.from("projects").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id,
      name: data.name,
      targetUrl: data.target_url ?? "",
      description: data.description ?? undefined,
      createdAt: data.created_at,
    };
  }

  async saveProject(project: Project): Promise<Project> {
    const row = {
      id: project.id,
      name: project.name,
      target_url: project.targetUrl,
      description: project.description ?? null,
      created_at: project.createdAt,
    };
    const { error } = await this.sb.from("projects").upsert(row);
    if (error) throw error;
    return project;
  }

  async deleteProject(id: string): Promise<boolean> {
    const { error, count } = await this.sb.from("projects").delete({ count: "exact" }).eq("id", id);
    if (error) throw error;
    return (count ?? 0) > 0;
  }

  // ---------- 需求 ----------
  async listRequirements(projectId: string): Promise<Requirement[]> {
    const { data, error } = await this.sb
      .from("requirements")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(rowToRequirement);
  }

  async getRequirement(id: string): Promise<Requirement | null> {
    const { data, error } = await this.sb.from("requirements").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? rowToRequirement(data) : null;
  }

  async saveRequirement(requirement: Requirement): Promise<Requirement> {
    const row = {
      id: requirement.id,
      project_id: requirement.projectId,
      title: requirement.title,
      body: requirement.body,
      source: requirement.source,
      status: requirement.status,
      scenarios: requirement.scenarios ?? null,
      acs: requirement.acs ?? null,
      created_at: requirement.createdAt,
    };
    const { error } = await this.sb.from("requirements").upsert(row);
    if (error) throw error;
    return requirement;
  }

  async deleteRequirement(id: string): Promise<boolean> {
    const { error, count } = await this.sb
      .from("requirements")
      .delete({ count: "exact" })
      .eq("id", id);
    if (error) throw error;
    return (count ?? 0) > 0;
  }

  // ---------- 测试用例（data jsonb 存完整对象，规范化列用于追溯查询） ----------
  async listTests(projectId?: string): Promise<TestCase[]> {
    let query = this.sb.from("test_cases").select("data");
    if (projectId) query = query.eq("project_id", projectId);
    const { data, error } = await query;
    if (error) throw error;
    return ((data ?? []) as { data: TestCase }[])
      .map((r) => r.data)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getTest(id: string): Promise<TestCase | null> {
    const { data, error } = await this.sb.from("test_cases").select("data").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? (data.data as TestCase) : null;
  }

  async saveTest(test: TestCase): Promise<TestCase> {
    const row = {
      id: test.id,
      project_id: test.projectId ?? null,
      requirement_id: test.requirementId ?? null,
      code: test.code ?? null,
      title: test.name,
      review_status: test.reviewStatus ?? "unreviewed",
      source: test.source,
      url: test.url,
      ac_ids: test.acIds ?? null,
      data: test,
      created_at: test.createdAt,
      updated_at: test.updatedAt,
    };
    const { error } = await this.sb.from("test_cases").upsert(row);
    if (error) throw error;
    return test;
  }

  async deleteTest(id: string): Promise<boolean> {
    const { error, count } = await this.sb.from("test_cases").delete({ count: "exact" }).eq("id", id);
    if (error) throw error;
    return (count ?? 0) > 0;
  }

  // ---------- 运行记录 ----------
  async saveRun(run: RunResult): Promise<RunResult> {
    const row = {
      id: run.id,
      project_id: null, // Phase 4 Runner 上报时补齐
      test_id: run.testId,
      trigger: "manual",
      status: run.status,
      started_at: run.startedAt,
      duration_ms: run.durationMs,
      summary: {
        passed: run.steps.filter((s) => s.status === "passed").length,
        failed: run.steps.filter((s) => s.status === "failed").length,
        skipped: run.steps.filter((s) => s.status === "skipped").length,
      },
      data: run,
      created_at: run.startedAt,
    };
    const { error } = await this.sb.from("test_runs").upsert(row);
    if (error) throw error;
    return run;
  }

  async getRun(id: string): Promise<RunResult | null> {
    const { data, error } = await this.sb.from("test_runs").select("data").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? (data.data as RunResult) : null;
  }

  async listRunsByTest(testId: string): Promise<RunResult[]> {
    const { data, error } = await this.sb
      .from("test_runs")
      .select("data")
      .eq("test_id", testId);
    if (error) throw error;
    return ((data ?? []) as { data: RunResult }[])
      .map((r) => r.data)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async listAllRuns(): Promise<RunResult[]> {
    const { data, error } = await this.sb.from("test_runs").select("data");
    if (error) throw error;
    return ((data ?? []) as { data: RunResult }[])
      .map((r) => r.data)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }
}
