import path from "node:path";
import fs from "node:fs";

/**
 * Tiny JSON-file store. Reliable, zero-compile, fine for hackathon scale.
 * Replace with Postgres/SQLite/DynamoDB later — `feedback-store.ts` is the only consumer.
 */
export interface DbShape {
  plans: Record<string, unknown>;
  feedback: Record<string, unknown>;
}

function dbPath(): string {
  // Use /tmp on Vercel (read-only filesystem except /tmp)
  if (process.env.VERCEL) {
    return path.join("/tmp", "data", "ai-scientist.json");
  }
  return process.env.DATABASE_PATH || path.join(process.cwd(), "data", "ai-scientist.json");
}

function ensure() {
  const p = dbPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, JSON.stringify({ plans: {}, feedback: {} }, null, 2), "utf8");
  }
}

export function readDb(): DbShape {
  ensure();
  const raw = fs.readFileSync(dbPath(), "utf8");
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { plans: {}, feedback: {} };
    return {
      plans: parsed.plans ?? {},
      feedback: parsed.feedback ?? {},
    };
  } catch {
    return { plans: {}, feedback: {} };
  }
}

export function writeDb(db: DbShape) {
  ensure();
  const tmp = dbPath() + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf8");
  fs.renameSync(tmp, dbPath());
}

export function mutateDb<T>(fn: (db: DbShape) => T): T {
  const db = readDb();
  const result = fn(db);
  writeDb(db);
  return result;
}
