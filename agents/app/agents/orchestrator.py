"""Design → Verify → (Rectify → Verify)* orchestrator.

Mirrors the FSM in the deleted src/lib/biopro-agent.ts (lines 459-547).
The agents are AG2 beta Agents; this module is the deterministic driver.

Why a hand-rolled FSM rather than AG2 GroupChat:
- Speaker order is strictly deterministic (not LLM-selected).
- Verifier short-circuits on rule failures with no LLM call — easier to express
  as a function than a GroupChat reply override.
- The iteration cap is a hard FSM exit, not a turn-count.

The agents themselves use AG2 beta abstractions (Agent, OpenAIConfig,
structured `response_format`).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List, Optional

from autogen.beta import Agent  # type: ignore[import-untyped]

from ..config import is_live_llm, max_iterations
from ..schema import (
    ExperimentPlan,
    QCResult,
    StoredFeedbackInput,
    VerificationResult,
)
from . import designer as designer_mod
from . import rectifier as rectifier_mod
from . import verifier as verifier_mod

log = logging.getLogger(__name__)


@dataclass
class RunResult:
    plan: ExperimentPlan
    verification: VerificationResult
    iterations: int


class OrchestratorError(RuntimeError):
    pass


async def run(
    hypothesis: str,
    domain: Optional[str],
    qc: Optional[QCResult],
    similar_feedback: List[StoredFeedbackInput],
    *,
    max_iter: Optional[int] = None,
) -> RunResult:
    """Drive the Design-Verify-Rectify loop. Raises if no live LLM."""
    if not is_live_llm():
        raise OrchestratorError("Live LLM required for orchestrator. Use stub_plan() instead.")

    cap = max_iter if max_iter is not None else max_iterations()
    designer = designer_mod.make_designer()
    rectifier = rectifier_mod.make_rectifier()
    verifier_agent = verifier_mod.make_verifier()

    log.info("orchestrator: DESIGN")
    plan = await designer_mod.design(designer, hypothesis, domain, qc, similar_feedback)

    iterations = 0
    verification = await verifier_mod.verify(plan, llm_agent=verifier_agent)
    while not verification.passed and iterations < cap:
        iterations += 1
        log.info(
            "orchestrator: RECTIFY (%d/%d) — %d violations",
            iterations,
            cap,
            len(verification.violations),
        )
        plan = await rectifier_mod.rectify(rectifier, plan, verification.violations, iterations)
        verification = await verifier_mod.verify(plan, llm_agent=verifier_agent)

    if not verification.passed:
        log.warning(
            "orchestrator: max iterations (%d) reached with %d unresolved violations",
            cap,
            len(verification.violations),
        )

    log.info(
        "orchestrator: COMPLETE in %d iterations, compliance=%.2f",
        iterations,
        verification.physicalComplianceScore,
    )
    return RunResult(plan=plan, verification=verification, iterations=iterations)
