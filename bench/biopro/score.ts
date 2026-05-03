/**
 * BioProBench GEN-style metrics, pure-TS reimplementation for fast iteration.
 * For authoritative numbers, run with --use-official to shell out to
 * Metrics/GEN.py from the official bioprotocolbench repo.
 */

const STOPWORDS = new Set([
  "a","an","and","are","as","at","be","by","for","from","has","have","he","i",
  "in","is","it","its","of","on","or","so","that","the","this","to","was","were",
  "will","with","s","t","do","does","not","but","can","if","then","than","into",
  "we","you","your","they","their","them","our","us","also","such","may","each",
  "all","any","some","more","most","very","over","under","using","use","used"
]);

export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

function contentTokens(s: string): string[] {
  return tokenize(s).filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

function ngrams(tokens: string[], n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i + n <= tokens.length; i++) {
    out.push(tokens.slice(i, i + n).join(" "));
  }
  return out;
}

function counter(items: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) m.set(it, (m.get(it) ?? 0) + 1);
  return m;
}

/** Modified n-gram precision (clipped) — the inner term of BLEU. */
function ngramPrecision(hyp: string[], ref: string[], n: number): { match: number; total: number } {
  const hg = ngrams(hyp, n);
  const rg = ngrams(ref, n);
  if (hg.length === 0) return { match: 0, total: 0 };
  const refCounts = counter(rg);
  const hypCounts = counter(hg);
  let match = 0;
  for (const [g, c] of hypCounts) {
    match += Math.min(c, refCounts.get(g) ?? 0);
  }
  return { match, total: hg.length };
}

/** Sentence-level BLEU-4 with smoothing (add-one on numerators). */
export function bleu4(hyp: string, ref: string): number {
  const h = tokenize(hyp);
  const r = tokenize(ref);
  if (h.length === 0 || r.length === 0) return 0;

  let logP = 0;
  for (let n = 1; n <= 4; n++) {
    const { match, total } = ngramPrecision(h, r, n);
    if (total === 0) return 0;
    const p = (match + 1) / (total + 1);
    logP += Math.log(p);
  }
  const bp = h.length >= r.length ? 1 : Math.exp(1 - r.length / h.length);
  return bp * Math.exp(logP / 4);
}

/** Longest common subsequence length over token arrays. */
function lcsLen(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  let prev = new Array<number>(b.length + 1).fill(0);
  let curr = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], curr[j - 1]);
    }
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }
  return prev[b.length];
}

/** ROUGE-L F1 (β=1). */
export function rougeL(hyp: string, ref: string): number {
  const h = tokenize(hyp);
  const r = tokenize(ref);
  if (h.length === 0 || r.length === 0) return 0;
  const lcs = lcsLen(h, r);
  if (lcs === 0) return 0;
  const p = lcs / h.length;
  const rec = lcs / r.length;
  return (2 * p * rec) / (p + rec);
}

export interface PRF1 { p: number; r: number; f1: number }

/** Content-keyword precision/recall/F1 over the unique-set intersection. */
export function keywordPRF1(hyp: string, ref: string): PRF1 {
  const hSet = new Set(contentTokens(hyp));
  const rSet = new Set(contentTokens(ref));
  if (hSet.size === 0 || rSet.size === 0) return { p: 0, r: 0, f1: 0 };
  let inter = 0;
  for (const t of hSet) if (rSet.has(t)) inter++;
  const p = inter / hSet.size;
  const r = inter / rSet.size;
  const f1 = p + r === 0 ? 0 : (2 * p * r) / (p + r);
  return { p, r, f1 };
}

/** Step-level Jaccard between token sets; ≥0.5 counts as a match. */
const STEP_MATCH_THRESHOLD = 0.5;

function stepJaccard(a: string, b: string): number {
  const ta = new Set(contentTokens(a));
  const tb = new Set(contentTokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

/**
 * Step P/R/F1: greedy 1:1 matching by descending Jaccard similarity, with each
 * matched pair >= STEP_MATCH_THRESHOLD counted as a true positive. Precision
 * is matches/|hyp_steps|, recall is matches/|ref_steps|.
 */
export function stepPRF1(hypSteps: string[], refSteps: string[]): PRF1 {
  if (hypSteps.length === 0 || refSteps.length === 0) return { p: 0, r: 0, f1: 0 };

  type Pair = { hi: number; ri: number; sim: number };
  const pairs: Pair[] = [];
  for (let hi = 0; hi < hypSteps.length; hi++) {
    for (let ri = 0; ri < refSteps.length; ri++) {
      const sim = stepJaccard(hypSteps[hi], refSteps[ri]);
      if (sim >= STEP_MATCH_THRESHOLD) pairs.push({ hi, ri, sim });
    }
  }
  pairs.sort((a, b) => b.sim - a.sim);

  const usedH = new Set<number>();
  const usedR = new Set<number>();
  let matches = 0;
  for (const { hi, ri } of pairs) {
    if (usedH.has(hi) || usedR.has(ri)) continue;
    usedH.add(hi);
    usedR.add(ri);
    matches++;
  }

  const p = matches / hypSteps.length;
  const r = matches / refSteps.length;
  const f1 = p + r === 0 ? 0 : (2 * p * r) / (p + r);
  return { p, r, f1 };
}

export interface RecordScore {
  bleu4: number;
  rougeL: number;
  keyword: PRF1;
  step: PRF1;
}

export interface Summary {
  n: number;
  bleu4: { mean: number; std: number };
  rougeL: { mean: number; std: number };
  keywordF1: { mean: number; std: number };
  stepF1: { mean: number; std: number };
}

function meanStd(xs: number[]): { mean: number; std: number } {
  if (xs.length === 0) return { mean: 0, std: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
  return { mean, std: Math.sqrt(variance) };
}

export function aggregate(scores: RecordScore[]): Summary {
  return {
    n: scores.length,
    bleu4: meanStd(scores.map((s) => s.bleu4)),
    rougeL: meanStd(scores.map((s) => s.rougeL)),
    keywordF1: meanStd(scores.map((s) => s.keyword.f1)),
    stepF1: meanStd(scores.map((s) => s.step.f1)),
  };
}
