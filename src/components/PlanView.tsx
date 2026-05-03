"use client";

import { useState } from "react";
import type { ExperimentPlan } from "@/lib/schema";

type Tab = "summary" | "protocol" | "materials" | "controls" | "budget" | "timeline" | "risks";
const TABS: { id: Tab; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "protocol", label: "Protocol" },
  { id: "materials", label: "Materials" },
  { id: "controls", label: "Controls" },
  { id: "budget", label: "Budget" },
  { id: "timeline", label: "Timeline" },
  { id: "risks", label: "Risks" },
];

export function PlanView(props: {
  loading: boolean;
  plan: ExperimentPlan | null;
  planId: string | null;
  hypothesis: string;
  onPlanChange: (p: ExperimentPlan) => void;
  usedFeedback: number;
}) {
  const [tab, setTab] = useState<Tab>("summary");
  const [editMode, setEditMode] = useState(false);

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div>
          <div className="label">Step 3</div>
          <h2 className="text-lg font-semibold">Experiment plan</h2>
        </div>
        <div className="flex items-center gap-2">
          {props.usedFeedback > 0 && (
            <span className="chip bg-emerald-100 text-emerald-800 border border-emerald-200">
              Incorporated {props.usedFeedback} prior feedback{props.usedFeedback === 1 ? "" : "s"}
            </span>
          )}
          {props.plan && (
            <button
              className={editMode ? "btn-secondary" : "btn-ghost"}
              onClick={() => setEditMode((v) => !v)}
            >
              {editMode ? "Done editing" : "Review / edit"}
            </button>
          )}
        </div>
      </div>

      {props.loading && (
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-48 bg-ink-100 rounded" />
          <div className="h-3 bg-ink-100 rounded w-2/3" />
          <div className="h-3 bg-ink-100 rounded w-1/2" />
          <div className="h-32 bg-ink-100 rounded" />
        </div>
      )}

      {props.plan && (
        <>
          <div className="flex flex-wrap gap-1 border-b border-ink-200 mb-4">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-2 text-sm font-medium -mb-px border-b-2 ${
                  tab === t.id
                    ? "border-accent-600 text-accent-600"
                    : "border-transparent text-ink-500 hover:text-ink-800"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "summary" && <SummaryTab plan={props.plan} />}
          {tab === "protocol" && (
            <ProtocolTab plan={props.plan} editMode={editMode} onChange={props.onPlanChange} />
          )}
          {tab === "materials" && (
            <MaterialsTab plan={props.plan} editMode={editMode} onChange={props.onPlanChange} />
          )}
          {tab === "controls" && <ControlsTab plan={props.plan} />}
          {tab === "budget" && <BudgetTab plan={props.plan} />}
          {tab === "timeline" && <TimelineTab plan={props.plan} />}
          {tab === "risks" && <RisksTab plan={props.plan} />}
        </>
      )}
    </section>
  );
}

function SummaryTab({ plan }: { plan: ExperimentPlan }) {
  const h = plan.structuredHypothesis;
  return (
    <div className="grid md:grid-cols-2 gap-4 text-sm">
      <Field label="Question" value={h.question} />
      <Field label="Domain" value={plan.domain} />
      <Field label="Independent variable" value={h.independentVariable} />
      <Field label="Dependent variable" value={h.dependentVariable} />
      <Field label="Predicted outcome" value={h.predictedOutcome} />
      {h.scope && <Field label="Scope" value={h.scope} />}
      <Field label="Validation" value={plan.validation.join(" · ")} />
      <Field
        label="Estimated budget"
        value={`$${plan.budgetUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
      />
      {plan.assumptions && plan.assumptions.length > 0 && (
        <div className="md:col-span-2">
          <div className="label mb-1">Assumptions</div>
          <ul className="list-disc list-inside text-ink-700">
            {plan.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}
      {plan.reviewerNotes && (
        <div className="md:col-span-2 border-l-4 border-amber-300 bg-amber-50 p-3 rounded">
          <div className="label text-amber-800">Reviewer notes</div>
          <div className="text-sm text-amber-900 whitespace-pre-wrap">{plan.reviewerNotes}</div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="text-ink-800">{value}</div>
    </div>
  );
}

function ProtocolTab({
  plan,
  editMode,
  onChange,
}: {
  plan: ExperimentPlan;
  editMode: boolean;
  onChange: (p: ExperimentPlan) => void;
}) {
  return (
    <ol className="space-y-2">
      {plan.protocol.map((s, i) => (
        <li key={i} className="border border-ink-200 rounded-md p-3 bg-ink-100/70">
          <div className="flex items-baseline gap-2">
            <span className="chip bg-ink-100 text-ink-700 mr-1">Step {s.step}</span>
            {editMode ? (
              <input
                className="flex-1 border-b border-dashed border-ink-300 text-sm font-medium bg-transparent focus:outline-none"
                value={s.title}
                onChange={(e) => {
                  const next = { ...plan, protocol: plan.protocol.slice() };
                  next.protocol[i] = { ...s, title: e.target.value };
                  onChange(next);
                }}
              />
            ) : (
              <span className="font-medium">{s.title}</span>
            )}
            {s.critical && <span className="chip bg-red-100 text-red-800">critical</span>}
            {typeof s.durationMinutes === "number" && (
              <span className="text-xs text-ink-500">{s.durationMinutes} min</span>
            )}
          </div>
          {editMode ? (
            <textarea
              className="mt-1 w-full text-sm bg-ink-50 border border-ink-200 rounded p-2"
              rows={3}
              value={s.description}
              onChange={(e) => {
                const next = { ...plan, protocol: plan.protocol.slice() };
                next.protocol[i] = { ...s, description: e.target.value };
                onChange(next);
              }}
            />
          ) : (
            <p className="mt-1 text-sm text-ink-700 whitespace-pre-wrap">{s.description}</p>
          )}
        </li>
      ))}
    </ol>
  );
}

function MaterialsTab({
  plan,
  editMode,
  onChange,
}: {
  plan: ExperimentPlan;
  editMode: boolean;
  onChange: (p: ExperimentPlan) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-ink-500 text-xs uppercase">
            <th className="py-2 pr-3">Material</th>
            <th className="py-2 pr-3">Quantity</th>
            <th className="py-2 pr-3">Supplier</th>
            <th className="py-2 pr-3">Catalog #</th>
            <th className="py-2 pr-3 text-right">Est. cost</th>
          </tr>
        </thead>
        <tbody>
          {plan.materials.map((m, i) => (
            <tr key={i} className="border-t border-ink-200 align-top">
              <td className="py-2 pr-3 font-medium">
                {editMode ? (
                  <input
                    className="border-b border-dashed border-ink-300 bg-transparent w-full"
                    value={m.name}
                    onChange={(e) => {
                      const next = { ...plan, materials: plan.materials.slice() };
                      next.materials[i] = { ...m, name: e.target.value };
                      onChange(next);
                    }}
                  />
                ) : (
                  <>
                    {m.name}
                    {m.notes && <div className="text-xs text-ink-500">{m.notes}</div>}
                  </>
                )}
              </td>
              <td className="py-2 pr-3">{m.quantity}</td>
              <td className="py-2 pr-3">{m.supplier ?? "—"}</td>
              <td className="py-2 pr-3 font-mono text-xs">{m.catalogNumber ?? "—"}</td>
              <td className="py-2 pr-3 text-right">
                {typeof m.estimatedCostUSD === "number"
                  ? `$${m.estimatedCostUSD.toLocaleString()}`
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ControlsTab({ plan }: { plan: ExperimentPlan }) {
  return (
    <div className="grid md:grid-cols-2 gap-3">
      {plan.controls.map((c, i) => (
        <div key={i} className="border border-ink-200 rounded-md p-3 bg-ink-100/70">
          <div className="flex items-center gap-2">
            <span className="chip bg-ink-100 text-ink-700">{c.type}</span>
            <span className="font-medium">{c.name}</span>
          </div>
          <p className="mt-1 text-sm text-ink-700">{c.description}</p>
        </div>
      ))}
    </div>
  );
}

function BudgetTab({ plan }: { plan: ExperimentPlan }) {
  const itemTotal = plan.materials.reduce((s, m) => s + (m.estimatedCostUSD ?? 0), 0);
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-baseline gap-3">
        <div className="text-2xl font-semibold">
          ${plan.budgetUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
        <div className="text-ink-500">total estimated</div>
      </div>
      <div className="text-ink-700">
        Itemized materials sum: ${itemTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </div>
      <div className="grid md:grid-cols-2 gap-2">
        {plan.materials
          .filter((m) => typeof m.estimatedCostUSD === "number" && m.estimatedCostUSD! > 0)
          .map((m, i) => (
            <div
              key={i}
              className="flex justify-between border border-ink-200 rounded px-3 py-1.5 bg-ink-100/70"
            >
              <span className="truncate mr-2">{m.name}</span>
              <span className="font-mono">${m.estimatedCostUSD!.toLocaleString()}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

function TimelineTab({ plan }: { plan: ExperimentPlan }) {
  const total = plan.timeline.reduce((s, t) => s + t.durationDays, 0);
  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-500">Total: {total} days</div>
      <div className="space-y-4">
        {plan.timeline.map((p, i) => (
          <div key={i} className="border-b border-ink-200 pb-3 last:border-0">
            <div className="flex justify-between items-center">
              <span className="font-medium">{p.phase}</span>
              <span className="text-ink-500">{p.durationDays} days</span>
            </div>
            {p.description && (
              <div className="text-sm text-ink-400 mt-1">{p.description}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function RisksTab({ plan }: { plan: ExperimentPlan }) {
  const sevColor: Record<string, string> = {
    low: "bg-emerald-100 text-emerald-800",
    medium: "bg-amber-100 text-amber-800",
    high: "bg-red-100 text-red-800",
  };
  return (
    <ul className="space-y-2">
      {plan.risks.map((r, i) => (
        <li key={i} className="border border-ink-200 rounded p-3 bg-ink-100/70">
          <div className="flex items-center gap-2">
            <span className={`chip ${sevColor[r.severity]}`}>{r.severity}</span>
            <span className="font-medium">{r.description}</span>
          </div>
          <div className="text-sm text-ink-700 mt-1">
            <span className="label mr-1">Mitigation:</span>
            {r.mitigation}
          </div>
        </li>
      ))}
    </ul>
  );
}
