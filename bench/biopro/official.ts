import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

import type { GenRecord } from "./load";

export interface OfficialEntry {
  id: string;
  instruction: string;
  input?: string;
  output: string;
  generated_response: string;
}

/**
 * Build the JSONL the official Metrics/GEN.py script consumes. Each record
 * carries the original GEN fields plus the model's flat-text protocol in
 * `generated_response` (the convention from the BioProBench README).
 */
export async function writeOfficialJsonl(
  outPath: string,
  records: { record: GenRecord; rendered: string }[],
): Promise<void> {
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  const lines = records.map(({ record, rendered }) => {
    const entry: OfficialEntry = {
      id: record.id,
      instruction: record.instruction,
      input: record.input,
      output: record.output,
      generated_response: rendered,
    };
    return JSON.stringify(entry);
  });
  await fs.writeFile(outPath, lines.join("\n") + "\n", "utf8");
}

/**
 * Shell out to the official scorer. The exact CLI of Metrics/GEN.py is
 * upstream-defined; we pass the JSONL path as the first arg and capture
 * stdout/stderr verbatim. The caller is responsible for parsing whatever
 * format the script prints.
 */
export async function runOfficialGen(opts: {
  repoPath: string;
  jsonlPath: string;
  pythonBin?: string;
}): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const py = opts.pythonBin ?? process.env.PYTHON_BIN ?? "python";
  const scriptRel = path.join("Metrics", "GEN.py");
  const scriptAbs = path.join(opts.repoPath, scriptRel);
  try {
    await fs.access(scriptAbs);
  } catch {
    throw new Error(`Official GEN scorer not found at ${scriptAbs}. Did you clone bioprotocolbench at --use-official=<path>?`);
  }

  return new Promise((resolve, reject) => {
    const child = spawn(py, [scriptRel, opts.jsonlPath], {
      cwd: opts.repoPath,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, exitCode: code ?? -1 }));
  });
}
