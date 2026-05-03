"""Dry-Run Simulator — two-agent debate: Simulator → Reporter.

Simulator predicts per-step outcomes; Reporter reviews, challenges overconfident
estimates, and produces the final SimulationResult.
"""

from __future__ import annotations

import json
import logging

from autogen.beta import Agent  # type: ignore[import-untyped]

from ..config import build_llm_config
from ..schema import ExperimentPlan, SimulationResult, StepwiseSimulation
from .sim_prompts import REPORT_SYSTEM_PROMPT, SIM_SYSTEM_PROMPT
from .util import extract_json

log = logging.getLogger(__name__)


def make_simulator() -> Agent:
    config = build_llm_config(response_format=StepwiseSimulation)
    return Agent(
        name="Simulator",
        config=config,
        system_message=SIM_SYSTEM_PROMPT,
    )


def make_reporter() -> Agent:
    config = build_llm_config(response_format=SimulationResult)
    return Agent(
        name="Reporter",
        config=config,
        system_message=REPORT_SYSTEM_PROMPT,
    )


async def run_sim(plan: ExperimentPlan, n_runs: int = 100) -> SimulationResult:
    """Simulate → Report debate. Returns the Reporter's final SimulationResult."""
    sim = make_simulator()
    rep = make_reporter()

    log.info("sim_agent: SIMULATE (%d runs)", n_runs)
    stepwise = await _simulate(sim, plan, n_runs)

    log.info("sim_agent: REPORT (experimentType=%s)", stepwise.experimentType)
    final = await _report(rep, plan, stepwise)

    log.info(
        "sim_agent: DONE overallSuccess=%.2f confidence=%.2f",
        final.overallSuccessProbability,
        final.confidenceScore,
    )
    return final


async def _simulate(agent: Agent, plan: ExperimentPlan, n_runs: int) -> StepwiseSimulation:
    payload = {
        "plan": plan.model_dump(),
        "nRuns": n_runs,
    }
    reply = await agent.ask(json.dumps(payload, indent=2, default=str))
    return StepwiseSimulation.model_validate(extract_json(reply.body))


async def _report(
    agent: Agent, plan: ExperimentPlan, stepwise: StepwiseSimulation
) -> SimulationResult:
    payload = {
        "plan": plan.model_dump(),
        "simulatorOutput": stepwise.model_dump(),
    }
    reply = await agent.ask(json.dumps(payload, indent=2, default=str))
    return SimulationResult.model_validate(extract_json(reply.body))
