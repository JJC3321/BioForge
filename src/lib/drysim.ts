import { ExperimentPlan, SimulationResult } from "./schema";

const PLAN_SERVICE_URL = process.env.PLAN_SERVICE_URL ?? "http://127.0.0.1:8001";
const SIM_SERVICE_TIMEOUT_MS = Number(process.env.PLAN_SERVICE_TIMEOUT_MS ?? 60_000);

export interface DrySimInput {
  plan: ExperimentPlan;
  hypothesis: string;
  nRuns?: number;
}

export async function runDrySim(input: DrySimInput): Promise<SimulationResult> {
  try {
    return await callSimService(input);
  } catch (e) {
    if (isConnectionRefused(e)) {
      console.warn(`[runDrySim] sim service at ${PLAN_SERVICE_URL} unreachable, falling back to stub`);
    } else {
      console.warn(`[runDrySim] sim service failed (${e instanceof Error ? e.message : String(e)}), falling back to stub`);
    }
  }
  return stubSim(input.plan);
}

function isConnectionRefused(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const cause = (e as { cause?: unknown }).cause;
  if (cause && typeof cause === "object" && "code" in cause) {
    return (cause as { code?: string }).code === "ECONNREFUSED";
  }
  return false;
}

async function callSimService(input: DrySimInput): Promise<SimulationResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SIM_SERVICE_TIMEOUT_MS);
  try {
    const res = await fetch(`${PLAN_SERVICE_URL}/sim`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        plan: input.plan,
        hypothesis: input.hypothesis,
        nRuns: input.nRuns ?? 100,
      }),
    });
    if (!res.ok) throw new Error(`sim service returned ${res.status}`);
    const body = (await res.json()) as { result: unknown };
    return SimulationResult.parse(body.result);
  } finally {
    clearTimeout(timer);
  }
}

export function stubSim(plan: ExperimentPlan): SimulationResult {
  // Classify on domain + step titles only; descriptions from the stub always contain
  // cell-culture/qPCR text. WB must precede PCR because WB protocols include qPCR steps.
  const signal = `${plan.domain} ${plan.protocol.map((s) => s.title).join(" ")}`.toLowerCase();

  let expType: SimulationResult["experimentType"];
  let baseProb: number;
  let contaminationFlag: string;
  let opt: string;
  let pess: string;
  let riskExtra: string;

  if (/western|immunoblot|blot|protein express|antibody/.test(signal)) {
    expType = "western_blot";
    baseProb = 0.85;
    contaminationFlag = "Antibody cross-reactivity risk: ~10–15% non-specific signal";
    opt = "Clean bands at expected molecular weights; signal-to-noise ratio >10:1.";
    pess = "Non-specific bands at 1–2 molecular weights; background noise requires blocking optimisation.";
    riskExtra = "Transfer efficiency variance: ±15% depending on protein size";
  } else if (/pcr|qpcr|rt-pcr|amplif|primer/.test(signal)) {
    expType = "pcr";
    baseProb = 0.88;
    contaminationFlag = "Contamination risk: ~5% per reaction";
    opt = "All amplicons yield clean bands at 95% efficiency; no non-specific products detected.";
    pess = "Primer dimers or non-specific amplification in 1–2 targets; overall efficiency drops to ~80%.";
    riskExtra = "Efficiency variability: PCR amplification ±10% across runs";
  } else if (/cell (culture|line|growth)|tissue culture|proliferat|viabilit|confluenc/.test(signal)) {
    expType = "cell_culture";
    baseProb = 0.82;
    contaminationFlag = "Mycoplasma/bacterial contamination risk: ~3% per passage";
    opt = "Cells reach optimal confluence; doubling time within expected range; no contamination detected.";
    pess = "Contamination event requires full restart (3% probability per passage); doubling time variability ±20%.";
    riskExtra = "Passage drift risk: phenotypic changes beyond passage 15";
  } else {
    expType = "generic";
    baseProb = 0.78;
    contaminationFlag = "General contamination/failure risk: ~10%";
    opt = "All steps succeed on first attempt within expected parameter ranges.";
    pess = "One or more steps require repetition; 20–25% yield reduction from variance.";
    riskExtra = "Protocol specificity is low — results may have high inter-run variance";
  }

  const stepOutcomes = plan.protocol.map((s) => {
    let prob: number;
    let flags: string[];
    if (s.step === plan.protocol.length) {
      prob = 0.97;
      flags = [];
    } else if (s.critical) {
      prob = Math.round((baseProb - 0.06) * 100) / 100;
      flags = [contaminationFlag];
    } else {
      prob = Math.min(Math.round((baseProb + 0.04) * 100) / 100, 0.95);
      flags = [];
    }
    return {
      stepIndex: s.step - 1,
      title: s.title,
      successProbability: prob,
      predictedYield: expType === "pcr" ? `~${Math.round(prob * 100)}% expected efficiency` : null,
      riskFlags: flags,
    };
  });

  return {
    experimentType: expType,
    overallSuccessProbability: baseProb,
    confidenceScore: 0.72,
    stepOutcomes,
    criticalRisks: [contaminationFlag, riskExtra],
    recommendations: [
      "Run in biological triplicate to account for stochastic variance",
      "Pre-warm all reagents to the specified temperature before use",
      "Include a QC checkpoint after each step marked critical",
    ],
    optimisticScenario: opt,
    pessimisticScenario: pess,
    reportMarkdown: null,
  };
}
