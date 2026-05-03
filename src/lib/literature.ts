import type { Reference } from "./schema";
import { searchJournalAPI, type LiteratureHit as APILiteratureHit } from "./journal-api";
import { jaccard, tokenize } from "./similarity";

// Re-export LiteratureHit from API module for consistency
export type LiteratureHit = APILiteratureHit;

/**
 * Local corpus fallback for offline/demo use.
 * Kept small + deterministic for environments without API access.
 */
const LOCAL_CORPUS: (Reference & { keywords: string[] })[] = [
  {
    title: "NRF2 inhibition sensitizes lung cancer cells to platinum chemotherapy",
    authors: "Singh A. et al.",
    year: 2018,
    venue: "Cancer Research",
    doi: "10.1158/0008-5472.CAN-17-2700",
    snippet:
      "Loss of NRF2 in non-small cell lung cancer lines including A549 increased cisplatin sensitivity in vitro and in xenografts.",
    keywords: ["nrf2", "a549", "cisplatin", "lung", "knockdown", "sensitivity", "chemotherapy"],
  },
  {
    title: "SIRT1 modulates cellular senescence in human fibroblasts",
    authors: "Chen H. et al.",
    year: 2020,
    venue: "Aging Cell",
    doi: "10.1111/acel.13169",
    snippet:
      "SIRT1 overexpression reduced p16INK4a and SA-β-gal staining in primary human dermal fibroblasts.",
    keywords: ["sirt1", "senescence", "fibroblast", "aging", "p16", "overexpression"],
  },
  {
    title: "Random hexamers vs oligo-dT priming for qPCR reproducibility",
    authors: "Bustin S. A.",
    year: 2017,
    venue: "Methods",
    doi: "10.1016/j.ymeth.2017.01.012",
    snippet:
      "Comparative analysis of priming strategies showed reduced CV with random hexamers across housekeeping genes including GAPDH.",
    keywords: ["qpcr", "rt-pcr", "primer", "hexamer", "oligo-dt", "gapdh", "reproducibility"],
  },
  {
    title: "MIQE guidelines for qPCR experiments",
    authors: "Bustin S. A. et al.",
    year: 2009,
    venue: "Clinical Chemistry",
    doi: "10.1373/clinchem.2008.112797",
    snippet: "Minimum information for publication of qPCR experiments — primer design, controls, normalization.",
    keywords: ["qpcr", "miqe", "controls", "primer", "normalization", "guideline"],
  },
  {
    title: "siRNA knockdown of NRF2 in A549 cells: optimization and validation",
    authors: "Lee K. et al.",
    year: 2019,
    venue: "Free Radical Biology and Medicine",
    snippet: "Knockdown protocols achieving >80% NRF2 mRNA reduction with off-target QC.",
    keywords: ["nrf2", "sirna", "knockdown", "a549", "validation"],
  },
  {
    title: "Cisplatin dose response in NSCLC cell lines",
    authors: "Yamada T. et al.",
    year: 2016,
    venue: "Oncology Reports",
    snippet: "IC50 ranges for cisplatin across A549, H460, H1299 with viability assay comparisons.",
    keywords: ["cisplatin", "ic50", "a549", "viability", "nsclc"],
  },
];

function searchLocalCorpus(query: string, max = 3): LiteratureHit[] {
  const q = tokenize(query);
  const scored = LOCAL_CORPUS.map((entry) => {
    const docTokens = new Set([
      ...tokenize(entry.title),
      ...tokenize(entry.snippet ?? ""),
      ...entry.keywords,
    ]);
    const sim = jaccard(q, docTokens);
    const { keywords: _kw, ...ref } = entry;
    return { ...ref, similarity: sim };
  });
  return scored
    .filter((r) => r.similarity > 0.04)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, max);
}

/**
 * Search literature using PubMed API (primary) with Crossref fallback.
 * Falls back to local corpus if APIs fail or return no results.
 */
export async function searchLiterature(
  query: string,
  max = 3,
  useAPI = true,
): Promise<LiteratureHit[]> {
  if (useAPI) {
    try {
      const apiResults = await searchJournalAPI(query, max);
      if (apiResults.length > 0) {
        return apiResults;
      }
      // If API returns no results, fall through to local corpus
      console.log("API returned no results, falling back to local corpus");
    } catch (error) {
      console.error("API search failed, falling back to local corpus:", error);
    }
  }

  return searchLocalCorpus(query, max);
}

/**
 * Synchronous local-only search for environments without API access.
 * @deprecated Use async searchLiterature() for live API results.
 */
export function searchLiteratureSync(query: string, max = 3): LiteratureHit[] {
  return searchLocalCorpus(query, max);
}

export function classifyNovelty(
  hits: LiteratureHit[],
): "match" | "near_match" | "no_match" {
  if (hits.length === 0) return "no_match";
  const top = hits[0].similarity ?? 0;
  // High similarity: strong match found
  if (top >= 0.4) return "match";
  // Medium similarity: related work exists
  if (top >= 0.15) return "near_match";
  // Low similarity: no significant match
  return "no_match";
}
