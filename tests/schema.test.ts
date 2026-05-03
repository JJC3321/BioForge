import { describe, it, expect } from "vitest";
import {
  HypothesisInput,
  ExperimentPlan,
  FeedbackPayload,
  QCResult,
} from "../src/lib/schema";

describe("HypothesisInput schema", () => {
  it("rejects strings shorter than 8 chars", () => {
    const r = HypothesisInput.safeParse({ hypothesis: "short" });
    expect(r.success).toBe(false);
  });
  it("accepts a normal hypothesis", () => {
    const r = HypothesisInput.safeParse({
      hypothesis: "Knockdown of NRF2 sensitizes A549 cells to cisplatin.",
      domain: "cell biology",
    });
    expect(r.success).toBe(true);
  });
});

describe("QCResult schema", () => {
  it("requires novelty + rationale + references", () => {
    expect(
      QCResult.safeParse({ novelty: "no_match", rationale: "x", references: [] }).success,
    ).toBe(true);
  });
  it("rejects unknown novelty values", () => {
    expect(
      QCResult.safeParse({ novelty: "maybe", rationale: "x", references: [] }).success,
    ).toBe(false);
  });
});

describe("ExperimentPlan schema", () => {
  const valid = {
    domain: "cell biology",
    structuredHypothesis: {
      question: "Q",
      independentVariable: "I",
      dependentVariable: "D",
      predictedOutcome: "P",
    },
    protocol: [{ step: 1, title: "t", description: "d" }],
    materials: [{ name: "m", quantity: "1" }],
    controls: [{ name: "c", type: "negative", description: "d" }],
    validation: ["v"],
    risks: [],
    timeline: [{ phase: "p", durationDays: 1 }],
    budgetUSD: 100,
  };

  it("accepts a minimal valid plan", () => {
    expect(ExperimentPlan.safeParse(valid).success).toBe(true);
  });
  it("rejects negative budget", () => {
    expect(
      ExperimentPlan.safeParse({ ...valid, budgetUSD: -1 }).success,
    ).toBe(false);
  });
  it("rejects empty protocol", () => {
    expect(
      ExperimentPlan.safeParse({ ...valid, protocol: [] }).success,
    ).toBe(false);
  });
  it("rejects unknown control type", () => {
    expect(
      ExperimentPlan.safeParse({
        ...valid,
        controls: [{ name: "c", type: "weird", description: "d" }],
      }).success,
    ).toBe(false);
  });
});

describe("FeedbackPayload schema", () => {
  it("defaults arrays when omitted", () => {
    const r = FeedbackPayload.safeParse({
      planId: "abc",
      hypothesis: "Test hypothesis text",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.tags).toEqual([]);
      expect(r.data.ratings).toEqual([]);
    }
  });
  it("rejects rating outside 1-5", () => {
    const r = FeedbackPayload.safeParse({
      planId: "abc",
      hypothesis: "Test",
      ratings: [{ section: "overall", rating: 7 }],
    });
    expect(r.success).toBe(false);
  });
});
