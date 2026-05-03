import { NextResponse } from "next/server";
import { z } from "zod";
import { QCResult } from "@/lib/schema";
import { generatePlan } from "@/lib/plan";
import { findSimilarFeedback, savePlan } from "@/lib/feedback-store";

export const runtime = "nodejs";

const PlanRequest = z.object({
  hypothesis: z.string().min(8).max(2000),
  domain: z.string().optional(),
  qc: QCResult.nullable().optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = PlanRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const similar = findSimilarFeedback(parsed.data.hypothesis, parsed.data.domain, 3);
    const plan = await generatePlan({
      hypothesis: parsed.data.hypothesis,
      domain: parsed.data.domain,
      qc: parsed.data.qc ?? null,
      similarFeedback: similar,
    });
    const stored = savePlan({
      hypothesis: parsed.data.hypothesis,
      domain: parsed.data.domain,
      plan,
      qc: parsed.data.qc ?? {
        novelty: "no_match",
        rationale: "QC skipped",
        references: [],
      },
    });
    return NextResponse.json({ id: stored.id, plan, usedFeedback: similar.length });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
