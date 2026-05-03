import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { promises as fs } from "node:fs";
import path from "node:path";

import { generatePlan } from "../../src/lib/plan";
import type { ExperimentPlan } from "../../src/lib/schema";
import { isLiveLLM } from "../../src/lib/gemini";

import { loadGenTest, type GenRecord } from "./load";
import { renderPlanAsProtocolText } from "./render";
import {
  aggregate,
  bleu4,
  keywordPRF1,
  rougeL,
  stepPRF1,
  type RecordScore,
} from "./score";
import { runOfficialGen, writeOfficialJsonl } from "./official";
import { runQC } from "../../src/lib/qc";
import type { QCResult } from "../../src/lib/schema";
import { savePlan, findSimilarFeedback } from "../../src/lib/feedback-store";

interface CliOpts {
  n: number;
  live: boolean;
  useOfficial: string | null;
  out: string | null;
  withQC: boolean;
}

function parseArgs(argv: string[]): CliOpts {
  const opts: CliOpts = { n: 50, live: false, useOfficial: null, out: null, withQC: false };
  for (const a of argv.slice(2)) {
    if (a === "--live") opts.live = true;
    else if (a === "--with-qc") opts.withQC = true;
    else if (a.startsWith("--n=")) opts.n = Math.max(1, parseInt(a.slice(4), 10) || 50);
    else if (a.startsWith("--use-official=")) opts.useOfficial = a.slice("--use-official=".length);
    else if (a.startsWith("--out=")) opts.out = a.slice("--out=".length);
    else if (a === "--help" || a === "-h") {
      console.log(
        [
          "Usage: npm run bench:biopro -- [flags]",
          "  --n=<int>                number of GEN test records (default 50, max 772 in test split)",
          "  --live                   use Gemini (requires AG2_API_KEY); default is stub",
          "  --with-qc                run full pipeline with QC and database storage",
          "  --use-official=<path>    also run official Metrics/GEN.py from a cloned bioprotocolbench",
          "  --out=<file>             override results JSON path",
        ].join("\n"),
      );
      process.exit(0);
    }
  }
  return opts;
}

interface PerRecord {
  id: string;
  instruction: string;
  expected: string;
  generated: ExperimentPlan;
  rendered: string;
  score: RecordScore;
  error?: string;
  qc?: QCResult;
  planId?: string;
  feedbackUsed?: number;
}

async function scoreOne(record: GenRecord, plan: ExperimentPlan): Promise<{ rendered: string; score: RecordScore }> {
  const rendered = renderPlanAsProtocolText(plan);
  const hypSteps = plan.protocol.map((s) => s.description.trim());
  const score: RecordScore = {
    bleu4: bleu4(rendered, record.output),
    rougeL: rougeL(rendered, record.output),
    keyword: keywordPRF1(rendered, record.output),
    step: stepPRF1(hypSteps, record.outputSteps),
  };
  return { rendered, score };
}

function fmtPct(x: number): string {
  return (x * 100).toFixed(2);
}

async function main() {
  const opts = parseArgs(process.argv);
  const liveAvailable = isLiveLLM();
  if (opts.live && !liveAvailable) {
    console.warn("--live was passed but AG2_API_KEY is not set; the underlying generatePlan will fall back to the stub.");
  }
  const mode = opts.live && liveAvailable ? (opts.withQC ? "live+qc" : "live") : "stub";

  console.log(`[bench:biopro] mode=${mode} n=${opts.n} ${opts.useOfficial ? `official=${opts.useOfficial}` : ""}`);
  console.log(`[bench:biopro] loading GEN test split…`);
  const records = await loadGenTest(opts.n);
  console.log(`[bench:biopro] loaded ${records.length} records`);

  const perRecord: PerRecord[] = [];
  const t0 = Date.now();
  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    // GEN records carry the protocol question in `input`; `instruction` is a
    // meta-instruction (e.g. "describe the protocol in flat list format").
    // Include instruction in hypothesis to guide protocol generation format.
    const instruction = rec.instruction?.trim() ?? "";
    const base = rec.input.trim();
    const hypothesis = instruction
      ? `${base}\n\nFormat requirement: ${instruction}`.slice(0, 1900)
      : base.slice(0, 1900);
    if (hypothesis.length < 8) {
      console.warn(`[bench:biopro] skipping ${rec.id}: input too short`);
      continue;
    }

    try {
      let qc: QCResult | null = null;
      let similarFeedback: import("../../src/lib/feedback-store").StoredFeedback[] = [];
      
      if (opts.withQC) {
        qc = await runQC(hypothesis, undefined);
        similarFeedback = findSimilarFeedback(hypothesis, undefined);
      }

      const plan = await generatePlan({
        hypothesis,
        domain: undefined,
        qc: opts.withQC ? qc : null,
        similarFeedback,
      });

      // Rate limit protection: delay between API calls
      await new Promise(r => setTimeout(r, 500));

      let planId: string | undefined;
      if (opts.withQC && qc) {
        const stored = savePlan({ hypothesis, domain: undefined, plan, qc });
        planId = stored.id;
      }
      
      const { rendered, score } = await scoreOne(rec, plan);
      perRecord.push({
        id: rec.id,
        instruction: rec.instruction,
        expected: rec.output,
        generated: plan,
        rendered,
        score,
        qc: opts.withQC ? qc! : undefined,
        planId,
        feedbackUsed: similarFeedback.length,
      });
    } catch (err) {
      perRecord.push({
        id: rec.id,
        instruction: rec.instruction,
        expected: rec.output,
        generated: null as unknown as ExperimentPlan,
        rendered: "",
        score: { bleu4: 0, rougeL: 0, keyword: { p: 0, r: 0, f1: 0 }, step: { p: 0, r: 0, f1: 0 } },
        error: err instanceof Error ? err.message : String(err),
      });
    }

    if ((i + 1) % 10 === 0 || i + 1 === records.length) {
      console.log(`[bench:biopro] ${i + 1}/${records.length}`);
    }
  }
  const elapsedMs = Date.now() - t0;

  const summary = aggregate(perRecord.filter((r) => !r.error).map((r) => r.score));

  console.log("\n[bench:biopro] summary");
  console.log(`  records scored:  ${summary.n}/${perRecord.length}`);
  console.log(`  BLEU-4:          ${fmtPct(summary.bleu4.mean)} ± ${fmtPct(summary.bleu4.std)}`);
  console.log(`  ROUGE-L F1:      ${fmtPct(summary.rougeL.mean)} ± ${fmtPct(summary.rougeL.std)}`);
  console.log(`  Keyword F1:      ${fmtPct(summary.keywordF1.mean)} ± ${fmtPct(summary.keywordF1.std)}`);
  console.log(`  Step F1:         ${fmtPct(summary.stepF1.mean)} ± ${fmtPct(summary.stepF1.std)}`);
  console.log(`  elapsed:         ${(elapsedMs / 1000).toFixed(1)}s`);

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = opts.out ?? path.resolve(process.cwd(), `bench/biopro/results/${ts}-${mode}.json`);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(
    outPath,
    JSON.stringify(
      { mode, n: opts.n, elapsedMs, summary, records: perRecord },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`[bench:biopro] wrote ${outPath}`);

  if (opts.useOfficial) {
    const jsonlPath = path.resolve(process.cwd(), `bench/biopro/results/${ts}-${mode}.jsonl`);
    await writeOfficialJsonl(
      jsonlPath,
      perRecord
        .filter((r) => !r.error)
        .map((r) => ({
          record: {
            id: r.id,
            instruction: r.instruction,
            input: "",
            output: r.expected,
            outputSteps: r.expected.split("\n"),
          },
          rendered: r.rendered,
        })),
    );
    console.log(`[bench:biopro] wrote ${jsonlPath} for official scorer`);
    console.log(`[bench:biopro] invoking python Metrics/GEN.py at ${opts.useOfficial}…`);
    const { stdout, stderr, exitCode } = await runOfficialGen({
      repoPath: opts.useOfficial,
      jsonlPath,
    });
    if (stderr) process.stderr.write(stderr);
    process.stdout.write(stdout);
    if (exitCode !== 0) {
      console.warn(`[bench:biopro] official scorer exited ${exitCode}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
