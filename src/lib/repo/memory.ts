import { promises as fs } from "fs";
import path from "path";
import {
  DATA_DIR,
  deleteTest,
  getRun,
  getTest,
  listAllRuns,
  listRunsByTest,
  listTests,
  newId,
  saveRun,
  saveTest,
} from "../storage";
import type { Project, Requirement, RunResult, TestCase } from "../types";
import type { Repo } from "./types";

const PROJECTS_FILE = path.join(DATA_DIR, "projects.json");
const REQUIREMENTS_FILE = path.join(DATA_DIR, "requirements.json");

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf-8");
}

/** 本地模式实现：JSON 文件存储（与原 storage.ts 相同的目录约定） */
export class MemoryRepo implements Repo {
  // ---------- 项目 ----------
  async listProjects(): Promise<Project[]> {
    return (await readJson<Project[]>(PROJECTS_FILE, [])).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  }

  async getProject(id: string): Promise<Project | null> {
    const projects = await this.listProjects();
    return projects.find((p) => p.id === id) ?? null;
  }

  async saveProject(project: Project): Promise<Project> {
    const projects = await this.listProjects();
    const idx = projects.findIndex((p) => p.id === project.id);
    if (idx >= 0) projects[idx] = project;
    else projects.push(project);
    await writeJson(PROJECTS_FILE, projects);
    return project;
  }

  async deleteProject(id: string): Promise<boolean> {
    const projects = await this.listProjects();
    const next = projects.filter((p) => p.id !== id);
    await writeJson(PROJECTS_FILE, next);
    return next.length !== projects.length;
  }

  // ---------- 需求 ----------
  async listRequirements(projectId: string): Promise<Requirement[]> {
    const all = await readJson<Requirement[]>(REQUIREMENTS_FILE, []);
    return all
      .filter((r) => r.projectId === projectId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getRequirement(id: string): Promise<Requirement | null> {
    const all = await readJson<Requirement[]>(REQUIREMENTS_FILE, []);
    return all.find((r) => r.id === id) ?? null;
  }

  async saveRequirement(requirement: Requirement): Promise<Requirement> {
    const all = await readJson<Requirement[]>(REQUIREMENTS_FILE, []);
    const idx = all.findIndex((r) => r.id === requirement.id);
    if (idx >= 0) all[idx] = requirement;
    else all.push(requirement);
    await writeJson(REQUIREMENTS_FILE, all);
    return requirement;
  }

  async deleteRequirement(id: string): Promise<boolean> {
    const all = await readJson<Requirement[]>(REQUIREMENTS_FILE, []);
    const next = all.filter((r) => r.id !== id);
    await writeJson(REQUIREMENTS_FILE, next);
    return next.length !== all.length;
  }

  // ---------- 测试用例（委托原 storage.ts） ----------
  async listTests(projectId?: string): Promise<TestCase[]> {
    const tests = await listTests();
    return projectId ? tests.filter((t) => t.projectId === projectId) : tests;
  }

  async getTest(id: string): Promise<TestCase | null> {
    return getTest(id);
  }

  async saveTest(test: TestCase): Promise<TestCase> {
    return saveTest(test);
  }

  async deleteTest(id: string): Promise<boolean> {
    return deleteTest(id);
  }

  // ---------- 运行记录（委托原 storage.ts） ----------
  async saveRun(run: RunResult): Promise<RunResult> {
    return saveRun(run);
  }

  async getRun(id: string): Promise<RunResult | null> {
    return getRun(id);
  }

  async listRunsByTest(testId: string): Promise<RunResult[]> {
    return listRunsByTest(testId);
  }

  async listAllRuns(): Promise<RunResult[]> {
    return listAllRuns();
  }
}

export { newId };
