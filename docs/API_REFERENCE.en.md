# TestPilot AI · API Reference

Base URL: `http://localhost:3000` in development. JSON bodies use `Content-Type: application/json` unless noted.

**Runtime:** API routes use the **Node.js** runtime (Playwright and file I/O).

**Languages:** [中文](API_REFERENCE.md) | [English](API_REFERENCE.en.md)

---

## System

### `GET /api/status`

Whether AI is configured.

```json
{ "aiEnabled": true }
```

### `GET /api/auth/status`

Login state in Supabase mode; unauthenticated when not configured.

---

## Stats

### `GET /api/stats`

Dashboard payload: case count, run count, pass rate, distribution, 14-day trend, case summaries.

---

## Test cases

### `GET /api/tests`

| Query | Description |
|-------|-------------|
| `projectId` | Optional filter |

### `POST /api/tests`

**Body**

```json
{
  "url": "https://example.com",
  "name": "optional",
  "steps": [],
  "projectId": "optional",
  "requirementId": "optional",
  "source": "manual"
}
```

If `steps` is empty and `url` is set, the server generates steps via AI or rules.

**Response:** Full `TestCase` object.

### `GET /api/tests/:id`

Single case with `steps[]`.

### `PUT /api/tests/:id`

Update metadata and steps.

### `DELETE /api/tests/:id`

Delete case (and related data per repo implementation).

### `POST /api/tests/:id/run`

Run Playwright.

```json
{
  "runId": "run_xxx",
  "status": "passed | failed",
  "results": [
    {
      "stepId": "...",
      "status": "...",
      "error": "...",
      "screenshot": "..."
    }
  ]
}
```

### `GET /api/tests/:id/export`

| Query | Output |
|-------|--------|
| `format=code` | Playwright TypeScript |
| `format=report` | Markdown report |

---

## Generation wizard

### `POST /api/generate`

**Body**

```json
{
  "url": "https://example.com",
  "requirements": "natural language requirements"
}
```

**Response**

```json
{
  "url": "https://example.com",
  "source": "ai",
  "candidates": [
    {
      "name": "case title",
      "description": "summary",
      "steps": [{ "type": "goto", "description": "..." }]
    }
  ]
}
```

---

## Runs

### `GET /api/runs/:runId`

Full `RunResult`: step outcomes, timing, failure analysis.

### `GET /api/screenshots/:runId/:file`

Screenshot binary (PNG/JPEG).

---

## Projects

### `GET /api/projects`

List projects.

### `POST /api/projects`

```json
{ "name": "My app", "targetUrl": "https://...", "description": "optional" }
```

### `GET /api/projects/:id`

### `PUT /api/projects/:id`

### `DELETE /api/projects/:id`

### `GET /api/projects/:id/traceability`

JSON trace: requirements → acceptance criteria → cases → latest run status.

---

## Requirements

### `GET /api/requirements?projectId=`

List by project.

### `POST /api/requirements`

```json
{
  "projectId": "...",
  "title": "title",
  "body": "requirement text"
}
```

### `GET /api/requirements/:id`

### `PUT /api/requirements/:id`

### `DELETE /api/requirements/:id`

---

## Type: `TestStep`

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Step id |
| `type` | StepType | See README step table |
| `selector` | string? | Primary selector |
| `selectorCandidates` | string[]? | Fallback selectors |
| `value` | string? | Input, expected text, delay ms, etc. |
| `description` | string? | Human-readable note |
| `timeout` | number? | Ms, default 10000 |

---

## Errors

```json
{ "error": "human-readable message" }
```

HTTP: `400` bad input, `404` not found, `500` server error.

---

## See also

- Handlers: `src/app/api/**/route.ts`
- Types: `src/lib/types.ts`
- Storage: `src/lib/repo/`