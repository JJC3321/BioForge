import type { Reference } from "./schema";

const OPENALEX_BASE = "https://api.openalex.org";

export interface LiteratureHit extends Reference {
  similarity: number;
}

interface OpenAlexAuthor {
  author: {
    display_name: string;
  };
}

interface OpenAlexSource {
  display_name?: string;
}

interface OpenAlexPrimaryLocation {
  source?: OpenAlexSource;
}

interface OpenAlexWork {
  id: string;
  display_name: string;
  authorships: OpenAlexAuthor[];
  publication_year?: number;
  primary_location?: OpenAlexPrimaryLocation;
  doi?: string;
  abstract_inverted_index: Record<string, number[]> | null;
  relevance_score?: number;
}

interface OpenAlexResult {
  meta: {
    count: number;
    db_response_time_ms: number;
    page: number;
    per_page: number;
  };
  results: OpenAlexWork[];
}

/**
 * Reconstruct abstract from OpenAlex inverted index format.
 * OpenAlex stores abstracts as word -> positions mappings for compression.
 */
function reconstructAbstract(invertedIndex: Record<string, number[]> | null): string | undefined {
  if (!invertedIndex) return undefined;

  // Build position -> word mapping
  const positions: Map<number, string> = new Map();
  let maxPosition = 0;

  for (const [word, wordPositions] of Object.entries(invertedIndex)) {
    for (const pos of wordPositions) {
      positions.set(pos, word);
      if (pos > maxPosition) maxPosition = pos;
    }
  }

  // Reconstruct sentence by iterating positions
  const words: string[] = [];
  for (let i = 0; i <= maxPosition; i++) {
    words.push(positions.get(i) || "");
  }

  const abstract = words.join(" ").trim();
  if (!abstract) return undefined;

  // Truncate to reasonable snippet length
  return abstract.length > 200 ? abstract.substring(0, 200) + "..." : abstract;
}

/**
 * Format author names from OpenAlex authorships.
 * Truncate long author lists to 100 chars.
 */
function formatAuthors(authorships: OpenAlexAuthor[]): string | undefined {
  if (!authorships || authorships.length === 0) return undefined;

  const authors = authorships.map((a) => a.author.display_name).join(", ");
  return authors.length > 100 ? authors.substring(0, 100) : authors;
}

/**
 * Extract DOI from OpenAlex work.
 * OpenAlex returns full URL, we want just the DOI identifier.
 */
function extractDoi(doiUrl: string | undefined): string | undefined {
  if (!doiUrl) return undefined;
  // Remove https://doi.org/ prefix if present
  return doiUrl.replace(/^https?:\/\/doi\.org\//, "");
}

/**
 * Search OpenAlex for papers matching the query.
 * Returns up to maxResults papers with metadata.
 *
 * OpenAlex API docs: https://docs.openalex.org/api-entities/works
 */
async function searchOpenAlex(
  query: string,
  maxResults = 3,
): Promise<LiteratureHit[]> {
  try {
    const url = new URL(`${OPENALEX_BASE}/works`);
    url.searchParams.set("search", query);
    url.searchParams.set("per-page", maxResults.toString());

    // Add API key as query parameter if available for higher rate limits
    if (process.env.OPENALEX_API_KEY) {
      url.searchParams.set("api_key", process.env.OPENALEX_API_KEY);
    }

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`OpenAlex search failed: ${res.status}`);

    const data = (await res.json()) as OpenAlexResult;
    const works = data.results || [];

    if (works.length === 0) return [];

    return works.map((work, index) => {
      // Use relevance_score if available, otherwise use position-based score
      const similarity = work.relevance_score
        ? Math.min(work.relevance_score, 1)
        : 1 - index * 0.1;

      return {
        title: work.display_name || "Untitled",
        authors: formatAuthors(work.authorships),
        year: work.publication_year,
        venue: work.primary_location?.source?.display_name,
        doi: extractDoi(work.doi),
        snippet: reconstructAbstract(work.abstract_inverted_index),
        similarity,
      };
    });
  } catch (error) {
    console.error("OpenAlex search error:", error);
    return [];
  }
}

/**
 * Search for literature using OpenAlex API.
 * Returns papers matching the query with metadata.
 *
 * Note: Previously used PubMed + Crossref. Now uses OpenAlex exclusively.
 */
export async function searchJournalAPI(
  query: string,
  maxResults = 3,
): Promise<LiteratureHit[]> {
  return await searchOpenAlex(query, maxResults);
}
