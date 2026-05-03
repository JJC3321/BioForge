import { QCResult } from "./schema";
import { classifyNovelty, searchLiterature } from "./literature";
import { isLiveLLM, structuredCall } from "./gemini";

// Only ask the model for the rationale text. Novelty + references are forced from the
// local corpus on the Node side (see "grounded" below) so requiring the model to echo
// them back was wasted output tokens — and frequently caused the model to hit
// maxOutputTokens mid-function-call, returning empty args and triggering the
// "LLM rationale unavailable" fallback.
const QC_TOOL_SCHEMA = {
  type: "object",
  properties: {
    rationale: { type: "string" },
  },
  required: ["rationale"],
} as const;

export async function runQC(hypothesis: string, domain: string | undefined): Promise<QCResult> {
  const hits = await searchLiterature(`${hypothesis} ${domain ?? ""}`);
  const novelty = classifyNovelty(hits);

  if (!isLiveLLM()) {
    const fallbackRationale: Record<typeof novelty, string> = {
      match: "A directly matching study was found in the local corpus (similarity ≥40%). Consider differentiating cell line, dosing, or readout to ensure novelty.",
      near_match: "Related work exists with moderate similarity (15-39%). Your hypothesis may be a refinement, replication, or extension of prior findings.",
      no_match: "No significant matches in the local literature corpus (similarity <15%). Treat as exploratory and consider tightening the hypothesis for reproducibility.",
    };
    return QCResult.parse({
      novelty,
      rationale: fallbackRationale[novelty],
      references: hits,
      searchedQueries: [hypothesis, domain ?? ""].filter(Boolean),
    });
  }

  // LLM-aided rewrite of the rationale, but novelty + references stay grounded in the corpus.
  try {
    const result = await structuredCall<{ rationale: string }>({
      system:
        "You are a rigorous scientific literature reviewer. Given a hypothesis, a novelty " +
        "classification, and a list of candidate references with similarity scores, write a " +
        "single concise rationale (2-3 sentences) explaining the novelty assessment. Reference " +
        "the candidates by name where useful. Do not invent additional references.",
      user: JSON.stringify({ hypothesis, domain, novelty, candidates: hits }),
      toolName: "submit_qc",
      toolDescription: "Submit the QC rationale text.",
      inputSchema: QC_TOOL_SCHEMA,
      maxTokens: 400,
    });
    // Defense in depth: novelty + references come from the local corpus, not the LLM.
    const grounded: QCResult = {
      novelty,
      rationale: result.rationale,
      references: hits,
      searchedQueries: [hypothesis, domain ?? ""].filter(Boolean),
    };
    return QCResult.parse(grounded);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[QC] LLM rationale generation failed:", errorMessage);
    return QCResult.parse({
      novelty,
      rationale: "",
      references: hits,
    });
  }
}
