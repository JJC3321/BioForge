"""Deterministic dry-run simulation stub.

Returns a credible SimulationResult with no LLM call. Used when AG2_API_KEY is
unset or the sidecar falls back. Must produce output that passes SimulationResult
Pydantic validation.
"""

from __future__ import annotations

import re

from .schema import ExperimentPlan, SimulationResult, StepOutcome

_PCR = re.compile(r"pcr|qpcr|rt-pcr|amplif|primer", re.IGNORECASE)
_CELL = re.compile(
    r"cell (culture|line|growth)|tissue culture|proliferat|viabilit|confluenc", re.IGNORECASE
)
_WB = re.compile(r"western|immunoblot|blot|protein express|antibody", re.IGNORECASE)


def stub_sim(plan: ExperimentPlan) -> SimulationResult:
    # Classify on domain + step *titles* only — descriptions come from the stub plan and
    # always contain cell-culture/qPCR text regardless of the actual experiment type.
    signal = plan.domain + " " + " ".join(s.title for s in plan.protocol)

    # Priority order: WB → PCR → cell culture → generic.
    # WB must precede PCR because WB protocols include qPCR validation steps.
    if _WB.search(signal):
        exp_type = "western_blot"
        base_prob = 0.85
        contamination_flag = "Antibody cross-reactivity risk: ~10–15% non-specific signal"
        opt = "Clean bands at expected molecular weights; signal-to-noise ratio >10:1."
        pess = (
            "Non-specific bands at 1–2 molecular weights; "
            "background noise requires blocking optimisation."
        )
        risk_extra = "Transfer efficiency variance: ±15% depending on protein size"
    elif _PCR.search(signal):
        exp_type = "pcr"
        base_prob = 0.88
        contamination_flag = "Contamination risk: ~5% per reaction"
        opt = (
            "All amplicons yield clean bands at 95% efficiency; no non-specific products detected."
        )
        pess = (
            "Primer dimers or non-specific amplification in 1–2 targets; "
            "overall efficiency drops to ~80%."
        )
        risk_extra = "Efficiency variability: PCR amplification ±10% across runs"
    elif _CELL.search(signal):
        exp_type = "cell_culture"
        base_prob = 0.82
        contamination_flag = "Mycoplasma/bacterial contamination risk: ~3% per passage"
        opt = (
            "Cells reach optimal confluence; doubling time within expected range; "
            "no contamination detected."
        )
        pess = (
            "Contamination event requires full restart (3% probability per passage); "
            "doubling time variability ±20%."
        )
        risk_extra = "Passage drift risk: phenotypic changes beyond passage 15"
    else:
        exp_type = "generic"
        base_prob = 0.78
        contamination_flag = "General contamination/failure risk: ~10%"
        opt = "All steps succeed on first attempt within expected parameter ranges."
        pess = "One or more steps require repetition; 20–25% yield reduction from variance."
        risk_extra = "Protocol specificity is low — results may have high inter-run variance"

    step_outcomes: list[StepOutcome] = []
    for s in plan.protocol:
        if s.step == len(plan.protocol):
            prob = 0.97
            flags: list[str] = []
        elif s.critical:
            prob = round(base_prob - 0.06, 2)
            flags = [contamination_flag]
        else:
            prob = round(min(base_prob + 0.04, 0.95), 2)
            flags = []

        step_outcomes.append(
            StepOutcome(
                stepIndex=s.step - 1,
                title=s.title,
                successProbability=prob,
                predictedYield=(
                    f"~{int(prob * 100)}% expected efficiency" if exp_type == "pcr" else None
                ),
                riskFlags=flags,
            )
        )

    return SimulationResult(
        experimentType=exp_type,
        overallSuccessProbability=base_prob,
        confidenceScore=0.72,
        stepOutcomes=step_outcomes,
        criticalRisks=[contamination_flag, risk_extra],
        recommendations=[
            "Run in biological triplicate to account for stochastic variance",
            "Pre-warm all reagents to the specified temperature before use",
            "Include a QC checkpoint after each step marked critical",
        ],
        optimisticScenario=opt,
        pessimisticScenario=pess,
        reportMarkdown=None,
    )
