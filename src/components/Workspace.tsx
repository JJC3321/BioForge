"use client";

import { useState } from "react";
import type { ExperimentPlan, QCResult } from "@/lib/schema";
import { HypothesisForm } from "./HypothesisForm";
import { QCPanel } from "./QCPanel";
import { PlanView } from "./PlanView";
import { FeedbackBar } from "./FeedbackBar";

type Stage = "idle" | "qc-loading" | "qc-done" | "plan-loading" | "plan-done" | "error";

export function Workspace() {
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hypothesis, setHypothesis] = useState("");
  const [qc, setQc] = useState<QCResult | null>(null);
  const [plan, setPlan] = useState<ExperimentPlan | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [usedFeedback, setUsedFeedback] = useState<number>(0);

  async function runQC(h: string) {
    setError(null);
    setQc(null);
    setPlan(null);
    setPlanId(null);
    setHypothesis(h);
    setStage("qc-loading");
    try {
      const r = await fetch("/api/qc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hypothesis: h }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = (await r.json()) as QCResult;
      setQc(data);
      setStage("qc-done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage("error");
    }
  }

  async function runPlan() {
    if (!hypothesis) return;
    setStage("plan-loading");
    setError(null);
    try {
      const r = await fetch("/api/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hypothesis, qc }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setPlan(data.plan);
      setPlanId(data.id);
      setUsedFeedback(data.usedFeedback ?? 0);
      setStage("plan-done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage("error");
    }
  }

  function reset() {
    setStage("idle");
    setQc(null);
    setPlan(null);
    setPlanId(null);
    setError(null);
  }

  const isIdle = stage === "idle" || stage === "error";

  // Centered chatbox layout (idle/error state)
  if (isIdle) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-serif text-ink-900 mb-2">What would you like to test?</h1>
            <p className="text-ink-500">Enter a scientific hypothesis to generate an experiment plan</p>
          </div>
          <HypothesisForm
            onSubmit={runQC}
            disabled={false}
            initialHypothesis={hypothesis}
            onReset={reset}
            showReset={false}
            centered
          />
          {error && (
            <div className="mt-6 card p-4 border-red-300 bg-red-50 text-red-800 text-sm">
              <div className="font-semibold mb-1">Something went wrong</div>
              <div className="font-mono text-xs whitespace-pre-wrap">{error}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Two-panel layout (active generation/results state)
  const hasPlan = stage === "plan-loading" || stage === "plan-done";

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <div className="flex-1 grid lg:grid-cols-2 gap-0 overflow-hidden">
        {/* Left Panel - Input */}
        <div className="overflow-y-auto scrollbar-hide p-6 border-r border-ink-200 bg-ink-50/50">
          <HypothesisForm
            onSubmit={runQC}
            disabled={stage === "qc-loading" || stage === "plan-loading"}
            initialHypothesis={hypothesis}
            onReset={reset}
            showReset={true}
          />
          {/* Move QCPanel to left panel when plan is generated */}
          {hasPlan && qc && (
            <div className="mt-6">
              <QCPanel
                loading={false}
                qc={qc}
                onGeneratePlan={runPlan}
                planLoading={stage === "plan-loading"}
                planReady={!!plan}
              />
            </div>
          )}
        </div>

        {/* Right Panel - Output */}
        <div className="overflow-y-auto scrollbar-hide p-6 bg-white">
          {/* Show QCPanel at top of right panel only when plan is NOT generated */}
          {!hasPlan && (stage === "qc-loading" || qc) && (
            <QCPanel
              loading={stage === "qc-loading"}
              qc={qc}
              onGeneratePlan={runPlan}
              planLoading={false}
              planReady={false}
            />
          )}

          {/* PlanView at top when plan is generated */}
          {hasPlan && (
            <PlanView
              loading={stage === "plan-loading"}
              plan={plan}
              planId={planId}
              hypothesis={hypothesis}
              onPlanChange={setPlan}
              usedFeedback={usedFeedback}
            />
          )}

          {plan && planId && (
            <div className="mt-6">
              <FeedbackBar planId={planId} hypothesis={hypothesis} plan={plan} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
