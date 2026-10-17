const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SearchRequest {
  query: string;
  yearFrom?: number;
  yearTo?: number;
  publicationType?: string;
  openAccessOnly?: boolean;
  page?: number;
  perPage?: number;
  department?: string;
  interests?: string[];
}

interface NormalizedPaper {
  title: string;
  abstract: string | null;
  doi: string | null;
  source_id: string;
  source_provider: string;
  publication_year: number | null;
  publication_type: string | null;
  is_open_access: boolean | null;
  open_access_url: string | null;
  venue: string | null;
  citation_count: number | null;
  concepts: string[];
  authors: { name: string; orcid: string | null; affiliation: string | null; position: number }[];
}

interface SearchResult {
  paper: NormalizedPaper;
  relevanceScore: number;
  relevanceExplanation: string;
  source: string;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function keywordScore(query: string, paper: NormalizedPaper, department?: string, interests?: string[]): number {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return 0;

  const titleTokens = new Set(tokenize(paper.title));
  const abstractTokens = paper.abstract ? new Set(tokenize(paper.abstract)) : new Set();
  const conceptTokens = new Set(paper.concepts.flatMap(tokenize));

  const titleMatches = [...queryTokens].filter((t) => titleTokens.has(t)).length;
  const abstractMatches = paper.abstract ? [...queryTokens].filter((t) => abstractTokens.has(t)).length : 0;
  const conceptMatches = [...queryTokens].filter((t) => conceptTokens.has(t)).length;

  let weightSum = 0;
  let score = 0;

  if (paper.title) {
    score += (titleMatches / queryTokens.size) * 0.5;
    weightSum += 0.5;
  }
  if (paper.abstract) {
    score += (abstractMatches / queryTokens.size) * 0.3;
    weightSum += 0.3;
  }
  if (paper.concepts.length > 0) {
    score += (conceptMatches / queryTokens.size) * 0.2;
    weightSum += 0.2;
  }

  if (weightSum > 0) score = score / weightSum;

  if (interests && interests.length > 0) {
    const interestTokens = new Set(interests.flatMap((i) => tokenize(i)));
    const interestMatches = [...interestTokens].filter((t) => conceptTokens.has(t) || titleTokens.has(t)).length;
    if (interestMatches > 0) {
      score += (interestMatches / interestTokens.size) * 0.15;
    }
  }

  return Math.min(score, 1.0);
}

function buildExplanation(query: string, paper: NormalizedPaper, score: number): string {
  const queryTokens = tokenize(query);
  const titleTokens = new Set(tokenize(paper.title));
  const matchedInTitle = queryTokens.filter((t) => titleTokens.has(t));
  const parts: string[] = [];

  if (matchedInTitle.length > 0) {
    parts.push("Title matches: " + matchedInTitle.join(", "));
  }
  if (paper.concepts.length > 0) {
    parts.push("Related concepts: " + paper.concepts.slice(0, 3).join(", "));
  }
  if (paper.citation_count !== null && paper.citation_count > 50) {
    parts.push("Well-cited (" + paper.citation_count + " citations)");
  }
  if (parts.length === 0) {
    parts.push("Keyword-based relevance match");
  }
  parts.push("Relevance: " + (score * 100).toFixed(0) + "%");
  return parts.join(" · ");
}

// Fetch with timeout + retry — critical for reliability with flaky APIs
async function fetchWithRetry(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
  maxRetries: number,
  retryDelayMs: number
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeoutId);

      // Retry on 429 (rate limit) and 503 (service unavailable)
      if ((response.status === 429 || response.status === 503) && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, retryDelayMs * (attempt + 1)));
        continue;
      }

      return response;
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, retryDelayMs * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error("Fetch failed after retries");
}

// Reconstruct OpenAlex abstract from inverted index
function reconstructOpenAlexAbstract(
  invertedIndex: Record<string, number[]> | undefined
): string | null {
  if (!invertedIndex || Object.keys(invertedIndex).length === 0) return null;

  const wordPositions: { word: string; position: number }[] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      wordPositions.push({ word, position: pos });
    }
  }

  wordPositions.sort((a, b) => a.position - b.position);
  const abstract = wordPositions.map((wp) => wp.word).join(" ");
  return abstract.length > 10 ? abstract : null;
}

// ── OpenAlex ──────────────────────────────────────────────────────────────────

async function searchOpenAlex(req: SearchRequest): Promise<{ results: SearchResult[]; error?: string }> {
  const perPage = Math.min(req.perPage || 25, 50);
  const page = req.page || 1;

  // Use mailto in URL params to get into OpenAlex's polite pool for higher rate limits
  const params = new URLSearchParams({
    search: req.query,
    per_page: String(perPage),
    page: String(page),
    mailto: "researchflow@example.com",
  });

  if (req.yearFrom) params.set("from_publication_date", req.yearFrom + "-01-01");
  if (req.yearTo) params.set("to_publication_date", req.yearTo + "-12-31");
  if (req.openAccessOnly) params.set("is_oa", "true");
  if (req.publicationType) {
    const typeMap: Record<string, string> = {
      article: "article",
      journal_article: "article",
      "proceedings-article": "proceedings-article",
      conference_paper: "proceedings-article",
      review: "review",
      "book-chapter": "book-chapter",
      preprint: "preprint",
    };
    const mapped = typeMap[req.publicationType] || req.publicationType;
    if (mapped) params.set("type", mapped);
  }

  const url = "https://api.openalex.org/works?" + params.toString();

  try {
    const response = await fetchWithRetry(
      url,
      {
        "User-Agent": "ResearchFlow/1.0 (mailto:researchflow@example.com)",
        "Accept": "application/json",
      },
      12000,
      2,
      1000
    );

    if (!response.ok) {
      return { results: [], error: "OpenAlex API returned " + response.status };
    }

    const data = await response.json();
    const works = data.results || [];

    const results: SearchResult[] = works.map((work: any) => {
      const paper: NormalizedPaper = {
        title: work.title || work.display_name || "Untitled",
        abstract: reconstructOpenAlexAbstract(work.abstract_inverted_index),
        doi: work.doi ? work.doi.replace("https://doi.org/", "") : null,
        source_id: work.id ? String(work.id).replace("https://openalex.org/", "") : "",
        source_provider: "openalex",
        publication_year: work.publication_year || null,
        publication_type: work.type || null,
        is_open_access: work.open_access?.is_oa ?? null,
        open_access_url: work.open_access?.oa_url || work.primary_location?.pdf_url || null,
        venue: work.primary_location?.source?.display_name || null,
        citation_count: work.cited_by_count ?? null,
        concepts: (work.concepts || []).slice(0, 10).map((c: any) => c.display_name),
        authors: (work.authorships || []).map((a: any, i: number) => ({
          name: a.author?.display_name || "Unknown",
          orcid: a.author?.orcid ? String(a.author.orcid).replace("https://orcid.org/", "") : null,
          affiliation: a.institutions?.[0]?.display_name || null,
          position: i,
        })),
      };

      const score = keywordScore(req.query, paper, req.department, req.interests);
      const explanation = buildExplanation(req.query, paper, score);
      return { paper, relevanceScore: score, relevanceExplanation: explanation, source: "openalex" };
    });

    return { results };
  } catch (err: any) {
    const msg =
      err?.name === "AbortError"
        ? "OpenAlex timed out"
        : "OpenAlex fetch failed: " + (err?.message || String(err));
    return { results: [], error: msg };
  }
}

// ── arXiv ─────────────────────────────────────────────────────────────────────

async function searchArXiv(req: SearchRequest): Promise<{ results: SearchResult[]; error?: string }> {
  const perPage = Math.min(req.perPage || 25, 50);
  const start = ((req.page || 1) - 1) * perPage;

  const cleanQuery = req.query.replace(/[&|!]/g, " ").trim();
  const searchQuery = "all:" + cleanQuery;
  const params = new URLSearchParams({
    search_query: searchQuery,
    start: String(start),
    max_results: String(perPage),
    sortBy: "relevance",
    sortOrder: "descending",
  });

  const url = "https://export.arxiv.org/api/query?" + params.toString();

  try {
    const response = await fetchWithRetry(
      url,
      {
        "User-Agent": "ResearchFlow/1.0 (mailto:researchflow@example.com)",
      },
      15000,
      3,
      2000
    );

    if (!response.ok) {
      return { results: [], error: "arXiv API returned " + response.status };
    }

    const xmlText = await response.text();

    const entries: string[] = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;
    while ((match = entryRegex.exec(xmlText)) !== null) {
      entries.push(match[1]);
    }

    if (entries.length === 0) {
      return { results: [] };
    }

    const results: SearchResult[] = entries.map((entry) => {
      const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
      const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "Untitled";

      const summaryMatch = entry.match(/<summary>([\s\S]*?)<\/summary>/);
      const abstract = summaryMatch ? summaryMatch[1].replace(/\s+/g, " ").trim() : null;

      const idMatch = entry.match(/<id>([\s\S]*?)<\/id>/);
      const rawId = idMatch ? idMatch[1].trim() : "";
      const arxivId = rawId
        .replace("http://arxiv.org/abs/", "")
        .replace("https://arxiv.org/abs/", "");

      const publishedMatch = entry.match(/<published>([\s\S]*?)<\/published>/);
      const publishedYear = publishedMatch ? parseInt(publishedMatch[1].slice(0, 4)) : null;

      const authors: { name: string; orcid: string | null; affiliation: string | null; position: number }[] = [];
      const authorRegex = /<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g;
      let authorMatch;
      let authorIdx = 0;
      while ((authorMatch = authorRegex.exec(entry)) !== null) {
        authors.push({
          name: authorMatch[1].trim(),
          orcid: null,
          affiliation: null,
          position: authorIdx++,
        });
      }

      const doiMatch = entry.match(/<arxiv:doi[^>]*>([\s\S]*?)<\/arxiv:doi>/);
      const doi = doiMatch ? doiMatch[1].trim() : null;

      const categoryMatch = entry.match(/<arxiv:primary_category[^>]*term="([^"]*)"/);
      const concepts: string[] = [];
      if (categoryMatch) {
        const cat = categoryMatch[1];
        const categoryLabels: Record<string, string> = {
          "cs.AI": "Artificial Intelligence",
          "cs.CL": "Computation and Language",
          "cs.CV": "Computer Vision",
          "cs.LG": "Machine Learning",
          "cs.NE": "Neural Networks",
          "cs.RO": "Robotics",
          "cs.SE": "Software Engineering",
          "cs.DB": "Databases",
          "cs.CR": "Cryptography and Security",
          "cs.NI": "Networking",
          "cs.IR": "Information Retrieval",
          "cs.MM": "Multimedia",
          "cs.HC": "Human-Computer Interaction",
          "cs.SY": "Systems and Control",
          "stat.ML": "Machine Learning",
          "stat.ME": "Methodology",
          "stat.TH": "Statistics Theory",
          "math.ST": "Statistics",
          "math.PR": "Probability",
          "q-bio": "Quantitative Biology",
          "q-fin": "Quantitative Finance",
          "eess.SP": "Signal Processing",
          "eess.IV": "Image and Video Processing",
          "physics": "Physics",
          "cond-mat": "Condensed Matter",
          "astro-ph": "Astrophysics",
        };
        if (categoryLabels[cat]) concepts.push(categoryLabels[cat]);
        else concepts.push(cat);
      }

      const allCategoryRegex = /<arxiv:category[^>]*term="([^"]*)"/g;
      let catMatch;
      while ((catMatch = allCategoryRegex.exec(entry)) !== null) {
        if (catMatch[1] !== categoryMatch?.[1]) {
          concepts.push(catMatch[1]);
        }
      }

      const linkMatch = entry.match(/<link[^>]*title="pdf"[^>]*href="([^"]*)"/);
      const pdfUrl = linkMatch
        ? linkMatch[1].replace("http://", "https://")
        : "https://arxiv.org/pdf/" + arxivId;

      const paper: NormalizedPaper = {
        title,
        abstract,
        doi,
        source_id: arxivId,
        source_provider: "arxiv",
        publication_year: publishedYear,
        publication_type: "preprint",
        is_open_access: true,
        open_access_url: pdfUrl,
        venue: "arXiv",
        citation_count: null,
        concepts: concepts.slice(0, 10),
        authors,
      };

      const score = keywordScore(req.query, paper, req.department, req.interests);
      const explanation = buildExplanation(req.query, paper, score);
      return { paper, relevanceScore: score, relevanceExplanation: explanation, source: "arxiv" };
    });

    let filtered = results;
    if (req.yearFrom)
      filtered = filtered.filter(
        (r) => r.paper.publication_year === null || r.paper.publication_year >= req.yearFrom!
      );
    if (req.yearTo)
      filtered = filtered.filter(
        (r) => r.paper.publication_year === null || r.paper.publication_year <= req.yearTo!
      );

    return { results: filtered };
  } catch (err: any) {
    const msg =
      err?.name === "AbortError"
        ? "arXiv timed out"
        : "arXiv fetch failed: " + (err?.message || String(err));
    return { results: [], error: msg };
  }
}

// ── Crossref ──────────────────────────────────────────────────────────────────

async function searchCrossref(req: SearchRequest): Promise<{ results: SearchResult[]; error?: string }> {
  const perPage = Math.min(req.perPage || 25, 50);
  const page = req.page || 1;

  const params = new URLSearchParams({
    query: req.query,
    rows: String(perPage),
    offset: String((page - 1) * perPage),
    select:
      "DOI,title,abstract,container-title,published,published-online,created,author,type,is-referenced-by-count,license,subject,link,URL",
  });

  const filters: string[] = [];
  if (req.yearFrom) filters.push("from-pub-date:" + req.yearFrom + "-01-01");
  if (req.yearTo) filters.push("until-pub-date:" + req.yearTo + "-12-31");
  if (req.publicationType) {
    const typeMap: Record<string, string> = {
      article: "journal-article",
      journal_article: "journal-article",
      "proceedings-article": "proceedings-article",
      conference_paper: "proceedings-article",
      review: "journal-article",
      "book-chapter": "book-chapter",
      preprint: "posted-content",
    };
    const crType = typeMap[req.publicationType] || req.publicationType;
    if (crType) filters.push("type:" + crType);
  }
  if (filters.length > 0) params.set("filter", filters.join(","));

  const url = "https://api.crossref.org/works?" + params.toString();

  try {
    const response = await fetchWithRetry(
      url,
      {
        "User-Agent": "ResearchFlow/1.0 (mailto:researchflow@example.com)",
        "Accept": "application/json",
      },
      12000,
      2,
      1000
    );

    if (!response.ok) {
      return { results: [], error: "Crossref API returned " + response.status };
    }

    const data = await response.json();
    const items = data.message?.items || [];

    const results: SearchResult[] = items.map((item: any) => {
      const title = item.title && item.title.length > 0 ? item.title[0] : "Untitled";
      let abstract: string | null = item.abstract || null;
      if (abstract) {
        abstract = abstract
          .replace(/<jats:[^>]*>/g, "")
          .replace(/<\/jats:[^>]*>/g, "")
          .replace(/<[^>]+>/g, "")
          .trim();
      }

      const doi = item.DOI || null;
      const containerTitle =
        item["container-title"] && item["container-title"].length > 0
          ? item["container-title"][0]
          : null;

      let pubYear: number | null = null;
      const dateParts =
        item.published?.["date-parts"]?.[0] ||
        item["published-online"]?.["date-parts"]?.[0] ||
        item.created?.["date-parts"]?.[0];
      if (dateParts && dateParts[0]) {
        pubYear = dateParts[0];
      }

      const authors = (item.author || []).map((a: any, i: number) => ({
        name: (a.given ? a.given + " " : "") + (a.family || "Unknown"),
        orcid: a.ORCID ? String(a.ORCID).replace("https://orcid.org/", "") : null,
        affiliation: a.affiliation?.[0]?.name || null,
        position: i,
      }));

      const subjects = item.subject || [];
      const concepts = subjects.slice(0, 10);

      const isOpenAccess =
        item.license?.some(
          (l: any) =>
            l.URL?.includes("creativecommons.org") ||
            l.URL?.includes("openaccess") ||
            l["content-version"] === "vor"
        ) ?? false;

      let openAccessUrl: string | null = null;
      if (item.link?.length > 0) {
        const fullTextLink = item.link.find(
          (l: any) => l["content-type"] === "application/pdf" || l["content-type"] === "text/html"
        );
        if (fullTextLink) {
          openAccessUrl = fullTextLink.URL?.replace("http://", "https://") || null;
        }
      }

      const paper: NormalizedPaper = {
        title,
        abstract,
        doi,
        source_id: doi || item.URL || "",
        source_provider: "crossref",
        publication_year: pubYear,
        publication_type: item.type || null,
        is_open_access: isOpenAccess,
        open_access_url: openAccessUrl,
        venue: containerTitle,
        citation_count: item["is-referenced-by-count"] ?? null,
        concepts,
        authors,
      };

      const score = keywordScore(req.query, paper, req.department, req.interests);
      const explanation = buildExplanation(req.query, paper, score);
      return { paper, relevanceScore: score, relevanceExplanation: explanation, source: "crossref" };
    });

    let filtered = results;
    if (req.openAccessOnly) filtered = filtered.filter((r) => r.paper.is_open_access === true);

    return { results: filtered };
  } catch (err: any) {
    const msg =
      err?.name === "AbortError"
        ? "Crossref timed out"
        : "Crossref fetch failed: " + (err?.message || String(err));
    return { results: [], error: msg };
  }
}

// ── Local Database ────────────────────────────────────────────────────────────

async function searchLocalDatabase(
  req: SearchRequest,
  supabaseUrl: string,
  serviceKey: string
): Promise<{ results: SearchResult[]; error?: string }> {
  const perPage = Math.min(req.perPage || 25, 100);

  const searchTerms = req.query.trim().split(/\s+/).filter((w) => w.length > 2);
  if (searchTerms.length === 0) return { results: [] };

  // Use full-text-style ilike matching on title and abstract
  const orConditions = searchTerms
    .map((term) => "title.ilike.*" + term + "*,abstract.ilike.*" + term + "*")
    .join(",");

  const params = new URLSearchParams({
    select:
      "id,title,abstract,doi,source_id,source_provider,publication_year,publication_type,is_open_access,open_access_url,venue,citation_count,concepts,paper_authors(name,orcid,affiliation,position)",
    or: orConditions,
    limit: String(perPage * 2),
    order: "citation_count.desc.nullslast",
  });

  if (req.yearFrom) params.set("publication_year.gte", String(req.yearFrom));
  if (req.yearTo) params.set("publication_year.lte", String(req.yearTo));
  if (req.openAccessOnly) params.set("is_open_access.eq", "true");
  if (req.publicationType) {
    const localType = req.publicationType === "journal_article" ? "article" : req.publicationType;
    params.set("publication_type.eq", localType);
  }

  const url = supabaseUrl + "/rest/v1/papers?" + params.toString();

  try {
    const response = await fetchWithRetry(
      url,
      {
        apikey: serviceKey,
        Authorization: "Bearer " + serviceKey,
        "Content-Type": "application/json",
      },
      10000,
      1,
      500
    );

    if (!response.ok) {
      return { results: [], error: "Local DB returned " + response.status };
    }

    const rows = await response.json();

    let results: SearchResult[] = (rows || []).map((row: any) => {
      const paper: NormalizedPaper = {
        title: row.title || "Untitled",
        abstract: row.abstract || null,
        doi: row.doi || null,
        source_id: row.source_id || String(row.id),
        source_provider: row.source_provider || "local",
        publication_year: row.publication_year || null,
        publication_type: row.publication_type || null,
        is_open_access: row.is_open_access ?? null,
        open_access_url: row.open_access_url || null,
        venue: row.venue || null,
        citation_count: row.citation_count ?? null,
        concepts: row.concepts || [],
        authors: (row.paper_authors || []).map((a: any, i: number) => ({
          name: a.name || "Unknown",
          orcid: a.orcid || null,
          affiliation: a.affiliation || null,
          position: a.position ?? i,
        })),
      };

      const score = keywordScore(req.query, paper, req.department, req.interests);
      const explanation = buildExplanation(req.query, paper, score);
      return { paper, relevanceScore: score, relevanceExplanation: explanation, source: "local" };
    });

    results = results.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, perPage);

    return { results };
  } catch (err: any) {
    const msg =
      err?.name === "AbortError"
        ? "Local DB timed out"
        : "Local DB search failed: " + (err?.message || String(err));
    return { results: [], error: msg };
  }
}

// ── Deduplication ─────────────────────────────────────────────────────────────

function deduplicate(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const deduped: SearchResult[] = [];

  for (const result of results) {
    const doiKey = result.paper.doi
      ? result.paper.doi.toLowerCase().trim()
      : null;
    const titleKey = result.paper.title.toLowerCase().replace(/\s+/g, " ").trim();

    if (doiKey && seen.has("doi:" + doiKey)) continue;
    if (seen.has("title:" + titleKey)) continue;

    if (doiKey) seen.add("doi:" + doiKey);
    seen.add("title:" + titleKey);
    deduped.push(result);
  }

  return deduped;
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: SearchRequest = await req.json();
    const { query } = body;

    if (!query || query.trim().length < 2) {
      return new Response(
        JSON.stringify({ error: "Query must be at least 2 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    // Use Promise.allSettled so one source failing never affects the others
    const [localSettled, openAlexSettled, arxivSettled, crossrefSettled] = await Promise.allSettled([
      searchLocalDatabase(body, supabaseUrl, serviceKey),
      searchOpenAlex(body),
      searchArXiv(body),
      searchCrossref(body),
    ]);

    // Extract results from settled promises
    const localResult = localSettled.status === "fulfilled" ? localSettled.value : { results: [], error: "Local search crashed" };
    const openAlexResult = openAlexSettled.status === "fulfilled" ? openAlexSettled.value : { results: [], error: "OpenAlex search crashed" };
    const arxivResult = arxivSettled.status === "fulfilled" ? arxivSettled.value : { results: [], error: "arXiv search crashed" };
    const crossrefResult = crossrefSettled.status === "fulfilled" ? crossrefSettled.value : { results: [], error: "Crossref search crashed" };

    // Combine — local first, then external sources
    let allResults = [
      ...localResult.results,
      ...openAlexResult.results,
      ...arxivResult.results,
      ...crossrefResult.results,
    ];

    allResults = deduplicate(allResults);
    allResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

    const perPage = body.perPage || 25;
    allResults = allResults.slice(0, perPage);

    const sources = [
      { name: "local", success: !localResult.error, count: localResult.results.length, error: localResult.error },
      { name: "openalex", success: !openAlexResult.error, count: openAlexResult.results.length, error: openAlexResult.error },
      { name: "arxiv", success: !arxivResult.error, count: arxivResult.results.length, error: arxivResult.error },
      { name: "crossref", success: !crossrefResult.error, count: crossrefResult.results.length, error: crossrefResult.error },
    ];

    return new Response(
      JSON.stringify({
        results: allResults,
        total: allResults.length,
        page: body.page || 1,
        perPage,
        sources,
        fallbackMode: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
