import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ChatRequest {
  paperId: string;
  question: string;
  history?: { question: string; answer: string }[];
}

interface ChatResponse {
  answer: string;
  evidence: { excerpt: string; source: string }[];
  suggestedQuestions: string[];
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function scoreText(questionTokens: Set<string>, text: string): number {
  if (!text || questionTokens.size === 0) return 0;
  const textTokens = tokenize(text);
  let matches = 0;
  questionTokens.forEach((t) => {
    if (textTokens.has(t)) matches++;
  });
  return matches / questionTokens.size;
}

function findBestSentences(text: string, questionTokens: Set<string>, maxCount: number): string[] {
  const sentences = text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .filter((s) => s.trim().length > 20);

  const scored = sentences.map((s) => ({
    sentence: s.trim(),
    score: scoreText(questionTokens, s),
  }));

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCount)
    .map((s) => s.sentence);
}

function generateAnswer(
  question: string,
  paper: any,
  uploadedText: string | null,
  history: { question: string; answer: string }[]
): ChatResponse {
  const questionTokens = tokenize(question);
  const evidence: { excerpt: string; source: string }[] = [];
  const answerParts: string[] = [];

  const lowerQ = question.toLowerCase();

  if (lowerQ.includes("what is the title") || lowerQ.includes("what is this paper") || lowerQ.includes("what is the paper about")) {
    answerParts.push('This paper is titled "' + paper.title + '".');
    if (paper.abstract) {
      answerParts.push(paper.abstract.slice(0, 300) + (paper.abstract.length > 300 ? "..." : ""));
      evidence.push({ excerpt: paper.abstract.slice(0, 200), source: "Abstract" });
    }
  } else if (lowerQ.includes("who wrote") || lowerQ.includes("who are the authors") || lowerQ.includes("author")) {
    const authors = (paper.paper_authors || []).map((a: any) => a.name);
    if (authors.length > 0) {
      answerParts.push("This paper was written by " + authors.join(", ") + ".");
      evidence.push({ excerpt: authors.join(", "), source: "Authors" });
    } else {
      answerParts.push("Author information is not available for this paper.");
    }
  } else if (lowerQ.includes("when") && (lowerQ.includes("publish") || lowerQ.includes("year"))) {
    if (paper.publication_year) {
      answerParts.push("This paper was published in " + paper.publication_year + ".");
      evidence.push({ excerpt: "Publication year: " + paper.publication_year, source: "Metadata" });
    } else {
      answerParts.push("The publication year is not available for this paper.");
    }
  } else if (lowerQ.includes("where") && (lowerQ.includes("publish") || lowerQ.includes("venue") || lowerQ.includes("journal"))) {
    if (paper.venue) {
      answerParts.push("This paper was published in " + paper.venue + ".");
      evidence.push({ excerpt: "Venue: " + paper.venue, source: "Metadata" });
    } else {
      answerParts.push("The publication venue is not available for this paper.");
    }
  } else if (lowerQ.includes("how many") && lowerQ.includes("citation")) {
    if (paper.citation_count !== null) {
      answerParts.push("This paper has been cited " + paper.citation_count + " times.");
      evidence.push({ excerpt: "Citation count: " + paper.citation_count, source: "Metadata" });
    } else {
      answerParts.push("Citation count is not available for this paper.");
    }
  } else if (lowerQ.includes("open access") || lowerQ.includes("freely available") || lowerQ.includes("pdf")) {
    if (paper.is_open_access) {
      answerParts.push("Yes, this paper is open access.");
      if (paper.open_access_url) {
        answerParts.push("You can access it at: " + paper.open_access_url);
        evidence.push({ excerpt: "Open access URL: " + paper.open_access_url, source: "Metadata" });
      }
    } else {
      answerParts.push("This paper is not open access. You may be able to access it through the DOI link.");
    }
  } else if (lowerQ.includes("concept") || lowerQ.includes("topic") || lowerQ.includes("keyword") || lowerQ.includes("research area")) {
    const concepts = paper.concepts || [];
    if (concepts.length > 0) {
      answerParts.push("This paper is associated with the following research concepts: " + concepts.join(", ") + ".");
      evidence.push({ excerpt: concepts.join(", "), source: "Concepts" });
    } else {
      answerParts.push("No research concepts are tagged for this paper.");
    }
  } else if (lowerQ.includes("doi")) {
    if (paper.doi) {
      answerParts.push("The DOI for this paper is " + paper.doi + ". You can access it at https://doi.org/" + paper.doi);
      evidence.push({ excerpt: "DOI: " + paper.doi, source: "Metadata" });
    } else {
      answerParts.push("No DOI is available for this paper.");
    }
  } else if (lowerQ.includes("abstract") || lowerQ.includes("summary") || lowerQ.includes("summarize")) {
    if (paper.abstract) {
      answerParts.push("Here is the abstract of the paper:");
      answerParts.push(paper.abstract);
      evidence.push({ excerpt: paper.abstract.slice(0, 300), source: "Abstract" });
    } else {
      answerParts.push("No abstract is available for this paper.");
    }
  } else if (lowerQ.includes("type") || lowerQ.includes("kind")) {
    if (paper.publication_type) {
      answerParts.push("This is a " + paper.publication_type.replace(/-/g, " ") + ".");
      evidence.push({ excerpt: "Publication type: " + paper.publication_type, source: "Metadata" });
    } else {
      answerParts.push("The publication type is not specified for this paper.");
    }
  } else {
    let bestSource = "";
    let bestScore = 0;

    if (paper.abstract) {
      const score = scoreText(questionTokens, paper.abstract);
      if (score > bestScore) {
        bestScore = score;
        bestSource = "abstract";
      }
    }

    if (uploadedText && uploadedText.length > 50) {
      const score = scoreText(questionTokens, uploadedText.slice(0, 5000));
      if (score > bestScore) {
        bestScore = score;
        bestSource = "uploaded";
      }
    }

    if (bestSource === "abstract" && paper.abstract) {
      const sentences = findBestSentences(paper.abstract, questionTokens, 3);
      if (sentences.length > 0) {
        answerParts.push("Based on the paper's abstract:");
        answerParts.push(sentences.join(" "));
        evidence.push({ excerpt: sentences[0], source: "Abstract" });
      }
    } else if (bestSource === "uploaded" && uploadedText) {
      const sentences = findBestSentences(uploadedText.slice(0, 10000), questionTokens, 3);
      if (sentences.length > 0) {
        answerParts.push("Based on the uploaded document text:");
        answerParts.push(sentences.join(" "));
        evidence.push({ excerpt: sentences[0].slice(0, 300), source: "Document text" });
      }
    }

    const concepts = paper.concepts || [];
    const matchedConcepts = concepts.filter((c: string) => {
      const conceptTokens = tokenize(c);
      let match = false;
      questionTokens.forEach((t) => {
        if (conceptTokens.has(t)) match = true;
      });
      return match;
    });

    if (matchedConcepts.length > 0 && answerParts.length === 0) {
      answerParts.push("This paper relates to: " + matchedConcepts.join(", ") + ".");
      if (paper.abstract) {
        const sentences = findBestSentences(paper.abstract, questionTokens, 2);
        if (sentences.length > 0) {
          answerParts.push(sentences.join(" "));
          evidence.push({ excerpt: sentences[0], source: "Abstract" });
        }
      }
      evidence.push({ excerpt: matchedConcepts.join(", "), source: "Concepts" });
    }

    if (answerParts.length === 0) {
      if (paper.abstract) {
        answerParts.push("Based on the available information:");
        answerParts.push(paper.abstract.slice(0, 400) + (paper.abstract.length > 400 ? "..." : ""));
        evidence.push({ excerpt: paper.abstract.slice(0, 200), source: "Abstract" });
      } else {
        answerParts.push("I don't have enough information from this paper to answer that question. Try asking about the title, authors, publication year, venue, concepts, or abstract.");
      }
    }
  }

  if (history.length > 0 && answerParts.length > 0) {
    const lastExchange = history[history.length - 1];
    if (lowerQ.includes("more") || lowerQ.includes("elaborate") || lowerQ.includes("explain further")) {
      answerParts.unshift('Building on the previous answer about "' + lastExchange.question.substring(0, 50) + '...":');
    }
  }

  const suggestedQuestions = generateSuggestedQuestions(paper, uploadedText);

  return {
    answer: answerParts.join(" "),
    evidence,
    suggestedQuestions,
  };
}

function generateSuggestedQuestions(paper: any, uploadedText: string | null): string[] {
  const suggestions: string[] = [];

  if (paper.abstract) {
    suggestions.push("What is this paper about?");
    suggestions.push("Summarize the abstract");
  }
  if (paper.paper_authors && paper.paper_authors.length > 0) {
    suggestions.push("Who are the authors?");
  }
  if (paper.publication_year) {
    suggestions.push("When was this published?");
  }
  if (paper.venue) {
    suggestions.push("Where was this published?");
  }
  if (paper.concepts && paper.concepts.length > 0) {
    suggestions.push("What research concepts does this cover?");
  }
  if (paper.citation_count !== null && paper.citation_count > 0) {
    suggestions.push("How many citations does this have?");
  }
  if (paper.is_open_access) {
    suggestions.push("Is this open access?");
  }
  if (uploadedText) {
    suggestions.push("What methodology was used?");
    suggestions.push("What are the main findings?");
  }

  return suggestions.slice(0, 5);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: ChatRequest = await req.json();

    if (!body.paperId || !body.question || body.question.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: "Paper ID and question (min 3 chars) are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

    // Fetch paper with authors using service key (shared data, bypass RLS)
    const paperRes = await fetch(
      supabaseUrl + "/rest/v1/papers?id=eq." + body.paperId + "&select=*,paper_authors(name,orcid,affiliation,position)",
      {
        headers: {
          "apikey": serviceKey,
          "Authorization": "Bearer " + serviceKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (!paperRes.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch paper" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const paperData = await paperRes.json();
    if (!paperData || paperData.length === 0) {
      return new Response(
        JSON.stringify({ error: "Paper not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const paper = paperData[0];

    // Try to fetch uploaded document text matching this paper title
    let uploadedText: string | null = null;
    try {
      const authHeader = req.headers.get("Authorization") || "";
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const titleFragment = paper.title.slice(0, 20).replace(/[^a-zA-Z0-9]/g, "");
      const { data: docs } = await userClient
        .from("uploaded_documents")
        .select("extracted_text,extraction_status,filename")
        .eq("extraction_status", "extracted")
        .ilike("filename", "%" + titleFragment + "%")
        .limit(1);

      if (docs && docs.length > 0) {
        uploadedText = docs[0].extracted_text;
      }
    } catch {
      // Non-critical
    }

    const result = generateAnswer(body.question, paper, uploadedText, body.history || []);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
