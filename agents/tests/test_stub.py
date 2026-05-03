"""Stub plan parity + shape tests.

The Python stub must be drop-in equivalent to TS stubPlan in src/lib/plan.ts.
These tests fix the structural invariants — anything else can drift, but these
guarantees make the demo-without-keys mode reliable.
"""

from __future__ import annotations

from app.schema import StoredFeedbackInput
from app.stub import stub_plan


def test_qpcr_hypothesis_includes_qpcr_materials():
    plan = stub_plan(
        hypothesis="qPCR validation of MYC mRNA expression in HeLa cells",
        domain="cell biology",
    )
    names = [m.name for m in plan.materials]
    assert any("RNeasy" in n for n in names)
    assert any("SsoAdvanced" in n for n in names)


def test_knockdown_hypothesis_adds_sirna_materials_and_step_2_title():
    plan = stub_plan(
        hypothesis="siRNA knockdown of TP53 reduces apoptosis under stress",
    )
    names = [m.name for m in plan.materials]
    assert any("siRNA" in n for n in names)
    assert any("Lipofectamine" in n for n in names)
    assert plan.protocol[1].title == "siRNA transfection"


def test_cisplatin_hypothesis_adds_positive_control_and_celltiterglo():
    plan = stub_plan(
        hypothesis="Cisplatin sensitivity in BRCA1 knockdown ovarian cancer cells",
    )
    assert any(c.type == "positive" for c in plan.controls)
    assert any("CellTiter-Glo" in m.name for m in plan.materials)


def test_budget_is_sum_of_materials_with_25_percent_buffer():
    plan = stub_plan(hypothesis="A general-purpose hypothesis", domain="microbiology")
    raw_sum = sum(m.estimatedCostUSD or 0 for m in plan.materials)
    assert plan.budgetUSD == round(raw_sum * 1.25)


def test_negative_control_always_present():
    plan = stub_plan(hypothesis="Some bland hypothesis with no special tokens")
    assert any(c.type == "negative" for c in plan.controls)


def test_reviewer_notes_summarize_corrections():
    feedback = [
        StoredFeedbackInput(
            hypothesis="prior",
            corrections=[
                {"section": "protocol", "corrected": "use 4°C not 0°C"},
                {"section": "materials", "corrected": "swap to Bio-Rad SsoAdvanced"},
            ],
        )
    ]
    plan = stub_plan(hypothesis="some hypothesis", similar_feedback=feedback)
    assert plan.reviewerNotes is not None
    assert "Incorporated 1 prior reviewer feedback record" in plan.reviewerNotes
    assert "use 4°C not 0°C" in plan.reviewerNotes


def test_plan_passes_pydantic_min_length_constraints():
    plan = stub_plan(hypothesis="qPCR knockdown cisplatin all keywords at once")
    assert len(plan.protocol) >= 1
    assert len(plan.materials) >= 1
    assert len(plan.controls) >= 1
    assert len(plan.validation) >= 1
    assert len(plan.timeline) >= 1
