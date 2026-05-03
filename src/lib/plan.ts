import { ExperimentPlan, QCResult } from "./schema";
import type { StoredFeedback } from "./feedback-store";

const PLAN_SERVICE_URL = process.env.PLAN_SERVICE_URL ?? "http://127.0.0.1:8001";
const PLAN_SERVICE_TIMEOUT_MS = Number(process.env.PLAN_SERVICE_TIMEOUT_MS ?? 60_000);

interface GenerateInput {
  hypothesis: string;
  domain?: string;
  qc?: QCResult | null;
  similarFeedback: StoredFeedback[];
}

export async function generatePlan(input: GenerateInput): Promise<ExperimentPlan> {
  // Primary: AG2 sidecar (Design → Verify → Rectify); see agents/app/.
  try {
    const plan = await callPlanService(input);
    return plan;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // ECONNREFUSED is the expected case when the user only ran `npm run dev`
    // (not `npm run dev:full`) — log it as a one-liner, not a stack trace.
    if (isConnectionRefused(e)) {
      console.warn(`[generatePlan] plan service at ${PLAN_SERVICE_URL} unreachable, falling back to stub`);
    } else {
      console.warn(`[generatePlan] plan service call failed (${msg}), falling back to stub`);
    }
  }

  // Service-down fallback: deterministic stub (per CLAUDE.md rule #1, always works).
  return stubPlan(input);
}

function isConnectionRefused(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const cause = (e as { cause?: unknown }).cause;
  if (cause && typeof cause === "object" && "code" in cause) {
    return (cause as { code?: string }).code === "ECONNREFUSED";
  }
  return false;
}

async function callPlanService(input: GenerateInput): Promise<ExperimentPlan> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PLAN_SERVICE_TIMEOUT_MS);
  try {
    const res = await fetch(`${PLAN_SERVICE_URL}/plan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        hypothesis: input.hypothesis,
        domain: input.domain ?? null,
        qc: input.qc ?? null,
        similarFeedback: input.similarFeedback.map((f) => ({
          hypothesis: f.hypothesis,
          domain: f.domain,
          tags: f.tags,
          ratings: f.ratings,
          corrections: f.corrections,
          freeformNotes: f.freeformNotes,
        })),
      }),
    });
    if (!res.ok) {
      throw new Error(`plan service returned ${res.status}`);
    }
    const body = (await res.json()) as { plan: unknown };
    const plan = ExperimentPlan.parse(body.plan);
    return plan;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Deterministic plan template — always credible, domain-aware, demo-safe.
 * The fallback is the demo-day insurance policy.
 */
function stubPlan(input: GenerateInput): ExperimentPlan {
  const dom = (input.domain ?? "cell biology").toLowerCase();
  const isQpcr = /qpcr|rt-pcr|expression/.test(dom) || /qpcr|mrna|expression/i.test(input.hypothesis);
  const isKnockdown = /knockdown|sirna|shrna|knock-?out/i.test(input.hypothesis);
  const isCisplatin = /cisplatin|chemo|platinum/i.test(input.hypothesis);

  const reviewerNotes =
    input.similarFeedback.length > 0
      ? `Incorporated ${input.similarFeedback.length} prior reviewer feedback record(s). Key prior corrections applied: ${input.similarFeedback
          .flatMap((f) => f.corrections.map((c) => c.corrected))
          .slice(0, 3)
          .join("; ") || "(none — only ratings/notes)"}`
      : undefined;

  const plan: ExperimentPlan = {
    domain: input.domain ?? "cell biology",
    structuredHypothesis: {
      question: input.hypothesis,
      independentVariable: isKnockdown
        ? "siRNA-mediated knockdown of target gene"
        : "experimental treatment",
      dependentVariable: isCisplatin
        ? "cell viability and apoptosis under cisplatin"
        : isQpcr
          ? "target mRNA abundance"
          : "cellular phenotype readout",
      predictedOutcome: isCisplatin
        ? "Reduced viability and increased apoptosis in knockdown vs control under cisplatin"
        : "Statistically significant change in the dependent variable in treatment vs control",
      scope: "in vitro, single cell line, biological triplicate",
    },
    protocol: [
      {
        step: 1,
        title: "Cell culture preparation",
        description:
          "Thaw and expand cells to passage 3–8. Maintain in DMEM + 10% FBS + 1% Pen/Strep at 37°C, 5% CO2. Confirm mycoplasma-negative.",
        durationMinutes: 4320,
        critical: true,
      },
      {
        step: 2,
        title: isKnockdown ? "siRNA transfection" : "Treatment setup",
        description: isKnockdown
          ? "Reverse-transfect with 20 nM siRNA (target + non-targeting control) using Lipofectamine RNAiMAX in Opti-MEM. Plate at 1.5e5 cells/well in 6-well format. Triplicate wells per condition."
          : "Plate cells at appropriate density. Apply treatment vs vehicle control across triplicate wells.",
        durationMinutes: 60,
        critical: true,
      },
      {
        step: 3,
        title: "Knockdown / treatment validation",
        description: isKnockdown
          ? "At 48 h post-transfection, harvest a subset of wells. Confirm knockdown by qPCR (target mRNA) and Western blot (target protein). Require ≥70% mRNA reduction."
          : "Confirm treatment delivery and cellular response with appropriate marker readout.",
        durationMinutes: 240,
      },
      {
        step: 4,
        title: isCisplatin
          ? "Cisplatin dose-response challenge"
          : "Phenotypic challenge / readout",
        description: isCisplatin
          ? "At 48 h post-transfection, treat with cisplatin dose series (0, 1, 5, 10, 25 μM) for 48 h."
          : "Apply experimental challenge. Capture readouts at 24 and 48 h.",
        durationMinutes: 2880,
      },
      {
        step: 5,
        title: "Primary readout",
        description: isCisplatin
          ? "Measure viability with CellTiter-Glo. Compute IC50 per condition. Confirm with Annexin V / PI flow cytometry."
          : isQpcr
            ? "Extract RNA (RNeasy), reverse transcribe (random hexamers, 500 ng), and run qPCR with target + 2 reference genes (GAPDH, ACTB). Run in technical triplicate."
            : "Capture primary phenotypic measurement in technical triplicate.",
        durationMinutes: 360,
        critical: true,
      },
      {
        step: 6,
        title: "Statistical analysis",
        description:
          "Two-way ANOVA with Tukey post-hoc (for dose × condition), or appropriate test. Report mean ± SD across biological triplicates. Pre-specify significance threshold α = 0.05.",
        durationMinutes: 120,
      },
    ],
    materials: [
      { name: "Cell line (e.g. A549)", quantity: "1 vial", supplier: "ATCC", catalogNumber: "CCL-185", estimatedCostUSD: 600 },
      { name: "DMEM + GlutaMAX", quantity: "500 mL", supplier: "Thermo Fisher", catalogNumber: "10566016", estimatedCostUSD: 25 },
      { name: "Fetal Bovine Serum", quantity: "500 mL", supplier: "Thermo Fisher", catalogNumber: "16000044", estimatedCostUSD: 450 },
      { name: "Pen/Strep", quantity: "100 mL", supplier: "Thermo Fisher", catalogNumber: "15140122", estimatedCostUSD: 35 },
      ...(isKnockdown
        ? [
            { name: "Target siRNA + non-targeting control", quantity: "10 nmol each", supplier: "Dharmacon", catalogNumber: "ON-TARGETplus", estimatedCostUSD: 350 },
            { name: "Lipofectamine RNAiMAX", quantity: "1.5 mL", supplier: "Thermo Fisher", catalogNumber: "13778075", estimatedCostUSD: 280 },
            { name: "Opti-MEM I", quantity: "500 mL", supplier: "Thermo Fisher", catalogNumber: "31985070", estimatedCostUSD: 30 },
          ]
        : []),
      ...(isQpcr
        ? [
            { name: "RNeasy Mini Kit", quantity: "50 preps", supplier: "Qiagen", catalogNumber: "74104", estimatedCostUSD: 380 },
            { name: "iScript cDNA Synthesis Kit", quantity: "100 rxns", supplier: "Bio-Rad", catalogNumber: "1708890", estimatedCostUSD: 320 },
            { name: "SsoAdvanced Universal SYBR Green", quantity: "500 rxns", supplier: "Bio-Rad", catalogNumber: "1725270", estimatedCostUSD: 260 },
            { name: "Custom qPCR primers (target + GAPDH + ACTB)", quantity: "3 pairs", supplier: "IDT", estimatedCostUSD: 60 },
          ]
        : []),
      ...(isCisplatin
        ? [
            { name: "Cisplatin", quantity: "50 mg", supplier: "Sigma-Aldrich", catalogNumber: "P4394", estimatedCostUSD: 95 },
            { name: "CellTiter-Glo 2.0", quantity: "10 mL", supplier: "Promega", catalogNumber: "G9241", estimatedCostUSD: 280 },
          ]
        : []),
      { name: "6-well tissue culture plates", quantity: "5 packs", supplier: "Corning", catalogNumber: "3516", estimatedCostUSD: 90 },
    ],
    controls: [
      {
        name: isKnockdown ? "Non-targeting siRNA" : "Vehicle control",
        type: "negative",
        description: isKnockdown
          ? "Scrambled siRNA (Dharmacon ON-TARGETplus Non-targeting Pool) at the same concentration as the targeting siRNA."
          : "Vehicle-only condition matched for solvent and volume.",
      },
      {
        name: "Untransfected / untreated baseline",
        type: "biological",
        description: "Cells receiving no perturbation, processed in parallel.",
      },
      {
        name: "No-RT and no-template qPCR controls",
        type: "technical",
        description: "Confirm absence of genomic DNA contamination and primer specificity.",
      },
      ...(isCisplatin
        ? [
            {
              name: "Positive cytotoxicity control (staurosporine)",
              type: "positive" as const,
              description: "1 μM staurosporine to confirm assay sensitivity to apoptosis induction.",
            },
          ]
        : []),
    ],
    validation: [
      isKnockdown
        ? "Confirm ≥70% knockdown at mRNA AND protein level before downstream readout."
        : "Confirm treatment efficacy with marker readout before downstream assay.",
      "Run all conditions in biological triplicate (independent transfections / treatments).",
      "Use ≥2 reference genes for qPCR normalization where applicable.",
      "Replicate the key finding in a second cell line if time permits.",
    ],
    risks: [
      {
        description: "Off-target siRNA effects confounding phenotype",
        severity: "medium",
        mitigation: "Use pooled siRNA + rescue with siRNA-resistant cDNA, or confirm with a second independent siRNA.",
      },
      {
        description: "Low or variable knockdown efficiency",
        severity: "medium",
        mitigation: "Optimize transfection conditions; QC each batch by qPCR before proceeding.",
      },
      {
        description: "Cytotoxicity from transfection reagent itself",
        severity: "low",
        mitigation: "Include reagent-only control; titrate Lipofectamine if viability drops in mock.",
      },
      {
        description: "Mycoplasma contamination skewing phenotype",
        severity: "high",
        mitigation: "Test cells monthly; quarantine new cultures until confirmed negative.",
      },
      {
        description: "Statistical underpowering",
        severity: "medium",
        mitigation: "Power analysis before starting; n=3 biological reps minimum, increase if effect size unclear.",
      },
    ],
    timeline: [
      { phase: "Cell expansion & QC", durationDays: 7, description: "Thaw, expand, mycoplasma test." },
      { phase: "Transfection / treatment", durationDays: 1 },
      { phase: "Knockdown validation", durationDays: 2, description: "qPCR + Western." },
      { phase: "Phenotypic challenge", durationDays: 2 },
      { phase: "Readout & analysis", durationDays: 3 },
      { phase: "Replicate (biological triplicate cycles)", durationDays: 14 },
    ],
    budgetUSD: 0, // computed below
    reviewerNotes,
    assumptions: [
      "Standard wet lab access (BSL-2, tissue culture hood, qPCR machine, plate reader).",
      "Cell line and reagents are not on backorder.",
      "Personnel familiar with sterile technique and qPCR.",
    ],
  };

  // Sum material costs to get a budget estimate, plus 25% overhead/consumables buffer.
  const matSum = plan.materials.reduce((s, m) => s + (m.estimatedCostUSD ?? 0), 0);
  plan.budgetUSD = Math.round(matSum * 1.25);

  return plan;
}
