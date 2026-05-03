import { randomUUID } from "node:crypto";
import { mutateDb, readDb } from "./db";
import { ExperimentPlan, FeedbackPayload, QCResult } from "./schema";
import { jaccard, tokenize } from "./similarity";

export interface StoredPlan {
  id: string;
  hypothesis: string;
  domain?: string;
  plan: ExperimentPlan;
  qc: QCResult;
  createdAt: number;
}

export interface StoredFeedback {
  id: string;
  planId: string;
  hypothesis: string;
  domain?: string;
  tags: string[];
  ratings: { section: string; rating: number; comment?: string }[];
  corrections: { section: string; corrected: string; reason?: string }[];
  freeformNotes?: string;
  createdAt: number;
}

export function savePlan(input: {
  hypothesis: string;
  domain?: string;
  plan: ExperimentPlan;
  qc: QCResult;
}): StoredPlan {
  const id = randomUUID();
  const createdAt = Date.now();
  const record: StoredPlan = { id, createdAt, ...input };
  mutateDb((db) => {
    db.plans[id] = record;
  });
  return record;
}

export function saveFeedback(payload: FeedbackPayload): StoredFeedback {
  const id = randomUUID();
  const createdAt = Date.now();
  const record: StoredFeedback = {
    id,
    planId: payload.planId,
    hypothesis: payload.hypothesis,
    domain: payload.domain,
    tags: payload.tags,
    ratings: payload.ratings,
    corrections: payload.corrections,
    freeformNotes: payload.freeformNotes,
    createdAt,
  };
  mutateDb((db) => {
    db.feedback[id] = record;
  });
  return record;
}

/**
 * Find prior feedback similar to the current hypothesis. Used as few-shot guidance.
 */
export function findSimilarFeedback(
  hypothesis: string,
  domain: string | undefined,
  limit = 3,
): StoredFeedback[] {
  const db = readDb();
  const all = Object.values(db.feedback) as StoredFeedback[];
  const q = tokenize(`${hypothesis} ${domain ?? ""}`);
  return all
    .map((fb) => ({
      fb,
      score: jaccard(q, tokenize(`${fb.hypothesis} ${fb.domain ?? ""}`)),
    }))
    .filter((x) => x.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.fb);
}

export function getPlan(id: string): StoredPlan | null {
  const db = readDb();
  return (db.plans[id] as StoredPlan | undefined) ?? null;
}
