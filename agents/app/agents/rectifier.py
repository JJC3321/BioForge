"""RectifierAgent — repairs a plan against a list of violations."""

from __future__ import annotations

import json
from typing import List

from autogen.beta import Agent  # type: ignore[import-untyped]

from ..config import build_llm_config
from ..schema import ExperimentPlan, Violation
from .prompts import RECTIFY_SYSTEM_PROMPT
from .util import extract_json


def make_rectifier() -> Agent:
    config = build_llm_config(response_format=ExperimentPlan)
    return Agent(
        name="Rectifier",
        config=config,
        system_message=RECTIFY_SYSTEM_PROMPT,
    )


async def rectify(
    agent: Agent,
    plan: ExperimentPlan,
    violations: List[Violation],
    iteration: int,
) -> ExperimentPlan:
    payload = {
        "originalPlan": plan.model_dump(),
        "violations": [
            {
                "type": v.type,
                "field": v.field,
                "message": v.message,
                "severity": v.severity,
                "stepIndex": v.stepIndex,
            }
            for v in violations
        ],
        "iteration": iteration,
    }
    reply = await agent.ask(json.dumps(payload, indent=2, default=str))
    return ExperimentPlan.model_validate(extract_json(reply.body))
