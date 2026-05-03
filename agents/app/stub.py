"""Deterministic, domain-aware stub experiment plan.

Direct port of stubPlan() in src/lib/plan.ts:186-385. The shape, regex matchers,
templated steps/materials/controls/risks/timeline, and the 25%-overhead budget
buffer must stay in lockstep with the TS version so behavior is identical when
the Python service is the one serving the no-API-key fallback.
"""

from __future__ import annotations

import re
from typing import List, Optional

from .schema import (
    Control,
    ExperimentPlan,
    Material,
    ProtocolStep,
    Risk,
    StoredFeedbackInput,
    StructuredHypothesis,
    TimelinePhase,
)

_DOM_QPCR = re.compile(r"qpcr|rt-pcr|expression", re.IGNORECASE)
_HYP_QPCR = re.compile(r"qpcr|mrna|expression", re.IGNORECASE)
_HYP_KNOCKDOWN = re.compile(r"knockdown|sirna|shrna|knock-?out", re.IGNORECASE)
_HYP_CISPLATIN = re.compile(r"cisplatin|chemo|platinum", re.IGNORECASE)


def _reviewer_notes(similar: List[StoredFeedbackInput]) -> Optional[str]:
    if not similar:
        return None
    correcteds: List[str] = []
    for fb in similar:
        for c in fb.corrections:
            corrected = c.get("corrected") if isinstance(c, dict) else None
            if isinstance(corrected, str):
                correcteds.append(corrected)
    summary = "; ".join(correcteds[:3]) if correcteds else "(none — only ratings/notes)"
    return (
        f"Incorporated {len(similar)} prior reviewer feedback record(s). "
        f"Key prior corrections applied: {summary}"
    )


def stub_plan(
    hypothesis: str,
    domain: Optional[str] = None,
    similar_feedback: Optional[List[StoredFeedbackInput]] = None,
) -> ExperimentPlan:
    similar = similar_feedback or []
    dom = (domain or "cell biology").lower()
    is_qpcr = bool(_DOM_QPCR.search(dom)) or bool(_HYP_QPCR.search(hypothesis))
    is_knockdown = bool(_HYP_KNOCKDOWN.search(hypothesis))
    is_cisplatin = bool(_HYP_CISPLATIN.search(hypothesis))

    structured_hypothesis = StructuredHypothesis(
        question=hypothesis,
        independentVariable=(
            "siRNA-mediated knockdown of target gene"
            if is_knockdown
            else "experimental treatment"
        ),
        dependentVariable=(
            "cell viability and apoptosis under cisplatin"
            if is_cisplatin
            else "target mRNA abundance"
            if is_qpcr
            else "cellular phenotype readout"
        ),
        predictedOutcome=(
            "Reduced viability and increased apoptosis in knockdown vs control under cisplatin"
            if is_cisplatin
            else "Statistically significant change in the dependent variable in treatment vs control"
        ),
        scope="in vitro, single cell line, biological triplicate",
    )

    protocol = [
        ProtocolStep(
            step=1,
            title="Cell culture preparation",
            description=(
                "Thaw and expand cells to passage 3–8. Maintain in DMEM + 10% FBS + 1% Pen/Strep "
                "at 37°C, 5% CO2. Confirm mycoplasma-negative."
            ),
            durationMinutes=4320,
            critical=True,
        ),
        ProtocolStep(
            step=2,
            title="siRNA transfection" if is_knockdown else "Treatment setup",
            description=(
                "Reverse-transfect with 20 nM siRNA (target + non-targeting control) using "
                "Lipofectamine RNAiMAX in Opti-MEM. Plate at 1.5e5 cells/well in 6-well format. "
                "Triplicate wells per condition."
            )
            if is_knockdown
            else (
                "Plate cells at appropriate density. Apply treatment vs vehicle control across "
                "triplicate wells."
            ),
            durationMinutes=60,
            critical=True,
        ),
        ProtocolStep(
            step=3,
            title="Knockdown / treatment validation",
            description=(
                "At 48 h post-transfection, harvest a subset of wells. Confirm knockdown by qPCR "
                "(target mRNA) and Western blot (target protein). Require ≥70% mRNA reduction."
            )
            if is_knockdown
            else (
                "Confirm treatment delivery and cellular response with appropriate marker readout."
            ),
            durationMinutes=240,
        ),
        ProtocolStep(
            step=4,
            title=(
                "Cisplatin dose-response challenge"
                if is_cisplatin
                else "Phenotypic challenge / readout"
            ),
            description=(
                "At 48 h post-transfection, treat with cisplatin dose series "
                "(0, 1, 5, 10, 25 μM) for 48 h."
            )
            if is_cisplatin
            else "Apply experimental challenge. Capture readouts at 24 and 48 h.",
            durationMinutes=2880,
        ),
        ProtocolStep(
            step=5,
            title="Primary readout",
            description=(
                "Measure viability with CellTiter-Glo. Compute IC50 per condition. Confirm with "
                "Annexin V / PI flow cytometry."
            )
            if is_cisplatin
            else (
                "Extract RNA (RNeasy), reverse transcribe (random hexamers, 500 ng), and run qPCR "
                "with target + 2 reference genes (GAPDH, ACTB). Run in technical triplicate."
            )
            if is_qpcr
            else "Capture primary phenotypic measurement in technical triplicate.",
            durationMinutes=360,
            critical=True,
        ),
        ProtocolStep(
            step=6,
            title="Statistical analysis",
            description=(
                "Two-way ANOVA with Tukey post-hoc (for dose × condition), or appropriate test. "
                "Report mean ± SD across biological triplicates. Pre-specify significance threshold α = 0.05."
            ),
            durationMinutes=120,
        ),
    ]

    materials: List[Material] = [
        Material(
            name="Cell line (e.g. A549)",
            quantity="1 vial",
            supplier="ATCC",
            catalogNumber="CCL-185",
            estimatedCostUSD=600,
        ),
        Material(
            name="DMEM + GlutaMAX",
            quantity="500 mL",
            supplier="Thermo Fisher",
            catalogNumber="10566016",
            estimatedCostUSD=25,
        ),
        Material(
            name="Fetal Bovine Serum",
            quantity="500 mL",
            supplier="Thermo Fisher",
            catalogNumber="16000044",
            estimatedCostUSD=450,
        ),
        Material(
            name="Pen/Strep",
            quantity="100 mL",
            supplier="Thermo Fisher",
            catalogNumber="15140122",
            estimatedCostUSD=35,
        ),
    ]
    if is_knockdown:
        materials.extend(
            [
                Material(
                    name="Target siRNA + non-targeting control",
                    quantity="10 nmol each",
                    supplier="Dharmacon",
                    catalogNumber="ON-TARGETplus",
                    estimatedCostUSD=350,
                ),
                Material(
                    name="Lipofectamine RNAiMAX",
                    quantity="1.5 mL",
                    supplier="Thermo Fisher",
                    catalogNumber="13778075",
                    estimatedCostUSD=280,
                ),
                Material(
                    name="Opti-MEM I",
                    quantity="500 mL",
                    supplier="Thermo Fisher",
                    catalogNumber="31985070",
                    estimatedCostUSD=30,
                ),
            ]
        )
    if is_qpcr:
        materials.extend(
            [
                Material(
                    name="RNeasy Mini Kit",
                    quantity="50 preps",
                    supplier="Qiagen",
                    catalogNumber="74104",
                    estimatedCostUSD=380,
                ),
                Material(
                    name="iScript cDNA Synthesis Kit",
                    quantity="100 rxns",
                    supplier="Bio-Rad",
                    catalogNumber="1708890",
                    estimatedCostUSD=320,
                ),
                Material(
                    name="SsoAdvanced Universal SYBR Green",
                    quantity="500 rxns",
                    supplier="Bio-Rad",
                    catalogNumber="1725270",
                    estimatedCostUSD=260,
                ),
                Material(
                    name="Custom qPCR primers (target + GAPDH + ACTB)",
                    quantity="3 pairs",
                    supplier="IDT",
                    estimatedCostUSD=60,
                ),
            ]
        )
    if is_cisplatin:
        materials.extend(
            [
                Material(
                    name="Cisplatin",
                    quantity="50 mg",
                    supplier="Sigma-Aldrich",
                    catalogNumber="P4394",
                    estimatedCostUSD=95,
                ),
                Material(
                    name="CellTiter-Glo 2.0",
                    quantity="10 mL",
                    supplier="Promega",
                    catalogNumber="G9241",
                    estimatedCostUSD=280,
                ),
            ]
        )
    materials.append(
        Material(
            name="6-well tissue culture plates",
            quantity="5 packs",
            supplier="Corning",
            catalogNumber="3516",
            estimatedCostUSD=90,
        )
    )

    controls: List[Control] = [
        Control(
            name="Non-targeting siRNA" if is_knockdown else "Vehicle control",
            type="negative",
            description=(
                "Scrambled siRNA (Dharmacon ON-TARGETplus Non-targeting Pool) at the same "
                "concentration as the targeting siRNA."
            )
            if is_knockdown
            else "Vehicle-only condition matched for solvent and volume.",
        ),
        Control(
            name="Untransfected / untreated baseline",
            type="biological",
            description="Cells receiving no perturbation, processed in parallel.",
        ),
        Control(
            name="No-RT and no-template qPCR controls",
            type="technical",
            description=(
                "Confirm absence of genomic DNA contamination and primer specificity."
            ),
        ),
    ]
    if is_cisplatin:
        controls.append(
            Control(
                name="Positive cytotoxicity control (staurosporine)",
                type="positive",
                description=(
                    "1 μM staurosporine to confirm assay sensitivity to apoptosis induction."
                ),
            )
        )

    validation = [
        (
            "Confirm ≥70% knockdown at mRNA AND protein level before downstream readout."
            if is_knockdown
            else "Confirm treatment efficacy with marker readout before downstream assay."
        ),
        "Run all conditions in biological triplicate (independent transfections / treatments).",
        "Use ≥2 reference genes for qPCR normalization where applicable.",
        "Replicate the key finding in a second cell line if time permits.",
    ]

    risks = [
        Risk(
            description="Off-target siRNA effects confounding phenotype",
            severity="medium",
            mitigation=(
                "Use pooled siRNA + rescue with siRNA-resistant cDNA, or confirm with a second "
                "independent siRNA."
            ),
        ),
        Risk(
            description="Low or variable knockdown efficiency",
            severity="medium",
            mitigation=(
                "Optimize transfection conditions; QC each batch by qPCR before proceeding."
            ),
        ),
        Risk(
            description="Cytotoxicity from transfection reagent itself",
            severity="low",
            mitigation=(
                "Include reagent-only control; titrate Lipofectamine if viability drops in mock."
            ),
        ),
        Risk(
            description="Mycoplasma contamination skewing phenotype",
            severity="high",
            mitigation="Test cells monthly; quarantine new cultures until confirmed negative.",
        ),
        Risk(
            description="Statistical underpowering",
            severity="medium",
            mitigation=(
                "Power analysis before starting; n=3 biological reps minimum, increase if effect "
                "size unclear."
            ),
        ),
    ]

    timeline = [
        TimelinePhase(
            phase="Cell expansion & QC",
            durationDays=7,
            description="Thaw, expand, mycoplasma test.",
        ),
        TimelinePhase(phase="Transfection / treatment", durationDays=1),
        TimelinePhase(
            phase="Knockdown validation",
            durationDays=2,
            description="qPCR + Western.",
        ),
        TimelinePhase(phase="Phenotypic challenge", durationDays=2),
        TimelinePhase(phase="Readout & analysis", durationDays=3),
        TimelinePhase(phase="Replicate (biological triplicate cycles)", durationDays=14),
    ]

    mat_sum = sum(m.estimatedCostUSD or 0 for m in materials)
    budget_usd = round(mat_sum * 1.25)

    return ExperimentPlan(
        domain=domain or "cell biology",
        structuredHypothesis=structured_hypothesis,
        protocol=protocol,
        materials=materials,
        controls=controls,
        validation=validation,
        risks=risks,
        timeline=timeline,
        budgetUSD=budget_usd,
        reviewerNotes=_reviewer_notes(similar),
        assumptions=[
            "Standard wet lab access (BSL-2, tissue culture hood, qPCR machine, plate reader).",
            "Cell line and reagents are not on backorder.",
            "Personnel familiar with sterile technique and qPCR.",
        ],
    )
