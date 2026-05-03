"use client";

import type { QCResult } from "@/lib/schema";
import {
  ArtifactPanel,
  ArtifactPillBtn,
  ArtifactIconBtn,
  CopyIcon,
  SearchIcon,
} from "./ArtifactPanel";

const NOVELTY_LABEL: Record<QCResult["novelty"], { text: string; cls: string }> = {
  match: { text: "Match found (≥40%)", cls: "bg-red-100 text-red-800 border-red-200" },
  near_match: { text: "Near match (15-39%)", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  no_match: { text: "No match (<15%)", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
};

export function QCPanel(props: {
  loading: boolean;
  qc: QCResult | null;
  onGeneratePlan: () => void;
  planLoading: boolean;
  planReady: boolean;
}) {
  const copy = () => {
    if (!props.qc) return;
    void navigator.clipboard.writeText(JSON.stringify(props.qc, null, 2));
  };

  return (
    <ArtifactPanel
      title="Literature QC"
      icon={<SearchIcon />}
      badge={
        props.qc && (
          <span
            className={`chip border ${NOVELTY_LABEL[props.qc.novelty].cls}`}
            data-testid="novelty-chip"
          >
            {NOVELTY_LABEL[props.qc.novelty].text}
          </span>
        )
      }
      actions={
        <>
          {props.qc && (
            <ArtifactIconBtn onClick={copy} title="Copy as JSON">
              <CopyIcon />
            </ArtifactIconBtn>
          )}
          {props.qc && !props.planReady && (
            <ArtifactPillBtn onClick={props.onGeneratePlan} disabled={props.planLoading}>
              {props.planLoading ? "Generating…" : "Generate plan →"}
            </ArtifactPillBtn>
          )}
        </>
      }
      loading={props.loading}
    >
      {props.qc && (
        <div className="space-y-5">
          <p className="text-sm leading-relaxed text-ink-700">{props.qc.rationale}</p>

          <div>
            <div className="label mb-2">References ({props.qc.references.length})</div>
            {props.qc.references.length === 0 ? (
              <div className="text-sm text-ink-500 italic">No close references surfaced.</div>
            ) : (
              <ul className="space-y-2">
                {props.qc.references.map((r, i) => (
                  <li
                    key={i}
                    className="text-sm border border-ink-200 rounded-lg p-3 bg-ink-100/60"
                  >
                    <a
                      href={
                        r.doi
                          ? `https://doi.org/${r.doi}`
                          : r.url || `https://scholar.google.com/scholar?q=${encodeURIComponent(r.title)}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-ink-900 hover:text-accent-600 hover:underline"
                    >
                      {r.title}
                    </a>
                    <div className="text-xs text-ink-500 mt-0.5">
                      {[r.authors, r.year, r.venue].filter(Boolean).join(" · ")}
                    </div>
                    {r.snippet && <div className="mt-1 text-ink-700">{r.snippet}</div>}
                    <div className="mt-1 flex gap-3 text-xs">
                      {r.doi && (
                        <a
                          className="text-accent-700 hover:underline"
                          href={`https://doi.org/${r.doi}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          doi:{r.doi}
                        </a>
                      )}
                      {r.url && (
                        <a
                          className="text-accent-700 hover:underline"
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          source
                        </a>
                      )}
                      {typeof r.similarity === "number" && (
                        <span className="text-ink-500">
                          similarity {(r.similarity * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </ArtifactPanel>
  );
}
