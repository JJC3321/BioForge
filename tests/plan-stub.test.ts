import { describe, it, expect } from "vitest";
import { generatePlan } from "../src/lib/plan";
import { ExperimentPlan } from "../src/lib/schema";

describe("plan generation (stub mode)", () => {
  // Force stub mode
  const prev = process.env.AG2_API_KEY;
  process.env.AG2_API_KEY = "";

  it("produces a schema-valid plan for a knockdown/cisplatin hypothesis", async () => {
    const plan = await generatePlan({
      hypothesis: "Knockdown of NRF2 sensitizes A549 cells to cisplatin in vitro.",
      domain: "cell biology / qPCR",
      qc: null,
      similarFeedback: [],
    });
    const r = ExperimentPlan.safeParse(plan);
    expect(r.success).toBe(true);
    expect(plan.protocol.length).toBeGreaterThanOrEqual(3);
    expect(plan.controls.some((c) => c.type === "negative")).toBe(true);
    expect(plan.budgetUSD).toBeGreaterThan(0);
  });

  it("notes incorporated feedback when similar feedback is provided", async () => {
    const plan = await generatePlan({
      hypothesis: "Knockdown of NRF2 sensitizes A549 cells to cisplatin.",
      domain: "cell biology",
      qc: null,
      similarFeedback: [
        {
          id: "f1",
          planId: "p1",
          hypothesis: "Prior similar one",
          tags: ["nrf2"],
          ratings: [{ section: "protocol", rating: 3 }],
          corrections: [{ section: "protocol", corrected: "Use 25 nM siRNA, not 20 nM" }],
          freeformNotes: "Increase n.",
          createdAt: Date.now(),
        },
      ],
    });
    expect(plan.reviewerNotes).toBeTruthy();
    expect(plan.reviewerNotes!.toLowerCase()).toContain("prior reviewer");
  });

  // restore
  if (prev !== undefined) process.env.AG2_API_KEY = prev;
});
