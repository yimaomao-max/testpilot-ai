import { promises as fs } from "fs";
import path from "path";
import type { RunResult, TestCase } from "./types";

export const DATA_DIR = path.join(process.cwd(), "data");
export const TESTS_FILE = path.join(DATA_DIR, "tests.json");
export const RUNS_DIR = path.join(DATA_DIR, "runs");
export const SCREENSHOTS_DIR = path.join(DATA_DIR, "screenshots");

async function ensureDirs() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(RUNS_DIR, { recursive: true });
  await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------- 测试用例 ----------

export async function listTests(): Promise<TestCase[]> {
  await ensureDirs();
  try {
    const raw = await fs.readFile(TESTS_FILE, "utf-8");
    const tests = JSON.parse(raw) as TestCase[];
    return tests.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export async function getTest(id: string): Promise<TestCase | null> {
  const tests = await listTests();
  return tests.find((t) => t.id === id) ?? null;
}

export async function saveTest(test: TestCase): Promise<TestCase> {
  await ensureDirs();
  const tests = await listTests();
  const idx = tests.findIndex((t) => t.id === test.id);
  if (idx >= 0) tests[idx] = test;
  else tests.push(test);
  await fs.writeFile(TESTS_FILE, JSON.stringify(tests, null, 2), "utf-8");
  return test;
}

export async function deleteTest(id: string): Promise<boolean> {
  await ensureDirs();
  const tests = await listTests();
  const next = tests.filter((t) => t.id !== id);
  await fs.writeFile(TESTS_FILE, JSON.stringify(next, null, 2), "utf-8");
  return next.length !== tests.length;
}

// ---------- 运行记录 ----------

export async function saveRun(run: RunResult): Promise<RunResult> {
  await ensureDirs();
  await fs.writeFile(
    path.join(RUNS_DIR, `${run.id}.json`),
    JSON.stringify(run, null, 2),
    "utf-8"
  );
  return run;
}

export async function getRun(id: string): Promise<RunResult | null> {
  await ensureDirs();
  try {
    const raw = await fs.readFile(path.join(RUNS_DIR, `${id}.json`), "utf-8");
    return JSON.parse(raw) as RunResult;
  } catch {
    return null;
  }
}

export async function listAllRuns(): Promise<RunResult[]> {
  await ensureDirs();
  const runs: RunResult[] = [];
  try {
    const files = await fs.readdir(RUNS_DIR);
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      try {
        const raw = await fs.readFile(path.join(RUNS_DIR, f), "utf-8");
        runs.push(JSON.parse(raw) as RunResult);
      } catch {
        // 忽略损坏的运行记录
      }
    }
  } catch {
    // 目录不存在
  }
  return runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function listRunsByTest(testId: string): Promise<RunResult[]> {
  await ensureDirs();
  const runs: RunResult[] = [];
  try {
    const files = await fs.readdir(RUNS_DIR);
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      try {
        const raw = await fs.readFile(path.join(RUNS_DIR, f), "utf-8");
        const run = JSON.parse(raw) as RunResult;
        if (run.testId === testId) runs.push(run);
      } catch {
        // 忽略损坏的运行记录
      }
    }
  } catch {
    // 目录不存在
  }
  return runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

// ---------- 截图 ----------

export async function saveScreenshot(
  runId: string,
  fileName: string,
  buffer: Buffer
): Promise<string> {
  const dir = path.join(SCREENSHOTS_DIR, runId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, fileName), buffer);
  return fileName;
}

export async function getScreenshot(
  runId: string,
  fileName: string
): Promise<Buffer | null> {
  // 防止路径穿越
  if (!/^[a-zA-Z0-9_-]+\.png$/.test(fileName)) return null;
  try {
    return await fs.readFile(path.join(SCREENSHOTS_DIR, runId, fileName));
  } catch {
    return null;
  }
}
