"""Rule-based verification of an ExperimentPlan.

Port of verifyWithRules() in src/lib/biopro-agent.ts:214-318. Each rule maps
1:1 to a check in the TS source so behavior parity is auditable.
"""

from __future__ import annotations

import re
from typing import List

from . import constraints as C
from .schema import ExperimentPlan, VerificationResult, Violation

_TEMP_REGEX = re.compile(r"(\d+)\s*°?C", re.IGNORECASE)


def verify_with_rules(plan: ExperimentPlan) -> List[Violation]:
    violations: List[Violation] = []

    # Temperature checks (regex-scrape descriptions for "NN°C")
    for i, step in enumerate(plan.protocol):
        match = _TEMP_REGEX.search(step.description)
        if match:
            temp = int(match.group(1))
            if temp > C.TEMPERATURE.max_allowed:
                violations.append(
                    Violation(
                        type="temperature",
                        stepIndex=i,
                        field=f"protocol.{i}.description",
                        message=(
                            f"Temperature {temp}°C exceeds maximum "
                            f"{C.TEMPERATURE.max_allowed}°C"
                        ),
                        severity="error",
                    )
                )

    # Timing checks
    for i, step in enumerate(plan.protocol):
        if step.durationMinutes is None:
            continue
        if step.durationMinutes < C.TIMING.min_duration_minutes:
            violations.append(
                Violation(
                    type="timing",
                    stepIndex=i,
                    field=f"protocol.{i}.durationMinutes",
                    message=(
                        f"Duration {step.durationMinutes}m below minimum "
                        f"{C.TIMING.min_duration_minutes}m"
                    ),
                    severity="error",
                )
            )
        if step.durationMinutes > C.TIMING.max_step_duration_hours * 60:
            violations.append(
                Violation(
                    type="timing",
                    stepIndex=i,
                    field=f"protocol.{i}.durationMinutes",
                    message=(
                        f"Duration {step.durationMinutes}m exceeds max "
                        f"{C.TIMING.max_step_duration_hours}h"
                    ),
                    severity="warning",
                )
            )

    # Budget bounds
    if plan.budgetUSD > C.BUDGET.max_reasonable_usd:
        violations.append(
            Violation(
                type="budget",
                field="budgetUSD",
                message=(
                    f"Budget ${plan.budgetUSD} exceeds reasonable max "
                    f"${C.BUDGET.max_reasonable_usd}"
                ),
                severity="warning",
            )
        )
    if plan.budgetUSD < C.BUDGET.min_reasonable_usd:
        violations.append(
            Violation(
                type="budget",
                field="budgetUSD",
                message=(
                    f"Budget ${plan.budgetUSD} below reasonable min "
                    f"${C.BUDGET.min_reasonable_usd}"
                ),
                severity="warning",
            )
        )

    # Controls
    has_negative = any(c.type == "negative" for c in plan.controls)
    if not has_negative and C.REQUIRED_CONTROLS.must_have_negative:
        violations.append(
            Violation(
                type="physical",
                field="controls",
                message="Missing required negative control",
                severity="error",
            )
        )
    if len(plan.controls) < C.REQUIRED_CONTROLS.min_controls:
        violations.append(
            Violation(
                type="physical",
                field="controls",
                message=(
                    f"Only {len(plan.controls)} controls, need at least "
                    f"{C.REQUIRED_CONTROLS.min_controls}"
                ),
                severity="warning",
            )
        )

    # Reagent compatibility (case-insensitive substring match across protocol + materials)
    full_text = (
        " ".join(s.description for s in plan.protocol)
        + " "
        + " ".join(m.name for m in plan.materials)
    ).lower()
    for conflict in C.REAGENT_COMPATIBILITY:
        r1, r2 = conflict.reagents
        if r1.lower() in full_text and r2.lower() in full_text:
            violations.append(
                Violation(
                    type="material",
                    field="materials",
                    message=(
                        f"Incompatible reagents: {r1} with {r2} - "
                        f"{conflict.reason}"
                    ),
                    severity="error",
                )
            )

    return violations


def score_violations(violations: List[Violation]) -> VerificationResult:
    """Mirror compliance-score math from biopro-agent.ts:381-393."""
    errors = sum(1 for v in violations if v.severity == "error")
    warnings = sum(1 for v in violations if v.severity == "warning")
    if errors > 0:
        score = max(0.0, 1.0 - errors * 0.2)
    elif warnings > 0:
        score = 0.8
    else:
        score = 1.0
    return VerificationResult(
        passed=errors == 0,
        violations=violations,
        physicalComplianceScore=score,
    )
