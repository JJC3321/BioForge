import { z } from "zod";

export const HypothesisInput = z.object({
  hypothesis: z.string().min(8).max(2000),
  domain: z.string().optional(),
});
export type HypothesisInput = z.infer<typeof HypothesisInput>;

export const Reference = z.object({
  title: z.string(),
  authors: z.string().nullish(),
  year: z.number().int().nullish(),
  venue: z.string().nullish(),
  doi: z.string().nullish(),
  url: z.string().nullish(),
  snippet: z.string().nullish(),
  similarity: z.number().min(0).max(1).nullish(),
});
export type Reference = z.infer<typeof Reference>;

export const NoveltySignal = z.enum(["match", "near_match", "no_match"]);
export type NoveltySignal = z.infer<typeof NoveltySignal>;

export const QCResult = z.object({
  novelty: NoveltySignal,
  rationale: z.string(),
  references: z.array(Reference).max(5),
  searchedQueries: z.array(z.string()).nullish(),
});
export type QCResult = z.infer<typeof QCResult>;

export const ProtocolStep = z.object({
  step: z.number().int().min(1),
  title: z.string(),
  description: z.string(),
  durationMinutes: z.number().int().nonnegative().nullish(),
  critical: z.boolean().nullish(),
});
export type ProtocolStep = z.infer<typeof ProtocolStep>;

export const Material = z.object({
  name: z.string(),
  quantity: z.string(),
  supplier: z.string().nullish(),
  catalogNumber: z.string().nullish(),
  estimatedCostUSD: z.number().nonnegative().nullish(),
  notes: z.string().nullish(),
});
export type Material = z.infer<typeof Material>;

export const Control = z.object({
  name: z.string(),
  type: z.enum(["positive", "negative", "technical", "biological", "other"]),
  description: z.string(),
});
export type Control = z.infer<typeof Control>;

export const Risk = z.object({
  description: z.string(),
  severity: z.enum(["low", "medium", "high"]),
  mitigation: z.string(),
});
export type Risk = z.infer<typeof Risk>;

export const TimelinePhase = z.object({
  phase: z.string(),
  durationDays: z.number().nonnegative(),
  description: z.string().nullish(),
});
export type TimelinePhase = z.infer<typeof TimelinePhase>;

export const StructuredHypothesis = z.object({
  question: z.string(),
  independentVariable: z.string(),
  dependentVariable: z.string(),
  predictedOutcome: z.string(),
  scope: z.string().nullish(),
});
export type StructuredHypothesis = z.infer<typeof StructuredHypothesis>;

export const ExperimentPlan = z.object({
  domain: z.string(),
  structuredHypothesis: StructuredHypothesis,
  protocol: z.array(ProtocolStep).min(1),
  materials: z.array(Material).min(1),
  controls: z.array(Control).min(1),
  validation: z.array(z.string()).min(1),
  risks: z.array(Risk),
  timeline: z.array(TimelinePhase).min(1),
  budgetUSD: z.number().nonnegative(),
  reviewerNotes: z.string().nullish(),
  assumptions: z.array(z.string()).nullish(),
});
export type ExperimentPlan = z.infer<typeof ExperimentPlan>;

export const SectionRating = z.object({
  section: z.enum([
    "structuredHypothesis",
    "protocol",
    "materials",
    "controls",
    "validation",
    "risks",
    "timeline",
    "budget",
    "overall",
  ]),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullish(),
});
export type SectionRating = z.infer<typeof SectionRating>;

export const InlineCorrection = z.object({
  section: z.string(),
  path: z.string().nullish(),
  original: z.string().nullish(),
  corrected: z.string(),
  reason: z.string().nullish(),
});
export type InlineCorrection = z.infer<typeof InlineCorrection>;

export const FeedbackPayload = z.object({
  planId: z.string(),
  hypothesis: z.string(),
  domain: z.string().nullish(),
  tags: z.array(z.string()).default([]),
  ratings: z.array(SectionRating).default([]),
  corrections: z.array(InlineCorrection).default([]),
  freeformNotes: z.string().nullish(),
});
export type FeedbackPayload = z.infer<typeof FeedbackPayload>;

export const PlanRecord = z.object({
  id: z.string(),
  hypothesis: z.string(),
  domain: z.string().nullish(),
  plan: ExperimentPlan,
  qc: QCResult,
  createdAt: z.number(),
});
export type PlanRecord = z.infer<typeof PlanRecord>;

// BioProAgent neuro-symbolic constraint schemas
export const Violation = z.object({
  type: z.enum(["temperature", "timing", "material", "ordering", "budget", "physical"]),
  stepIndex: z.number().nullish(),
  field: z.string(),
  message: z.string(),
  severity: z.enum(["error", "warning"]),
});
export type Violation = z.infer<typeof Violation>;

export const VerificationResult = z.object({
  passed: z.boolean(),
  violations: z.array(Violation),
  physicalComplianceScore: z.number().min(0).max(1),
});
export type VerificationResult = z.infer<typeof VerificationResult>;

// Dry-Run Simulator schemas (mirrors agents/app/schema.py)
export const StepOutcome = z.object({
  stepIndex: z.number().int(),
  title: z.string(),
  successProbability: z.number().min(0).max(1),
  predictedYield: z.string().nullish(),
  riskFlags: z.array(z.string()).default([]),
});
export type StepOutcome = z.infer<typeof StepOutcome>;

export const SimulationResult = z.object({
  experimentType: z.enum(["pcr", "cell_culture", "western_blot", "generic"]),
  overallSuccessProbability: z.number().min(0).max(1),
  confidenceScore: z.number().min(0).max(1),
  stepOutcomes: z.array(StepOutcome),
  criticalRisks: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  optimisticScenario: z.string(),
  pessimisticScenario: z.string(),
  reportMarkdown: z.string().nullish(),
});
export type SimulationResult = z.infer<typeof SimulationResult>;
