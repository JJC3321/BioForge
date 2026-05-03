"""Tests for stub_sim: schema validity and domain detection."""

import pytest
from app.stub_sim import stub_sim
from app.stub import stub_plan
from app.schema import SimulationResult


def _base_plan(domain: str = "cell biology", hypothesis: str = "test hypothesis for experiment"):
    return stub_plan(hypothesis, domain)


def test_stub_sim_returns_valid_schema():
    plan = _base_plan()
    result = stub_sim(plan)
    assert isinstance(result, SimulationResult)
    assert 0 <= result.overallSuccessProbability <= 1
    assert 0 <= result.confidenceScore <= 1
    assert len(result.stepOutcomes) == len(plan.protocol)
    assert result.optimisticScenario
    assert result.pessimisticScenario
    assert len(result.criticalRisks) >= 1
    assert len(result.recommendations) >= 1


def test_stub_sim_pcr_detection():
    plan = _base_plan(domain="qPCR expression", hypothesis="Does BRCA1 mRNA expression change?")
    result = stub_sim(plan)
    assert result.experimentType == "pcr"
    assert result.overallSuccessProbability == pytest.approx(0.88)


def test_stub_sim_cell_culture_detection():
    plan = _base_plan(
        domain="cell biology",
        hypothesis="Does cisplatin affect cell viability and proliferation?",
    )
    result = stub_sim(plan)
    assert result.experimentType == "cell_culture"
    assert result.overallSuccessProbability == pytest.approx(0.82)


def test_stub_sim_western_blot_detection():
    plan = _base_plan(
        domain="western blot protein expression",
        hypothesis="Does knockdown reduce western blot band intensity?",
    )
    result = stub_sim(plan)
    assert result.experimentType == "western_blot"
    assert result.overallSuccessProbability == pytest.approx(0.85)


def test_stub_sim_generic_fallback():
    # stub_plan always includes "Cell culture preparation" — build a minimal plan manually.
    from app.schema import (
        Control, ExperimentPlan, Material, ProtocolStep, StructuredHypothesis, TimelinePhase
    )
    plan = ExperimentPlan(
        domain="general biochemistry",
        structuredHypothesis=StructuredHypothesis(
            question="Does compound X inhibit enzyme Y?",
            independentVariable="compound X concentration",
            dependentVariable="enzyme Y activity",
            predictedOutcome="IC50 shift under compound X",
        ),
        protocol=[
            ProtocolStep(step=1, title="Sample preparation", description="Prepare samples.", durationMinutes=30),
            ProtocolStep(step=2, title="Assay incubation", description="Incubate with compound.", durationMinutes=60),
            ProtocolStep(step=3, title="Measurement", description="Read absorbance.", durationMinutes=15, critical=True),
            ProtocolStep(step=4, title="Data analysis", description="Compute IC50.", durationMinutes=60),
        ],
        materials=[Material(name="Compound X", quantity="1 mg", estimatedCostUSD=50)],
        controls=[Control(name="DMSO vehicle", type="negative", description="Solvent control.")],
        validation=["Triplicate runs"],
        risks=[],
        timeline=[TimelinePhase(phase="Experiment", durationDays=1)],
        budgetUSD=100,
    )
    result = stub_sim(plan)
    assert result.experimentType == "generic"
    assert result.overallSuccessProbability == pytest.approx(0.78)


def test_stub_sim_step_count_matches_protocol():
    plan = _base_plan()
    result = stub_sim(plan)
    assert len(result.stepOutcomes) == len(plan.protocol)
    for i, outcome in enumerate(result.stepOutcomes):
        assert outcome.stepIndex == i


def test_stub_sim_critical_steps_have_lower_prob():
    plan = _base_plan()
    result = stub_sim(plan)
    critical_probs = [
        o.successProbability
        for o, s in zip(result.stepOutcomes, plan.protocol)
        if s.critical and s.step < len(plan.protocol)
    ]
    non_critical_probs = [
        o.successProbability
        for o, s in zip(result.stepOutcomes, plan.protocol)
        if not s.critical and s.step < len(plan.protocol)
    ]
    if critical_probs and non_critical_probs:
        assert min(critical_probs) < max(non_critical_probs)


def test_stub_sim_last_step_high_confidence():
    plan = _base_plan()
    result = stub_sim(plan)
    last = result.stepOutcomes[-1]
    assert last.successProbability >= 0.95


def test_stub_sim_serialises_to_json():
    plan = _base_plan()
    result = stub_sim(plan)
    data = result.model_dump()
    reparsed = SimulationResult.model_validate(data)
    assert reparsed.experimentType == result.experimentType
