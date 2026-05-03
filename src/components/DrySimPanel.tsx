"use client";

import { useState } from "react";
import type { ExperimentPlan, SimulationResult } from "@/lib/schema";

const EXP_TYPE_LABEL: Record<string, string> = {
  pcr: "PCR",
  cell_culture: "Cell Culture",
  western_blot: "Western Blot",
  generic: "Generic",
};

function probColor(p: number): string {
  if (p >= 0.9) return "bg-emerald-500";
  if (p >= 0.75) return "bg-amber-400";
  return "bg-red-500";
}

function probTextColor(p: number): string {
  if (p >= 0.9) return "text-emerald-700";
  if (p >= 0.75) return "text-amber-700";
  return "text-red-700";
}

function downloadCSV(result: SimulationResult, hypothesis: string) {
  const rows = [
    ["Step", "Title", "Success Probability", "Predicted Yield", "Risk Flags"],
    ...result.stepOutcomes.map((s) => [
      String(s.stepIndex + 1),
      s.title,
      String(s.successProbability),
      s.predictedYield ?? "",
      s.riskFlags.join("; "),
    ]),
    [],
    ["Overall Success Probability", String(result.overallSuccessProbability)],
    ["Confidence Score", String(result.confidenceScore)],
    ["Experiment Type", EXP_TYPE_LABEL[result.experimentType] ?? result.experimentType],
    [],
    ["Critical Risks", result.criticalRisks.join(" | ")],
    ["Recommendations", result.recommendations.join(" | ")],
    ["Optimistic Scenario", result.optimisticScenario],
    ["Pessimistic Scenario", result.pessimisticScenario],
    [],
    ["Hypothesis", hypothesis],
  ];
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "dry-run-sim.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function DrySimPanel({
  plan,
  hypothesis,
}: {
  plan: ExperimentPlan;
  hypothesis: string;
}) {
  const [nRuns, setNRuns] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);

  async function runSim() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch("/api/drysim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan, hypothesis, nRuns }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setResult(data.result as SimulationResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-5 w-48 bg-ink-100 rounded" />
        <div className="h-3 bg-ink-100 rounded w-2/3" />
        <div className="h-3 bg-ink-100 rounded w-1/2" />
        <div className="h-32 bg-ink-100 rounded" />
        <div className="text-sm text-ink-400 text-center">Running {nRuns} simulations…</div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="space-y-4 max-w-sm">
        <p className="text-sm text-ink-600">
          Simulate this protocol stochastically before entering the lab. BioForge runs two
          AG2 agents — a Simulator and a peer-reviewing Reporter — to predict per-step
          success probabilities, contamination risks, and yield estimates.
        </p>
        <div>
          <label className="label block mb-1">Number of simulated runs</label>
          <input
            type="number"
            min={10}
            max={1000}
            value={nRuns}
            onChange={(e) => setNRuns(Math.max(10, Math.min(1000, Number(e.target.value) || 100)))}
            className="w-full border border-ink-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent-600"
          />
          <div className="text-xs text-ink-400 mt-1">10 – 1000</div>
        </div>
        <button className="btn-primary w-full" onClick={runSim}>
          Run dry simulation
        </button>
        {error && <div className="text-red-700 text-sm font-mono">{error}</div>}
      </div>
    );
  }

  const pct = (p: number) => `${Math.round(p * 100)}%`;

  return (
    <div className="space-y-5 text-sm">
      {/* Summary row */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex flex-col items-center bg-ink-50 border border-ink-200 rounded-lg px-4 py-2">
          <div className="text-xs text-ink-500 uppercase tracking-wide">Overall success</div>
          <div className={`text-2xl font-semibold ${probTextColor(result.overallSuccessProbability)}`}>
            {pct(result.overallSuccessProbability)}
          </div>
        </div>
        <div className="flex flex-col items-center bg-ink-50 border border-ink-200 rounded-lg px-4 py-2">
          <div className="text-xs text-ink-500 uppercase tracking-wide">Confidence</div>
          <div className="text-2xl font-semibold text-ink-800">{pct(result.confidenceScore)}</div>
        </div>
        <span className="chip bg-blue-100 text-blue-800 border border-blue-200">
          {EXP_TYPE_LABEL[result.experimentType] ?? result.experimentType}
        </span>
        <div className="ml-auto flex gap-2">
          <button
            className="btn-ghost text-xs"
            onClick={() => downloadCSV(result, hypothesis)}
          >
            Download CSV
          </button>
          <button
            className="btn-ghost text-xs"
            onClick={() => { setResult(null); setError(null); }}
          >
            Re-run / Tweak
          </button>
        </div>
      </div>

      {/* Per-step table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-ink-500 text-xs uppercase">
              <th className="py-2 pr-3">Step</th>
              <th className="py-2 pr-3">Success probability</th>
              <th className="py-2 pr-3">Yield</th>
              <th className="py-2">Risk flags</th>
            </tr>
          </thead>
          <tbody>
            {result.stepOutcomes.map((s) => (
              <tr key={s.stepIndex} className="border-t border-ink-200 align-top">
                <td className="py-2 pr-3 font-medium whitespace-nowrap">
                  <span className="chip bg-ink-100 text-ink-700 mr-1">{s.stepIndex + 1}</span>
                  {s.title}
                </td>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-ink-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${probColor(s.successProbability)}`}
                        style={{ width: pct(s.successProbability) }}
                      />
                    </div>
                    <span className={`font-mono text-xs ${probTextColor(s.successProbability)}`}>
                      {pct(s.successProbability)}
                    </span>
                  </div>
                </td>
                <td className="py-2 pr-3 text-ink-500">{s.predictedYield ?? "—"}</td>
                <td className="py-2">
                  {s.riskFlags.length > 0
                    ? s.riskFlags.map((f, i) => (
                        <span key={i} className="chip bg-amber-100 text-amber-800 mr-1">{f}</span>
                      ))
                    : <span className="text-ink-400">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Critical risks */}
      {result.criticalRisks.length > 0 && (
        <div>
          <div className="label mb-1">Critical risks</div>
          <ul className="space-y-1">
            {result.criticalRisks.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="chip bg-red-100 text-red-800 mt-0.5 shrink-0">risk</span>
                <span className="text-ink-700">{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {result.recommendations.length > 0 && (
        <div>
          <div className="label mb-1">Recommendations</div>
          <ul className="space-y-1">
            {result.recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="chip bg-emerald-100 text-emerald-800 mt-0.5 shrink-0">tip</span>
                <span className="text-ink-700">{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Scenarios */}
      <div className="grid md:grid-cols-2 gap-3">
        <div className="border border-emerald-200 bg-emerald-50 rounded p-3">
          <div className="label text-emerald-800 mb-1">Optimistic scenario</div>
          <div className="text-emerald-900 text-sm">{result.optimisticScenario}</div>
        </div>
        <div className="border border-red-200 bg-red-50 rounded p-3">
          <div className="label text-red-800 mb-1">Pessimistic scenario</div>
          <div className="text-red-900 text-sm">{result.pessimisticScenario}</div>
        </div>
      </div>

      {result.reportMarkdown && (
        <div className="border border-ink-200 rounded p-3 bg-ink-50">
          <div className="label mb-1">Agent report</div>
          <pre className="text-xs text-ink-700 whitespace-pre-wrap">{result.reportMarkdown}</pre>
        </div>
      )}
    </div>
  );
}
