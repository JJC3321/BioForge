import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { ExperimentPlan } from "@/lib/schema";
import { runDrySim } from "@/lib/drysim";

export const runtime = "nodejs";

const DrySimRequest = z.object({
  plan: ExperimentPlan,
  hypothesis: z.string().min(8),
  nRuns: z.number().int().min(10).max(1000).default(100),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = DrySimRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const result = await runDrySim({
      plan: parsed.data.plan,
      hypothesis: parsed.data.hypothesis,
      nRuns: parsed.data.nRuns,
    });
    return NextResponse.json({ simId: randomUUID(), result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
