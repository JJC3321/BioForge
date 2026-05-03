import { NextResponse } from "next/server";
import { HypothesisInput } from "@/lib/schema";
import { runQC } from "@/lib/qc";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = HypothesisInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const qc = await runQC(parsed.data.hypothesis, parsed.data.domain);
    return NextResponse.json(qc);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
