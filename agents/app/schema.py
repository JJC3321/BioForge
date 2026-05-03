"""Pydantic mirrors of src/lib/schema.ts.

The wire format is the source of truth — these models must serialize/deserialize
to the same JSON as the Zod schemas. When `src/lib/schema.ts` changes, update
this file too.
"""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

NoveltySignal = Literal["match", "near_match", "no_match"]
ControlType = Literal["positive", "negative", "technical", "biological", "other"]
RiskSeverity = Literal["low", "medium", "high"]
ViolationType = Literal[
    "temperature", "timing", "material", "ordering", "budget", "physical"
]
ViolationSeverity = Literal["error", "warning"]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)


class Reference(_Strict):
    title: str
    authors: Optional[str] = None
    year: Optional[int] = None
    venue: Optional[str] = None
    doi: Optional[str] = None
    url: Optional[str] = None
    snippet: Optional[str] = None
    similarity: Optional[float] = Field(default=None, ge=0.0, le=1.0)


class QCResult(_Strict):
    novelty: NoveltySignal
    rationale: str
    references: List[Reference] = Field(default_factory=list, max_length=5)
    searchedQueries: Optional[List[str]] = None


class ProtocolStep(_Strict):
    step: int = Field(ge=1)
    title: str
    description: str
    durationMinutes: Optional[int] = Field(default=None, ge=0)
    critical: Optional[bool] = None


class Material(_Strict):
    name: str
    quantity: str
    supplier: Optional[str] = None
    catalogNumber: Optional[str] = None
    estimatedCostUSD: Optional[float] = Field(default=None, ge=0)
    notes: Optional[str] = None


class Control(_Strict):
    name: str
    type: ControlType
    description: str


class Risk(_Strict):
    description: str
    severity: RiskSeverity
    mitigation: str


class TimelinePhase(_Strict):
    phase: str
    durationDays: float = Field(ge=0)
    description: Optional[str] = None


class StructuredHypothesis(_Strict):
    question: str
    independentVariable: str
    dependentVariable: str
    predictedOutcome: str
    scope: Optional[str] = None


class ExperimentPlan(_Strict):
    domain: str
    structuredHypothesis: StructuredHypothesis
    protocol: List[ProtocolStep] = Field(min_length=1)
    materials: List[Material] = Field(min_length=1)
    controls: List[Control] = Field(min_length=1)
    validation: List[str] = Field(min_length=1)
    risks: List[Risk] = Field(default_factory=list)
    timeline: List[TimelinePhase] = Field(min_length=1)
    budgetUSD: float = Field(ge=0)
    reviewerNotes: Optional[str] = None
    assumptions: Optional[List[str]] = None


class Violation(_Strict):
    type: ViolationType
    stepIndex: Optional[int] = None
    field: str
    message: str
    severity: ViolationSeverity


class VerificationResult(_Strict):
    passed: bool
    violations: List[Violation] = Field(default_factory=list)
    physicalComplianceScore: float = Field(ge=0.0, le=1.0)


class StoredFeedbackInput(_Strict):
    """Subset of StoredFeedback that the Node side ships in the /plan request body."""

    hypothesis: str
    domain: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    ratings: List[dict] = Field(default_factory=list)
    corrections: List[dict] = Field(default_factory=list)
    freeformNotes: Optional[str] = None


class PlanRequest(_Strict):
    hypothesis: str = Field(min_length=8, max_length=2000)
    domain: Optional[str] = None
    qc: Optional[QCResult] = None
    similarFeedback: List[StoredFeedbackInput] = Field(default_factory=list)


class PlanResponse(_Strict):
    plan: ExperimentPlan
    verification: Optional[VerificationResult] = None
    iterations: int = 0
    source: Literal["agents", "stub"] = "stub"


ExperimentType = Literal["pcr", "cell_culture", "western_blot", "generic"]


class StepOutcome(_Strict):
    stepIndex: int
    title: str
    successProbability: float = Field(ge=0.0, le=1.0)
    predictedYield: Optional[str] = None
    riskFlags: List[str] = Field(default_factory=list)


class StepwiseSimulation(_Strict):
    experimentType: ExperimentType
    stepOutcomes: List[StepOutcome]
    notes: Optional[str] = None


class SimulationResult(_Strict):
    experimentType: ExperimentType
    overallSuccessProbability: float = Field(ge=0.0, le=1.0)
    confidenceScore: float = Field(ge=0.0, le=1.0)
    stepOutcomes: List[StepOutcome]
    criticalRisks: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    optimisticScenario: str
    pessimisticScenario: str
    reportMarkdown: Optional[str] = None


class SimRequest(_Strict):
    plan: ExperimentPlan
    hypothesis: str = Field(min_length=8)
    nRuns: int = Field(default=100, ge=10, le=1000)


class SimResponse(_Strict):
    result: SimulationResult
    source: Literal["agents", "stub"] = "stub"
