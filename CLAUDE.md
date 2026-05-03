# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # start Next.js dev server on :3000 (plan service NOT started — TS stub will serve)
npm run dev:agents   # start the AG2 plan-service sidecar (uvicorn :8001) — requires `pip install -e ./agents[dev]`
npm run dev:full     # run web + agents together (concurrently)
npm run build        # production build
npm run lint         # next lint
npm test             # vitest run (one-shot)
npm run test:watch   # vitest in watch mode
npx vitest run tests/plan-stub.test.ts        # run a single test file
npx vitest run -t "stub plan validates"       # run a single test by name

cd agents && pytest  # run Python sidecar tests (stub parity, verifier rules, orchestrator FSM)
```

Path alias: `@/*` → `src/*` (configured in both `tsconfig.json` and `vitest.config.ts` — keep them in sync).

## Architecture

Two processes: a **Next.js 15 (App Router) app** for UI, API routes, and JSON-DB persistence, and a **Python AG2 sidecar** at `agents/` for plan generation. The whole product is one stage machine: **hypothesis → QC → plan → feedback**, driven by `src/components/Workspace.tsx` calling three API routes:

- `POST /api/qc` → `lib/qc.ts::runQC` — corpus search + novelty classification, optional LLM rationale rewrite. **Stays in TypeScript** (one-shot LLM call, not multi-agent).
- `POST /api/plan` → `lib/plan.ts::generatePlan` — proxies to the AG2 sidecar at `${PLAN_SERVICE_URL ?? "http://127.0.0.1:8001"}/plan`, which runs Designer → Verifier → Rectifier as AG2 `ConversableAgent`s. Falls back to a TS deterministic stub if the sidecar is unreachable.
- `POST /api/feedback` → persists reviewer ratings/corrections, which become few-shot input on the next similar hypothesis (passed in the `similarFeedback` field of the `/plan` request body).

The sidecar is **stateless**: `findSimilarFeedback()` and `savePlan()` stay in Node and read/write `data/ai-scientist.json`. The Python service receives `similarFeedback` as input.

Three load-bearing design rules to preserve when modifying this code:

### 1. Stub fallback is not optional — and it lives in two places

Every LLM call has a deterministic, domain-aware stub:
- **Python side** (`agents/app/stub.py`) serves the `/plan` endpoint when `AG2_API_KEY` is unset, so the sidecar still runs key-less.
- **TypeScript side** (`stubPlan` in `lib/plan.ts`, no-LLM branch in `lib/qc.ts`) serves when the Python sidecar is unreachable (e.g., user only ran `npm run dev`, not `npm run dev:full`).

Both stubs must stay in sync — port any template change to both. The app must run end-to-end with no `AG2_API_KEY` AND with no Python service.

### 2. Two-layer validation around structured output

LLM output is constrained twice:
1. **AG2 + Gemini structured output** with `response_format=PydanticModel` (see `agents/app/agents/{designer,verifier,rectifier}.py`).
2. **Zod re-parse** on the Node side after HTTP receive (`ExperimentPlan.parse(body.plan)` in `lib/plan.ts::callPlanService`).

Schemas live in two source-of-truth files: Zod in `src/lib/schema.ts` (wire format), Pydantic in `agents/app/schema.py`. When you change one, change the other. QC still uses the legacy `lib/gemini.ts::structuredCall` + `QC_TOOL_SCHEMA` JSON Schema in `lib/qc.ts`.

### 3. Defense in depth — ground LLM output in trusted data

`lib/qc.ts` discards LLM-returned references and forces the locally-computed `references` and `novelty` back in (`grounded` object). The LLM rewrites *rationale text only*. Apply the same pattern when adding LLM-touched fields that have a deterministic source of truth.

## Persistence — README is wrong

The README says SQLite + `better-sqlite3`. The actual implementation in `src/lib/db.ts` is a **JSON file store** at `data/ai-scientist.json` (atomic write via `.tmp` + rename). There is no `better-sqlite3` dependency in `package.json`. `feedback-store.ts` is the only consumer — swap it there if you migrate to a real DB.

API routes that touch the DB **must** export `runtime = "nodejs"` (not edge), because the store uses Node `fs`.

## Few-shot feedback retrieval

`findSimilarFeedback` (in `feedback-store.ts`) does Jaccard token overlap over `hypothesis + domain` against stored feedback, returning the top 3 above a similarity floor of 0.05. The Node side passes these in the `/plan` HTTP request body (`similarFeedback` field). The Python Designer agent injects them into its prompt (`priorReviewerFeedback`) and the Python stub uses them for `reviewerNotes`. The system prompt explicitly tells the model to incorporate prior corrections — keep that contract if you change the prompt.

The same Jaccard helper is duplicated in `feedback-store.ts` and `literature.ts`. They are intentionally separate (different stopword/min-length tuning could diverge); don't refactor into a shared util without checking both call sites.

## Models

Default model is `gemini-2.5-flash`, set in two places that must stay in sync: `lib/gemini.ts::GEMINI_MODEL` (TS, used by QC) and `agents/app/config.py::DEFAULT_MODEL` (Python, used by the Designer/Verifier/Rectifier agents). Override with `GEMINI_MODEL`. When migrating models, update `.env.example` plus both constants.
