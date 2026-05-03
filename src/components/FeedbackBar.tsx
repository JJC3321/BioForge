"use client";

import { useState } from "react";
import type { ExperimentPlan, SectionRating } from "@/lib/schema";

const SECTIONS: SectionRating["section"][] = [
  "structuredHypothesis",
  "protocol",
  "materials",
  "controls",
  "validation",
  "risks",
  "timeline",
  "budget",
  "overall",
];

const SECTION_LABELS: Record<string, string> = {
  structuredHypothesis: "structured",
};

export function FeedbackBar(props: {
  planId: string;
  hypothesis: string;
  plan: ExperimentPlan;
}) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [tags, setTags] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function setRating(section: string, value: number) {
    setRatings((r) => ({ ...r, [section]: value }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        planId: props.planId,
        hypothesis: props.hypothesis,
        domain: tags.split(",").map((t) => t.trim()).filter(Boolean)[0] || undefined,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        ratings: Object.entries(ratings).map(([section, rating]) => ({ section, rating })),
        corrections: [],
        freeformNotes: notes || undefined,
      };
      const r = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(await r.text());
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card p-5">
      <div className="label">Step 4</div>
      <h2 className="text-lg font-semibold mb-3">Reviewer feedback</h2>

      <div className="grid md:grid-cols-3 gap-3 text-sm">
        <div className="md:col-span-2">
          <div className="label mb-1">Section ratings (1–5)</div>
          <div className="grid grid-cols-2 gap-2">
            {SECTIONS.map((s) => (
              <div key={s} className="flex items-center justify-between border border-ink-200 rounded px-3 py-1.5 bg-ink-100/70">
                <span className="text-ink-700">{SECTION_LABELS[s] || s}</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      onClick={() => setRating(s, v)}
                      className={`w-7 h-7 rounded text-xs font-medium ${
                        ratings[s] === v
                          ? "bg-accent-600 text-ink-50"
                          : "bg-ink-200/60 text-ink-700 hover:bg-ink-200"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="label mb-1">Tags (comma separated)</div>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full rounded-md border border-ink-200 bg-ink-100/70 px-2 py-1 text-sm"
              placeholder="qPCR, knockdown, A549"
            />
          </div>
          <div>
            <div className="label mb-1">Notes / corrections</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="What's wrong, what's missing, what should be different next time…"
              className="w-full rounded-md border border-ink-200 bg-ink-100/70 px-2 py-1 text-sm"
            />
          </div>
          <button className="btn-primary w-full" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save feedback"}
          </button>
          {savedAt && (
            <div className="text-xs text-emerald-700">
              Saved. Future similar runs will use this as guidance.
            </div>
          )}
          {error && <div className="text-xs text-red-700">{error}</div>}
        </div>
      </div>
    </section>
  );
}
