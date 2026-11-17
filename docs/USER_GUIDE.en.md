# TestPilot AI · User Guide

From zero to your first green test run — plus the wizard, reports, export, recorder extension, and cloud mode.

**Languages:** [中文](USER_GUIDE.md) | [English](USER_GUIDE.en.md)

---

## Table of contents

1. [Mental model in 30 seconds](#1-mental-model-in-30-seconds)
2. [Install and first launch](#2-install-and-first-launch)
3. [Path A: Quick smoke (single URL)](#3-path-a-quick-smoke-single-url)
4. [Path B: Requirements wizard](#4-path-b-requirements-wizard)
5. [Edit steps and run](#5-edit-steps-and-run)
6. [Reading the report](#6-reading-the-report)
7. [Export Playwright code](#7-export-playwright-code)
8. [Chrome recorder extension](#8-chrome-recorder-extension)
9. [Projects and traceability](#9-projects-and-traceability)
10. [Supabase cloud deployment](#10-supabase-cloud-deployment)
11. [FAQ](#11-faq)

---

## 1. Mental model in 30 seconds

Four persistent concepts:

```
Project  →  Requirement  →  TestCase  →  Run
     │            │              │
     └──── optional traceability chain ────┘
```

**Shortest path:** Create a `TestCase` (URL + steps) from the home page or API → Run → Open report.

**Recommended path:** Describe the scenario on `/generate` → pick AI candidates → fine-tune on the detail page → Run.

---

## 2. Install and first launch

```bash
git clone https://github.com/yimaomao-max/testpilot-ai.git
cd testpilot-ai
npm install
cp .env.example .env.local   # optional
npm run dev
```

Open **http://localhost:3000**.

| Check | How |
|-------|-----|
| Server up | Dashboard loads |
| AI enabled | http://localhost:3000/api/status → `aiEnabled` |
| Chromium | Installed via `postinstall` on `npm install` |

### Configure AI (recommended)

`.env.local`:

```env
OPENAI_API_KEY=your-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

Restart the dev server. Without a key:

- Creating a case from a URL yields a **3-step rule smoke** (open → assert body → screenshot)
- The wizard still returns rule-based candidates (`source: "rule"`)

---

## 3. Path A: Quick smoke (single URL)

Best when you only need **“does this site load?”**

### In the UI

1. Home or **Tests** list
2. Enter **URL** and create a case
3. Open `/tests/{id}`
4. Click **Run**
5. Open `/reports/{runId}`

### Via API

```bash
curl -s -X POST http://localhost:3000/api/tests \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}' | jq

curl -s -X POST http://localhost:3000/api/tests/{id}/run | jq
```

With AI configured, step generation uses `lib/ai.ts`; otherwise `fallbackSteps`.

---

## 4. Path B: Requirements wizard

Best for **multiple scenarios** on one site (login, search, forms).

### Three steps at `/generate`

| Step | Name | Your input |
|------|------|------------|
| 1 | Define Requirements | **URL** + **requirements** (plain language) |
| 2 | Review, Edit and Select | Review **candidates**, uncheck unwanted rows |
| 3 | Generate Test Cases | Batch create → test list |

Example requirements:

```text
Homepage smoke for an e-commerce site:
1. Search box accepts input and submits on Enter
2. Nav has at least 3 category links
3. Footer contains "Contact us"
```

Response fields:

- `source`: `"ai"` | `"rule"`
- `candidates[]`: `name`, `description`, `steps[]`

---

## 5. Edit steps and run

### Step editor (`/tests/[id]`)

- Reorder, add, remove steps
- Edit `type`, `selector`, `value`, `description`
- Set **`selectorCandidates`** for flaky or recorded flows

### Runner behavior (`lib/runner.ts`)

- **Headless Chromium**
- Default **10s** per step (`timeout` override per step)
- **Fail-fast**; later steps marked skipped
- Screenshots per step; failures keep error + image path
- **AI failure analysis** on errors (rule fallback without API key)

```bash
curl -X POST http://localhost:3000/api/tests/{id}/run
```

Response includes `runId` for the report.

---

## 6. Reading the report

Route: **`/reports/[runId]`**

- Pass-rate ring for this run
- Timeline and `durationMs`
- Per-step status: pass / fail / skipped
- Failure panel: message, expected vs actual, **AI diagnosis**, screenshot zoom

Screenshots:

```
GET /api/screenshots/{runId}/{filename}
```

Stored under local `data/` (not in Git).

---

## 7. Export Playwright code

UI: **`/tests/[id]/code`**

```bash
curl "http://localhost:3000/api/tests/{id}/export?format=code"
curl "http://localhost:3000/api/tests/{id}/export?format=report"
```

Exports use `lib/codegen.ts` — standard `@playwright/test`, runnable with `npx playwright test`.

---

## 8. Chrome recorder extension

Folder: **`extension/`**

1. `chrome://extensions` → Developer mode → Load unpacked → `extension/`
2. Start the app on port **3100** (extension default):

   ```bash
   npm run dev -- -p 3100
   ```

3. Record actions → adjust steps in the popup → select project/requirement → create case

Recorded steps include fallback selectors for **self-healing** runs.

---

## 9. Projects and traceability

Phase 1 model (`src/lib/types.ts`):

- **Project** — `name`, `targetUrl`
- **Requirement** — body, parse status
- **TestCase** — `projectId`, `requirementId`, `acIds`, `code` (TC-xxx)
- **Trace** — `GET /api/projects/{id}/traceability`

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"Demo","targetUrl":"https://example.com"}'

curl -X POST http://localhost:3000/api/requirements \
  -H "Content-Type: application/json" \
  -d '{"projectId":"...","title":"Login","body":"..."}'
```

Acceptance-criteria workflow is specified in **01-PRD-MVP.md** (Chinese); some UI is still evolving — APIs are integration-ready.

---

## 10. Supabase cloud deployment

Use when you need **auth**, **PostgreSQL**, or shared hosting.

1. Create a Supabase project
2. Run `supabase/migrations/0001_init.sql`
3. Set env vars from `.env.example`
4. `npm run build && npm start`
5. Sign in at `/login`

Without Supabase, `getRepo()` uses **MemoryRepo** (JSON files).

> **Note:** Serverless hosts (e.g. Vercel) are fine for the web UI but **in-browser/server Playwright** has platform limits; plan for Local Runner for heavy execution.

---

## 11. FAQ

### AI always in rule mode?

- Non-empty `OPENAI_API_KEY` in `.env.local`
- Restart dev server
- Check `/api/status`

### Chromium not found?

```bash
npx playwright install chromium
```

### Extension cannot reach API?

- Run dev server on **port 3100**
- Check `host_permissions` in `extension/manifest.json`

### Assertions keep failing?

1. Prefer `text=` or role-based selectors
2. Add `selectorCandidates`
3. Insert `wait` / `waitForSelector` before asserts on dynamic UIs

### Safe to delete `data/`?

Yes — clears local cases and runs only (gitignored).

### Built-in runner in production?

Good for **demos / low volume**. For isolation and scale, use the upcoming **Local Runner CLI** (see README roadmap).

---

## Next steps

- [API reference (EN)](./API_REFERENCE.en.md) for CI integration
- [PRD](./01-PRD-MVP.md) for review workflow and failure taxonomy
- [GitHub Issues](https://github.com/yimaomao-max/testpilot-ai/issues) for feedback