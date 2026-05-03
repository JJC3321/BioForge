"""Unit tests for each rule in verifier_rules.verify_with_rules.

One test per rule category. Tests build minimal valid plans and inject specific
violations.
"""

from __future__ import annotations

from typing import Any

from app.schema import (
    Control,
    ExperimentPlan,
    Material,
    ProtocolStep,
    StructuredHypothesis,
    TimelinePhase,
)
from app.verifier_rules import score_violations, verify_with_rules


def _base_plan(**overrides: Any) -> ExperimentPlan:
    base = dict(
        domain="cell biology",
        structuredHypothesis=StructuredHypothesis(
            question="q",
            independentVariable="iv",
            dependentVariable="dv",
            predictedOutcome="po",
        ),
        protocol=[
            ProtocolStep(step=1, title="x", description="Incubate at 37°C.", durationMinutes=30),
            ProtocolStep(step=2, title="y", description="Spin.", durationMinutes=10),
            ProtocolStep(step=3, title="z", description="Read.", durationMinutes=5),
        ],
        materials=[Material(name="DMEM", quantity="500 mL", estimatedCostUSD=25)],
        controls=[
            Control(name="vehicle", type="negative", description="vehicle"),
            Control(name="baseline", type="biological", description="baseline"),
        ],
        validation=["confirm with replicate"],
        risks=[],
        timeline=[TimelinePhase(phase="run", durationDays=1)],
        budgetUSD=500,
    )
    base.update(overrides)
    return ExperimentPlan(**base)


def test_temperature_above_max_is_error():
    plan = _base_plan(
        protocol=[
            ProtocolStep(step=1, title="bad", description="Heat to 250°C briefly."),
            ProtocolStep(step=2, title="ok", description="Cool to 4°C."),
            ProtocolStep(step=3, title="ok", description="Read."),
        ],
    )
    violations = verify_with_rules(plan)
    assert any(v.type == "temperature" and v.severity == "error" for v in violations)


def test_zero_duration_is_error():
    plan = _base_plan(
        protocol=[
            ProtocolStep(step=1, title="bad", description="Touch.", durationMinutes=0),
            ProtocolStep(step=2, title="ok", description="Spin.", durationMinutes=10),
            ProtocolStep(step=3, title="ok", description="Read.", durationMinutes=5),
        ],
    )
    violations = verify_with_rules(plan)
    assert any(v.type == "timing" and v.severity == "error" for v in violations)


def test_excessive_step_duration_is_warning():
    plan = _base_plan(
        protocol=[
            ProtocolStep(step=1, title="long", description="Wait.", durationMinutes=200 * 60),
            ProtocolStep(step=2, title="ok", description="Spin.", durationMinutes=10),
            ProtocolStep(step=3, title="ok", description="Read.", durationMinutes=5),
        ],
    )
    violations = verify_with_rules(plan)
    assert any(v.type == "timing" and v.severity == "warning" for v in violations)


def test_budget_above_max_is_warning():
    plan = _base_plan(budgetUSD=99_999)
    violations = verify_with_rules(plan)
    assert any(v.type == "budget" and v.severity == "warning" for v in violations)


def test_missing_negative_control_is_error():
    plan = _base_plan(
        controls=[
            Control(name="pos", type="positive", description="positive"),
            Control(name="bio", type="biological", description="bio"),
        ]
    )
    violations = verify_with_rules(plan)
    assert any(v.type == "physical" and "negative control" in v.message for v in violations)


def test_too_few_controls_warns():
    plan = _base_plan(
        controls=[Control(name="vehicle", type="negative", description="vehicle")]
    )
    violations = verify_with_rules(plan)
    assert any(v.type == "physical" and v.severity == "warning" for v in violations)


def test_edta_with_pcr_is_incompatible():
    plan = _base_plan(
        protocol=[
            ProtocolStep(step=1, title="setup", description="Run PCR with 50 mM EDTA buffer."),
            ProtocolStep(step=2, title="ok", description="Spin."),
            ProtocolStep(step=3, title="ok", description="Read."),
        ]
    )
    violations = verify_with_rules(plan)
    assert any(v.type == "material" and "EDTA" in v.message for v in violations)


def test_clean_plan_passes_with_score_1():
    plan = _base_plan()
    violations = verify_with_rules(plan)
    result = score_violations(violations)
    assert result.passed is True
    assert result.physicalComplianceScore == 1.0


def test_score_drops_with_errors():
    plan = _base_plan(
        controls=[Control(name="pos", type="positive", description="positive")]
    )  # missing negative + too few
    violations = verify_with_rules(plan)
    result = score_violations(violations)
    assert result.passed is False
    assert result.physicalComplianceScore < 1.0
