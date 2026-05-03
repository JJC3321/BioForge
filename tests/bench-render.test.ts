import { describe, it, expect } from "vitest";
import { generatePlan } from "../src/lib/plan";
import { renderPlanAsProtocolText, splitReferenceSteps } from "../bench/biopro/render";

describe("bench/biopro/render", () => {
  process.env.GEMINI_API_KEY = "";

  it("renders a stub plan as numbered protocol lines starting at 1", async () => {
    const plan = await generatePlan({
      hypothesis: "Knockdown of NRF2 sensitizes A549 cells to cisplatin in vitro.",
      domain: "cell biology",
      qc: null,
      similarFeedback: [],
    });
    const text = renderPlanAsProtocolText(plan);
    const lines = text.split("\n");
    expect(lines.length).toBe(plan.protocol.length);
    expect(lines[0]).toMatch(/^1\. /);
    expect(lines[lines.length - 1]).toMatch(new RegExp(`^${plan.protocol.length}\\. `));
    expect(lines.every((l) => /:\s/.test(l))).toBe(true);
  });

  it("splits a numbered reference protocol into steps", () => {
    const ref = "1. Plate cells: seed at 1e5/well.\n2. Transfect: 20 nM siRNA.\n3. Harvest at 48 h.";
    const steps = splitReferenceSteps(ref);
    expect(steps).toHaveLength(3);
    expect(steps[0]).toContain("Plate cells");
    expect(steps[2]).toContain("Harvest");
  });

  it("falls back to line splits when no step markers are present", () => {
    const ref = "Add reagent A.\nIncubate 30 min at 37C.\nMeasure absorbance.";
    const steps = splitReferenceSteps(ref);
    expect(steps).toHaveLength(3);
  });
});
