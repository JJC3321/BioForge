"""Orchestrator FSM tests with mocked agents.

Drives the Design → Verify → Rectify loop without making real Gemini calls.
"""

from __future__ import annotations

from typing import Any

from app.agents import orchestrator
from app.schema import (
    Control,
    ExperimentPlan,
    Material,
    ProtocolStep,
    StructuredHypothesis,
    TimelinePhase,
)


def _good_plan() -> ExperimentPlan:
    return ExperimentPlan(
        domain="cell biology",
        structuredHypothesis=StructuredHypothesis(
            question="q",
            independentVariable="iv",
            dependentVariable="dv",
            predictedOutcome="po",
        ),
        protocol=[
            ProtocolStep(step=1, title="a", description="Incubate at 37°C.", durationMinutes=30),
            ProtocolStep(step=2, title="b", description="Spin.", durationMinutes=10),
            ProtocolStep(step=3, title="c", description="Read.", durationMinutes=5),
        ],
        materials=[Material(name="DMEM", quantity="500 mL", estimatedCostUSD=25)],
        controls=[
            Control(name="vehicle", type="negative", description="vehicle"),
            Control(name="baseline", type="biological", description="baseline"),
        ],
        validation=["replicate"],
        risks=[],
        timeline=[TimelinePhase(phase="run", durationDays=1)],
        budgetUSD=500,
    )


def _bad_plan_no_negative_control() -> ExperimentPlan:
    p = _good_plan()
    return p.model_copy(
        update={"controls": [Control(name="pos", type="positive", description="pos")]}
    )


async def test_orchestrator_skips_when_no_live_llm(monkeypatch: Any):
    monkeypatch.setenv("AG2_API_KEY", "")
    monkeypatch.setenv("GEMINI_API_KEY", "")
    try:
        await orchestrator.run(
            hypothesis="x" * 20,
            domain=None,
            qc=None,
            similar_feedback=[],
        )
    except orchestrator.OrchestratorError:
        return
    raise AssertionError("Expected OrchestratorError without API key")


async def test_orchestrator_completes_when_design_passes(monkeypatch: Any):
    monkeypatch.setenv("AG2_API_KEY", "test-key")

    monkeypatch.setattr(orchestrator.designer_mod, "make_designer", lambda: object())
    monkeypatch.setattr(orchestrator.rectifier_mod, "make_rectifier", lambda: object())
    monkeypatch.setattr(orchestrator.verifier_mod, "make_verifier", lambda: None)

    async def _mock_design(agent, h, d, q, sf):
        return _good_plan()

    monkeypatch.setattr(orchestrator.designer_mod, "design", _mock_design)

    result = await orchestrator.run(
        hypothesis="hypothesis text long enough",
        domain="cell biology",
        qc=None,
        similar_feedback=[],
    )
    assert result.iterations == 0
    assert result.verification.passed is True


async def test_orchestrator_rectifies_then_passes(monkeypatch: Any):
    monkeypatch.setenv("AG2_API_KEY", "test-key")

    monkeypatch.setattr(orchestrator.designer_mod, "make_designer", lambda: object())
    monkeypatch.setattr(orchestrator.rectifier_mod, "make_rectifier", lambda: object())
    monkeypatch.setattr(orchestrator.verifier_mod, "make_verifier", lambda: None)

    # Designer returns bad plan first; rectifier fixes it.
    async def _mock_design(agent, h, d, q, sf):
        return _bad_plan_no_negative_control()

    async def _mock_rectify(agent, plan, viols, it):
        return _good_plan()

    monkeypatch.setattr(orchestrator.designer_mod, "design", _mock_design)
    monkeypatch.setattr(orchestrator.rectifier_mod, "rectify", _mock_rectify)

    result = await orchestrator.run(
        hypothesis="hypothesis text long enough",
        domain=None,
        qc=None,
        similar_feedback=[],
    )
    assert result.iterations == 1
    assert result.verification.passed is True


async def test_orchestrator_caps_iterations(monkeypatch: Any):
    monkeypatch.setenv("AG2_API_KEY", "test-key")

    monkeypatch.setattr(orchestrator.designer_mod, "make_designer", lambda: object())
    monkeypatch.setattr(orchestrator.rectifier_mod, "make_rectifier", lambda: object())
    monkeypatch.setattr(orchestrator.verifier_mod, "make_verifier", lambda: None)

    # Both designer and rectifier produce bad plans — should hit cap.
    async def _mock_design(agent, h, d, q, sf):
        return _bad_plan_no_negative_control()

    async def _mock_rectify(agent, plan, viols, it):
        return _bad_plan_no_negative_control()

    monkeypatch.setattr(orchestrator.designer_mod, "design", _mock_design)
    monkeypatch.setattr(orchestrator.rectifier_mod, "rectify", _mock_rectify)

    result = await orchestrator.run(
        hypothesis="hypothesis text long enough",
        domain=None,
        qc=None,
        similar_feedback=[],
        max_iter=3,
    )
    assert result.iterations == 3
    assert result.verification.passed is False
