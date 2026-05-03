import type { ExperimentPlan, ProtocolStep } from "../../src/lib/schema";

/**
 * Flatten an ExperimentPlan to the steps-only protocol text shape that
 * BioProBench GEN scoring expects ("generated_response"). Format:
 *   "1. <title>: <description>\n2. ..."
 *
 * Steps are renumbered from 1 in array order (the schema's step number is
 * authoritative but may have gaps in pathological cases; we trust the order).
 */
export function renderPlanAsProtocolText(plan: ExperimentPlan): string {
  return plan.protocol
    .map((s, i) => formatStep(i + 1, s))
    .join("\n");
}

function formatStep(n: number, s: ProtocolStep): string {
  const title = s.title.trim();
  const desc = s.description.trim();
  return `${n}. ${title}: ${desc}`;
}

/**
 * Split a reference protocol string into ordered step strings.
 * Recognizes leading "1.", "1)", "Step 1:" markers; falls back to lines.
 */
export function splitReferenceSteps(ref: string): string[] {
  const text = ref.trim();
  if (!text) return [];

  const stepHeader = /(?:^|\n)\s*(?:step\s*)?(\d+)\s*[.):\-]\s+/gi;
  const matches = [...text.matchAll(stepHeader)];

  if (matches.length >= 2) {
    const steps: string[] = [];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index! + matches[i][0].length;
      const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
      const body = text.slice(start, end).trim();
      if (body) steps.push(body);
    }
    return steps;
  }

  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}
