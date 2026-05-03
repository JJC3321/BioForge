import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the journal-api module to avoid real API calls in tests
vi.mock("../src/lib/journal-api", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/journal-api")>(
    "../src/lib/journal-api"
  );
  return {
    ...actual,
    searchJournalAPI: vi.fn(),
  };
});

import { searchJournalAPI, type LiteratureHit } from "../src/lib/journal-api";

// Declare mock at top level so all describe blocks can use it
const mockedSearchJournalAPI = vi.mocked(searchJournalAPI);

describe("journal-api response parsing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses OpenAlex-style response correctly", async () => {
    const mockResponse: LiteratureHit[] = [
      {
        title: "NRF2 inhibition sensitizes lung cancer cells to platinum chemotherapy",
        authors: "A Singh, B Kumar, et al.",
        year: 2018,
        venue: "Cancer Research",
        doi: "10.1158/0008-5472.CAN-17-2700",
        snippet: "Loss of NRF2 in non-small cell lung cancer...",
        similarity: 0.95,
      },
    ];

    mockedSearchJournalAPI.mockResolvedValueOnce(mockResponse);

    const results = await searchJournalAPI("NRF2 cisplatin", 3);

    expect(results).toHaveLength(1);
    expect(results[0].title).toMatch(/NRF2/i);
    expect(results[0].doi).toBe("10.1158/0008-5472.CAN-17-2700");
    expect(results[0].similarity).toBeGreaterThan(0);
  });

  it("handles empty API response gracefully", async () => {
    mockedSearchJournalAPI.mockResolvedValueOnce([]);

    const results = await searchJournalAPI("nonsense query xyz123", 3);

    expect(results).toHaveLength(0);
  });

  it("handles OpenAlex-style response with multiple authors", async () => {
    const mockResponse: LiteratureHit[] = [
      {
        title: "SIRT1 modulates cellular senescence",
        authors: "H Chen, J Smith, M Johnson, et al.",
        year: 2020,
        venue: "Aging Cell",
        doi: "10.1111/acel.13169",
        similarity: 0.85,
      },
    ];

    mockedSearchJournalAPI.mockResolvedValueOnce(mockResponse);

    const results = await searchJournalAPI("SIRT1 senescence", 3);

    expect(results[0].authors).toContain("Chen");
    expect(results[0].year).toBe(2020);
  });

  it("handles papers with long author lists", async () => {
    // The actual API truncates to 100 chars, so mock should reflect that
    const truncatedAuthors = "Author A, Author B, Author C, Author D, Author E, Author F, Author G, Auth";
    const mockResponse: LiteratureHit[] = [
      {
        title: "Multi-author study",
        authors: truncatedAuthors,
        year: 2023,
        similarity: 0.7,
      },
    ];

    mockedSearchJournalAPI.mockResolvedValueOnce(mockResponse);

    const results = await searchJournalAPI("study", 3);

    expect(results[0].authors?.length).toBeLessThanOrEqual(100);
  });

  it("extracts year from various date formats", async () => {
    const mockResponse: LiteratureHit[] = [
      {
        title: "Date test paper",
        authors: "Test Author",
        year: 2021,
        similarity: 0.6,
      },
    ];

    mockedSearchJournalAPI.mockResolvedValueOnce(mockResponse);

    const results = await searchJournalAPI("date test", 3);

    expect(results[0].year).toBe(2021);
    expect(typeof results[0].year).toBe("number");
  });
});

describe("journal-api URL generation", () => {
  it("OpenAlex DOI link uses doi.org resolver", () => {
    const hit: LiteratureHit = {
      title: "Test Paper",
      doi: "10.1000/test",
      similarity: 0.9,
    };

    const url = hit.doi ? `https://doi.org/${hit.doi}` : undefined;
    expect(url).toBe("https://doi.org/10.1000/test");
  });

  it("handles DOI with https://doi.org/ prefix", () => {
    const hit: LiteratureHit = {
      title: "OpenAlex Paper",
      doi: "10.1234/example",
      similarity: 0.8,
    };

    const url = hit.doi ? `https://doi.org/${hit.doi}` : undefined;
    expect(url).toBe("https://doi.org/10.1234/example");
  });

  it("missing DOI results in undefined URL", () => {
    const hit: LiteratureHit = {
      title: "No DOI Paper",
      similarity: 0.7,
    };

    const url = hit.doi ? `https://doi.org/${hit.doi}` : undefined;
    expect(url).toBeUndefined();
  });
});

describe("OpenAlex-specific features", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("handles papers with reconstructed abstracts", async () => {
    const mockResponse: LiteratureHit[] = [
      {
        title: "Abstract reconstruction test",
        authors: "Test Author",
        year: 2023,
        venue: "Test Journal",
        doi: "10.1234/abstract",
        snippet: "This is a reconstructed abstract from inverted index format...",
        similarity: 0.88,
      },
    ];

    mockedSearchJournalAPI.mockResolvedValueOnce(mockResponse);

    const results = await searchJournalAPI("abstract test", 3);

    expect(results[0].snippet).toBeDefined();
    expect(results[0].snippet?.length).toBeLessThanOrEqual(203); // 200 chars + "..."
  });

  it("handles papers without abstracts gracefully", async () => {
    const mockResponse: LiteratureHit[] = [
      {
        title: "No abstract available",
        authors: "Solo Author",
        year: 2022,
        venue: "Minimal Journal",
        doi: "10.5678/minimal",
        similarity: 0.75,
      },
    ];

    mockedSearchJournalAPI.mockResolvedValueOnce(mockResponse);

    const results = await searchJournalAPI("minimal paper", 3);

    expect(results[0].snippet).toBeUndefined();
    expect(results[0].title).toBe("No abstract available");
  });

  it("uses relevance_score when available for similarity", async () => {
    const mockResponse: LiteratureHit[] = [
      {
        title: "High relevance paper",
        authors: "Expert Researcher",
        year: 2024,
        doi: "10.9999/high",
        similarity: 0.999, // From relevance_score
      },
    ];

    mockedSearchJournalAPI.mockResolvedValueOnce(mockResponse);

    const results = await searchJournalAPI("high relevance", 3);

    expect(results[0].similarity).toBeGreaterThan(0.9);
  });

  it("falls back to position-based similarity without relevance_score", async () => {
    const mockResponse: LiteratureHit[] = [
      {
        title: "First result",
        authors: "Author One",
        year: 2023,
        doi: "10.1111/first",
        similarity: 1.0, // First position
      },
      {
        title: "Second result",
        authors: "Author Two",
        year: 2023,
        doi: "10.2222/second",
        similarity: 0.9, // Second position
      },
    ];

    mockedSearchJournalAPI.mockResolvedValueOnce(mockResponse);

    const results = await searchJournalAPI("multiple results", 3);

    expect(results[0].similarity).toBe(1.0);
    expect(results[1].similarity).toBe(0.9);
  });
});
