"""VerifierAgent — rule-based first, optional LLM second.

Mirrors verifyPhase() in src/lib/biopro-agent.ts:369-393: always run deterministic
rules; only invoke the LLM checker when rules pass and LLM is enabled.
Uses AG2 beta API (autogen.beta.Agent).
"""

from __future__ import annotations

import json
import logging
from typing import Optional

from autogen.beta import Agent  # type: ignore[import-untyped]

from ..config import build_llm_config, is_live_llm
from ..schema import ExperimentPlan, VerificationResult, Violation
from ..verifier_rules import score_violations, verify_with_rules
from .prompts import VERIFY_SYSTEM_PROMPT
from .util import extract_json

log = logging.getLogger(__name__)


def make_verifier() -> Optional[Agent]:
    if not is_live_llm():
        return None
    config = build_llm_config(response_format=VerificationResult)
    return Agent(
        name="Verifier",
        config=config,
        system_message=VERIFY_SYSTEM_PROMPT,
    )


async def verify(
    plan: ExperimentPlan,
    *,
    llm_agent: Optional[Agent] = None,
) -> VerificationResult:
    rule_violations = verify_with_rules(plan)

    # Short-circuit: if rules already found problems, skip the LLM call.
    if rule_violations or llm_agent is None:
        return score_violations(rule_violations)

    try:
        reply = await llm_agent.ask(
            json.dumps({"plan": plan.model_dump()}, indent=2, default=str)
        )
        llm_result = VerificationResult.model_validate(extract_json(reply.body))
        merged: list[Violation] = list(rule_violations) + list(llm_result.violations)
        return score_violations(merged)
    except Exception as e:  # noqa: BLE001
        log.warning("LLM verification failed: %s", e)
        return score_violations(rule_violations)
