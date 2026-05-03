import { promises as fs } from "node:fs";
import path from "node:path";

export interface GenRecord {
  id: string;
  instruction: string;
  input: string;
  output: string;          // joined "1. ...\n2. ..." text
  outputSteps: string[];   // original array form
  system_prompt?: string;
  type?: string;
}

const SOURCE_URL =
  "https://huggingface.co/datasets/GreatCaptainNemo/BioProBench/resolve/main/GEN_test.json";

const CACHE_DIR = path.resolve(process.cwd(), "bench/biopro/data");
const RAW_FILE = path.join(CACHE_DIR, "GEN_test.json");
const NORMALIZED_FILE = path.join(CACHE_DIR, "gen-test.jsonl");

interface RawRecord {
  id?: string;
  system_prompt?: string;
  instruction?: string;
  input?: string;
  output?: string | string[];
  type?: string;
}

function asString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((x) => asString(x)).join("\n");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function normalize(raw: RawRecord, idx: number): GenRecord {
  const steps = Array.isArray(raw.output)
    ? raw.output.map((s) => asString(s).trim()).filter(Boolean)
    : asString(raw.output)
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean);
  return {
    id: raw.id ?? `TEST-GEN-${String(idx).padStart(6, "0")}`,
    instruction: raw.instruction ?? "",
    input: raw.input ?? "",
    output: steps.join("\n"),
    outputSteps: steps,
    system_prompt: raw.system_prompt,
    type: raw.type,
  };
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function downloadRaw(): Promise<RawRecord[]> {
  const resp = await fetch(SOURCE_URL);
  if (!resp.ok) {
    throw new Error(`Failed to download ${SOURCE_URL}: ${resp.status} ${resp.statusText}`);
  }
  const text = await resp.text();
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(RAW_FILE, text, "utf8");
  return JSON.parse(text) as RawRecord[];
}

async function readNormalized(): Promise<GenRecord[] | null> {
  try {
    const txt = await fs.readFile(NORMALIZED_FILE, "utf8");
    const lines = txt.split("\n").filter((l) => l.trim().length > 0);
    return lines.map((l) => JSON.parse(l) as GenRecord);
  } catch {
    return null;
  }
}

async function writeNormalized(records: GenRecord[]): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const txt = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
  await fs.writeFile(NORMALIZED_FILE, txt, "utf8");
}

/**
 * Load BioProBench GEN test split. First call downloads GEN_test.json from
 * the HF dataset repo (the datasets-server REST API can't process this repo
 * because GEN/ERR/etc. have non-matching schemas in the same default config),
 * normalizes it, and caches both the raw and normalized files. Subsequent
 * calls reuse the normalized cache.
 */
export async function loadGenTest(limit?: number): Promise<GenRecord[]> {
  let records = await readNormalized();
  if (!records) {
    const raw = (await fileExists(RAW_FILE))
      ? (JSON.parse(await fs.readFile(RAW_FILE, "utf8")) as RawRecord[])
      : await downloadRaw();
    records = raw.map((r, i) => normalize(r, i));
    await writeNormalized(records);
  }
  return limit !== undefined ? records.slice(0, limit) : records;
}
