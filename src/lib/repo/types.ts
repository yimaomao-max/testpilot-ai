import type { Project, Requirement, RunResult, TestCase } from "../types";

/**
 * Repository 接口（T1.1）：业务代码统一通过本接口读写数据，
 * 具体实现为 MemoryRepo（JSON 文件，本地模式）或 SupabaseRepo（PostgreSQL，云端模式）。
 */
export interface Repo {
  // ---------- 项目 ----------
  listProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | null>;
  saveProject(project: Project): Promise<Project>;
  deleteProject(id: string): Promise<boolean>;

  // ---------- 需求 ----------
  listRequirements(projectId: string): Promise<Requirement[]>;
  getRequirement(id: string): Promise<Requirement | null>;
  saveRequirement(requirement: Requirement): Promise<Requirement>;
  deleteRequirement(id: string): Promise<boolean>;

  // ---------- 测试用例 ----------
  listTests(projectId?: string): Promise<TestCase[]>;
  getTest(id: string): Promise<TestCase | null>;
  saveTest(test: TestCase): Promise<TestCase>;
  deleteTest(id: string): Promise<boolean>;

  // ---------- 运行记录 ----------
  saveRun(run: RunResult): Promise<RunResult>;
  getRun(id: string): Promise<RunResult | null>;
  listRunsByTest(testId: string): Promise<RunResult[]>;
  listAllRuns(): Promise<RunResult[]>;
}
