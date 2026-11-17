-- Spec2Test AI 初始化迁移（T1.2）
-- 依据 docs/02-技术架构与数据库设计.md §4
-- 说明：test_cases / test_runs 增加 data jsonb 作为 Phase 1 的实用反范式
--       （完整 RunResult / TestCase 存档），后续按需逐步规范化。

-- ---------- 租户与用户 ----------
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  plan text not null default 'free',
  created_at timestamptz not null default now()
);

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id),
  created_at timestamptz not null default now()
);

create table if not exists workspace_members (
  workspace_id uuid not null references workspaces(id),
  user_id uuid not null references users(id),
  role text not null default 'member',
  primary key (workspace_id, user_id)
);

-- ---------- 项目 ----------
create table if not exists projects (
  id text primary key,                      -- 与应用层 ID 生成策略保持一致
  workspace_id uuid references workspaces(id),
  owner_id uuid references users(id),
  name text not null,
  target_url text,
  description text,
  created_at timestamptz not null default now()
);

-- ---------- 需求与验收标准（追溯链起点） ----------
create table if not exists requirements (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  title text not null,
  body text not null,
  source text not null default 'paste',     -- paste | markdown | jira
  status text not null default 'draft',     -- draft | analyzed | generated
  scenarios jsonb,                          -- Phase 1 实用存储，A1 解析后规范化
  acs jsonb,                                -- 验收标准数组（AC-001…）
  created_at timestamptz not null default now()
);

create table if not exists requirement_scenarios (
  id uuid primary key default gen_random_uuid(),
  requirement_id text not null references requirements(id) on delete cascade,
  name text not null,
  actor text,
  preconditions jsonb
);

create table if not exists acceptance_criteria (
  id text primary key,
  requirement_id text not null references requirements(id) on delete cascade,
  code text not null,                       -- AC-001
  given text,
  when_s text,
  then_s text,
  category text not null default 'normal',  -- normal | exception | boundary
  covered boolean not null default false
);

-- ---------- 测试用例与步骤 ----------
create table if not exists test_cases (
  id text primary key,
  project_id text references projects(id) on delete cascade,
  requirement_id text references requirements(id) on delete set null,
  code text,                                -- TC-001
  title text not null,
  type text,                                -- normal | exception | boundary
  priority text,
  review_status text not null default 'unreviewed', -- unreviewed | reviewed | rejected
  source text,                              -- ai | manual | rule
  url text,
  ac_ids jsonb,
  reason text,
  open_questions jsonb,
  data jsonb not null,                      -- 完整 TestCase 存档（含 steps）
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists test_steps (
  id uuid primary key default gen_random_uuid(),
  case_id text not null references test_cases(id) on delete cascade,
  seq int not null,
  action text not null,
  selector_hint text,
  selector_verified boolean not null default false,
  input_data text,
  expected text
);

-- ---------- 浏览器录制会话（插件，Phase 4） ----------
create table if not exists browser_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id text references projects(id) on delete cascade,
  url text,
  recording jsonb,
  created_at timestamptz not null default now()
);

-- ---------- 自动化脚本（可多版本） ----------
create table if not exists playwright_tests (
  id uuid primary key default gen_random_uuid(),
  case_id text not null references test_cases(id) on delete cascade,
  version int not null default 1,
  file_name text,
  code text not null,
  generated_at timestamptz not null default now()
);

-- ---------- 执行 ----------
create table if not exists test_runs (
  id text primary key,
  project_id text references projects(id) on delete cascade,
  test_id text references test_cases(id) on delete set null,
  trigger text not null default 'manual',   -- manual | local_runner | ci | github_pr
  runner_id text,
  status text not null,                     -- passed | failed
  started_at timestamptz not null,
  duration_ms int,
  summary jsonb,
  data jsonb not null,                      -- 完整 RunResult 存档
  created_at timestamptz not null default now()
);

create table if not exists test_results (
  id uuid primary key default gen_random_uuid(),
  run_id text not null references test_runs(id) on delete cascade,
  case_id text references test_cases(id) on delete set null,
  status text not null,                     -- passed | failed | skipped
  duration_ms int,
  error text,
  expected text,
  actual text
);

create table if not exists failure_analyses (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references test_results(id) on delete cascade,
  failure_type text,          -- application_bug | locator_changed | script_error | environment | data_issue | unknown
  confidence numeric,
  scenario text,
  diagnosis text,
  suggested_next_step text,
  evidence jsonb
);

create table if not exists artifacts (
  id uuid primary key default gen_random_uuid(),
  run_id text not null references test_runs(id) on delete cascade,
  type text not null,                       -- screenshot | trace | log | network
  storage_path text not null,
  created_at timestamptz not null default now()
);

-- ---------- 订阅与额度 ----------
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  plan text not null default 'free',
  current_period_end timestamptz,
  stripe_customer_id text
);

create table if not exists ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  kind text not null,                       -- analyze | generate | failure_analysis
  tokens int,
  created_at timestamptz not null default now()
);

-- ---------- 索引 ----------
create index if not exists idx_projects_owner on projects(owner_id);
create index if not exists idx_requirements_project on requirements(project_id);
create index if not exists idx_ac_requirement on acceptance_criteria(requirement_id);
create index if not exists idx_cases_project on test_cases(project_id);
create index if not exists idx_cases_requirement on test_cases(requirement_id);
create index if not exists idx_steps_case on test_steps(case_id);
create index if not exists idx_runs_project on test_runs(project_id);
create index if not exists idx_runs_test on test_runs(test_id);
create index if not exists idx_results_run on test_results(run_id);
create index if not exists idx_results_case on test_results(case_id);

-- ---------- RLS（按归属隔离；单人阶段用 owner_id 直连） ----------
alter table projects enable row level security;
alter table requirements enable row level security;
alter table acceptance_criteria enable row level security;
alter table requirement_scenarios enable row level security;
alter table test_cases enable row level security;
alter table test_steps enable row level security;
alter table browser_sessions enable row level security;
alter table playwright_tests enable row level security;
alter table test_runs enable row level security;
alter table test_results enable row level security;
alter table failure_analyses enable row level security;
alter table artifacts enable row level security;

-- owner 全权策略（workspace 协作策略在 Phase 3 补充）
create policy "owner_all_projects" on projects
  for all using (owner_id::text = auth.uid()::text);

create policy "owner_all_requirements" on requirements
  for all using (
    exists (
      select 1 from projects p
      where p.id = requirements.project_id
        and p.owner_id::text = auth.uid()::text
    )
  );

create policy "owner_all_test_cases" on test_cases
  for all using (
    exists (
      select 1 from projects p
      where p.id = test_cases.project_id
        and p.owner_id::text = auth.uid()::text
    )
  );

create policy "owner_all_test_runs" on test_runs
  for all using (
    exists (
      select 1 from projects p
      where p.id = test_runs.project_id
        and p.owner_id::text = auth.uid()::text
    )
  );

-- 注：acceptance_criteria / test_steps / test_results 等子表通过父表级联访问，
--     服务端（service role key）不受 RLS 限制，Phase 3 引入协作时再补齐细粒度策略。
