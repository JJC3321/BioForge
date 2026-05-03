"""FastAPI sidecar exposing the AG2 plan-generation agents.

Endpoints:
- POST /plan    — run the Design → Verify → Rectify loop, or fall back to the
                  deterministic stub when AG2_API_KEY (or GEMINI_API_KEY) is unset.
- GET  /healthz — liveness + LLM availability.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from .agents import orchestrator
from .config import is_live_llm
from .schema import PlanRequest, PlanResponse
from .stub import stub_plan

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("plan-service")

app = FastAPI(title="Protocol Fold Agents", version="0.1.0")

# Permissive CORS for local dev; production should restrict to the Next.js origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/healthz")
def healthz() -> dict[str, Any]:
    return {"ok": True, "liveLLM": is_live_llm()}


@app.post("/plan", response_model=PlanResponse)
async def plan(req: PlanRequest) -> PlanResponse:
    if not is_live_llm():
        log.info("plan: no AG2_API_KEY — serving stub")
        return PlanResponse(
            plan=stub_plan(req.hypothesis, req.domain, req.similarFeedback),
            verification=None,
            iterations=0,
            source="stub",
        )

    try:
        result = await orchestrator.run(
            hypothesis=req.hypothesis,
            domain=req.domain,
            qc=req.qc,
            similar_feedback=req.similarFeedback,
        )
    except orchestrator.OrchestratorError as e:
        # Configuration failure (no key reaching orchestrator) — fall to stub.
        log.warning("plan: orchestrator unavailable, falling back to stub: %s", e)
        return PlanResponse(
            plan=stub_plan(req.hypothesis, req.domain, req.similarFeedback),
            verification=None,
            iterations=0,
            source="stub",
        )
    except ValidationError as e:
        log.error("plan: agent returned invalid plan shape: %s", e)
        raise HTTPException(status_code=502, detail="Agent returned invalid plan") from e
    except Exception as e:  # noqa: BLE001
        log.exception("plan: agent run failed")
        raise HTTPException(status_code=500, detail=str(e)) from e

    return PlanResponse(
        plan=result.plan,
        verification=result.verification,
        iterations=result.iterations,
        source="agents",
    )
