"use client";

import { useState } from "react";

const EXAMPLES = [
  "Knocking down NRF2 increases sensitivity of A549 cells to cisplatin in vitro.",
  "Overexpression of SIRT1 reduces senescence markers in primary human fibroblasts.",
  "qPCR detection of GAPDH mRNA is more reproducible with random hexamer primers than oligo-dT in HeLa cells.",
];

export function HypothesisForm(props: {
  onSubmit: (hypothesis: string) => void;
  disabled?: boolean;
  initialHypothesis?: string;
  onReset?: () => void;
  showReset?: boolean;
  centered?: boolean;
}) {
  const [h, setH] = useState(props.initialHypothesis ?? "");

  const valid = h.trim().length >= 8;

  return (
    <section className={`card p-5 ${props.centered ? "shadow-lg border-ink-200" : ""}`}>
      <div className="flex items-center justify-between mb-3">
        {!props.centered && (
          <div>
            <div className="label">Step 1</div>
            <h2 className="text-lg font-semibold">Enter a scientific hypothesis</h2>
          </div>
        )}
        {props.showReset && (
          <button className="btn-ghost" onClick={props.onReset}>
            New session
          </button>
        )}
      </div>
      <textarea
        value={h}
        onChange={(e) => setH(e.target.value)}
        rows={4}
        placeholder="e.g. Knocking down NRF2 increases sensitivity of A549 cells to cisplatin..."
        className="w-full rounded-lg border border-ink-200 bg-ink-100/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/60 focus:border-accent-500/50"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-ink-500 mr-1">Try:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              className="chip border border-ink-200 bg-ink-100/60 hover:bg-ink-200/70 text-ink-700"
              onClick={() => setH(ex)}
              disabled={props.disabled}
            >
              {ex.slice(0, 64)}…
            </button>
          ))}
        </div>
        <button
          className="btn-primary"
          disabled={!valid || props.disabled}
          onClick={() => props.onSubmit(h.trim())}
        >
          {props.disabled ? "Working…" : "Run literature QC"}
        </button>
      </div>
    </section>
  );
}
