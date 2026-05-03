import { describe, it, expect } from "vitest";
import { searchLiterature, searchLiteratureSync, classifyNovelty } from "../src/lib/literature";

describe("literature corpus search (sync)", () => {
  it("ranks NRF2/A549/cisplatin study highly for matching hypothesis", () => {
    const hits = searchLiteratureSync("NRF2 knockdown sensitizes A549 cells to cisplatin");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].title).toMatch(/NRF2/i);
    expect(classifyNovelty(hits)).not.toBe("no_match");
  });

  it("returns no_match for an unrelated hypothesis", () => {
    const hits = searchLiteratureSync("the influence of opera tempo on butterfly migration speeds");
    expect(classifyNovelty(hits)).toBe("no_match");
  });

  it("limits results to <= max", () => {
    const hits = searchLiteratureSync("qpcr gapdh primer", 2);
    expect(hits.length).toBeLessThanOrEqual(2);
  });
});

describe("literature API search (async)", () => {
  it("falls back to local corpus when API disabled", async () => {
    const hits = await searchLiterature("NRF2 knockdown sensitizes A549 cells to cisplatin", 3, false);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].title).toMatch(/NRF2/i);
  });

  it("respects max parameter with API", async () => {
    const hits = await searchLiterature("qpcr gapdh primer", 2, false);
    expect(hits.length).toBeLessThanOrEqual(2);
  });
});

describe("novelty classification", () => {
  it("classifies empty hits as no_match", () => {
    expect(classifyNovelty([])).toBe("no_match");
  });

  it("classifies high similarity (≥40%) as match", () => {
    const hits = [{ title: "Test", similarity: 0.4 }];
    expect(classifyNovelty(hits)).toBe("match");
  });

  it("classifies medium similarity (15-39%) as near_match", () => {
    const hits = [{ title: "Test", similarity: 0.2 }];
    expect(classifyNovelty(hits)).toBe("near_match");
  });

  it("classifies low similarity (<15%) as no_match", () => {
    const hits = [{ title: "Test", similarity: 0.05 }];
    expect(classifyNovelty(hits)).toBe("no_match");
  });
});
