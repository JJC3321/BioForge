/**
 * Demo: call the Dry-Run Simulator with a sample siRNA knockdown plan.
 * Usage: npm run sim
 */
import { config } from "dotenv";
config();

import { stubSim } from "../../src/lib/drysim";
import type { ExperimentPlan } from "../../src/lib/schema";

const samplePlan: ExperimentPlan = {
  domain: "cell biology",
  structuredHypothesis: {
    question: "Does siRNA knockdown of BRCA1 sensitise HeLa cells to cisplatin?",
    independentVariable: "siRNA-mediated BRCA1 knockdown",
    dependentVariable: "cell viability under cisplatin",
    predictedOutcome: "Reduced IC50 in knockdown vs scramble control",
    scope: "in vitro, HeLa, biological triplicate",
  },
  protocol: [
    { step: 1, title: "Cell culture preparation", description: "Expand HeLa to passage 5–8.", durationMinutes: 4320, critical: true },
    { step: 2, title: "siRNA transfection", description: "Lipofectamine RNAiMAX, 20 nM BRCA1 siRNA.", durationMinutes: 60, critical: true },
    { step: 3, title: "Knockdown validation", description: "qPCR + Western blot at 48 h.", durationMinutes: 240 },
    { step: 4, title: "Cisplatin dose-response", description: "0–25 μM for 48 h.", durationMinutes: 2880 },
    { step: 5, title: "CellTiter-Glo viability", description: "Measure luminescence, compute IC50.", durationMinutes: 120, critical: true },
    { step: 6, title: "Statistical analysis", description: "Two-way ANOVA, Tukey post-hoc.", durationMinutes: 120 },
  ],
  materials: [
    { name: "HeLa cells", quantity: "1 vial", supplier: "ATCC", estimatedCostUSD: 450 },
    { name: "BRCA1 siRNA + NT control", quantity: "10 nmol each", supplier: "Dharmacon", estimatedCostUSD: 350 },
    { name: "Lipofectamine RNAiMAX", quantity: "1.5 mL", supplier: "Thermo Fisher", estimatedCostUSD: 280 },
    { name: "Cisplatin", quantity: "50 mg", supplier: "Sigma-Aldrich", estimatedCostUSD: 95 },
    { name: "CellTiter-Glo 2.0", quantity: "10 mL", supplier: "Promega", estimatedCostUSD: 280 },
  ],
  controls: [
    { name: "Non-targeting siRNA", type: "negative", description: "Scrambled siRNA at matching concentration." },
    { name: "Untreated baseline", type: "biological", description: "No perturbation." },
    { name: "Staurosporine positive control", type: "positive", description: "1 μM staurosporine." },
  ],
  validation: ["≥70% BRCA1 knockdown confirmed by qPCR and Western", "Biological triplicate"],
  risks: [
    { description: "Off-target siRNA effects", severity: "medium", mitigation: "Use rescue construct" },
    { description: "Mycoplasma contamination", severity: "high", mitigation: "Monthly testing" },
  ],
  timeline: [
    { phase: "Cell expansion", durationDays: 7 },
    { phase: "Transfection", durationDays: 1 },
    { phase: "Validation", durationDays: 2 },
    { phase: "Challenge & readout", durationDays: 5 },
    { phase: "Analysis", durationDays: 2 },
  ],
  budgetUSD: 1820,
  reviewerNotes: null,
  assumptions: ["BSL-2 lab access", "Reagents in stock"],
};

const result = stubSim(samplePlan);

console.log("\n=== BioForge Dry-Run Simulation (stub) ===\n");
console.log(`Experiment type : ${result.experimentType}`);
console.log(`Overall success : ${(result.overallSuccessProbability * 100).toFixed(0)}%`);
console.log(`Confidence score: ${(result.confidenceScore * 100).toFixed(0)}%`);
console.log("\nPer-step outcomes:");
for (const s of result.stepOutcomes) {
  const bar = "█".repeat(Math.round(s.successProbability * 20)).padEnd(20, "░");
  console.log(`  Step ${s.stepIndex + 1} [${bar}] ${(s.successProbability * 100).toFixed(0)}%  ${s.title}`);
  if (s.riskFlags.length) console.log(`         ⚠ ${s.riskFlags.join("; ")}`);
}
console.log("\nCritical risks:");
for (const r of result.criticalRisks) console.log(`  • ${r}`);
console.log("\nRecommendations:");
for (const r of result.recommendations) console.log(`  ✓ ${r}`);
console.log(`\nOptimistic : ${result.optimisticScenario}`);
console.log(`Pessimistic: ${result.pessimisticScenario}`);
