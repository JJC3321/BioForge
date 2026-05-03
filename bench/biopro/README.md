# BioProBench (GEN) Benchmark Harness

Scores `generatePlan` against the **GEN** (protocol generation) split of
[BioProBench](https://huggingface.co/datasets/GreatCaptainNemo/BioProBench)
(Liu et al., arXiv:2505.07889).

## Quickstart

```bash
npm install                                      # one-time, picks up tsx dep
npm run bench:biopro -- --n=5                    # smoke test (stub mode, 5 records)
npm run bench:biopro -- --n=50                   # 50-record stub run
GEMINI_API_KEY=... npm run bench:biopro -- --n=50 --live
```

The first run downloads `GEN_test.json` (772 records) directly from the
[BioProBench HF dataset repo](https://huggingface.co/datasets/GreatCaptainNemo/BioProBench/tree/main)
and caches a normalized JSONL at `bench/biopro/data/gen-test.jsonl`.
Subsequent runs reuse the cache. (We bypass the datasets-server REST API
because the repo's GEN/ERR/etc. subsets share one config and have non-matching
schemas, which makes the server's auto-conversion fail.)

## Flags

| Flag | Default | Meaning |
|---|---|---|
| `--n=<int>` | `50` | Number of GEN test records (max 772 in the test split) |
| `--live` | off | Use Gemini via `generatePlan` live path; requires `GEMINI_API_KEY`. Without the key, falls back to stub. |
| `--use-official=<path>` | off | After local scoring, write a JSONL and shell out to `python Metrics/GEN.py` from a cloned `bioprotocolbench` for authoritative scores. |
| `--out=<file>` | timestamped | Override the results JSON path |

## Metrics

The built-in TS scorer (`score.ts`) reports BLEU-4, ROUGE-L F1, Keyword P/R/F1,
and Step P/R/F1 (greedy 1:1 matching at Jaccard ≥ 0.5). These approximate the
paper's metrics for fast iteration. For numbers you'd cite, run with
`--use-official`.

## Output

Per run, two artifacts are written under `bench/biopro/results/<timestamp>-<mode>.*`:

- `*.json` — full per-record results: id, instruction, expected text, the
  generated `ExperimentPlan`, the rendered flat-text protocol, per-record
  scores, and an `error` field if `generatePlan` threw.
- `*.jsonl` *(only with `--use-official`)* — one record per line with
  `id`, `instruction`, `output`, and `generated_response` for the official
  scorer.

## Using the official scorer

```bash
git clone https://github.com/YuyangSunshine/bioprotocolbench /tmp/bpb
pip install -r /tmp/bpb/requirements.txt
npm run bench:biopro -- --n=50 --use-official=/tmp/bpb
```

Set `PYTHON_BIN=python3` if `python` on your PATH points at Python 2.

## How the harness maps GEN → our app

| BioProBench GEN field | Mapped to |
|---|---|
| `input` (the protocol question, e.g. "How to prepare cell extracts...") | `hypothesis` arg of `generatePlan` |
| `instruction` (meta-instruction like "use flat list format") | not passed to `generatePlan` — used only for context in the results JSON |
| no field | `domain` left undefined (stub auto-detects from keywords) |
| no field | `qc: null`, `similarFeedback: []` (deterministic, no DB leakage) |
| `output` (string array of step lines) | joined with `\n` and used as the scoring target |

The harness does not call `runQC` — keeping benchmark runs offline-safe and
fast. Add `--with-qc` in a future iteration if full-pipeline evaluation is
needed.

## Expected runtimes (reference)

| Mode | n=50 | n=772 (full test split) |
|---|---|---|
| stub | ~1s | ~10s |
| live (Gemini, concurrency=1) | ~2 min | ~30 min |

Live timing is dominated by Gemini latency; stub is bound by JSON parse + scoring.
