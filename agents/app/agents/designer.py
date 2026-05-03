"""DesignerAgent — proposes the initial ExperimentPlan."""

from __future__ import annotations

import json
from typing import List, Optional

from autogen.beta import Agent  # type: ignore[import-untyped]

from ..config import build_llm_config
from ..schema import ExperimentPlan, QCResult, StoredFeedbackInput
from .prompts import DESIGN_SYSTEM_PROMPT
from .util import extract_json


def make_designer() -> Agent:
    config = build_llm_config(response_format=ExperimentPlan)
    return Agent(
        name="Designer",
        config=config,
        system_message=DESIGN_SYSTEM_PROMPT,
    )


async def design(
    agent: Agent,
    hypothesis: str,
    domain: Optional[str],
    qc: Optional[QCResult],
    similar_feedback: List[StoredFeedbackInput],
) -> ExperimentPlan:
    payload = {
        "hypothesis": hypothesis,
        "domain": domain or "general",
        "qc": qc.model_dump() if qc else None,
        "priorReviewerFeedback": [
            {
                "hypothesis": f.hypothesis,
                "tags": f.tags,
                "ratings": f.ratings,
                "corrections": f.corrections,
                "notes": f.freeformNotes,
            }
            for f in similar_feedback
        ],
    }
    user_msg = json.dumps(payload, indent=2, default=str)

    reply = await agent.ask(user_msg)
    return ExperimentPlan.model_validate(extract_json(reply.body))
