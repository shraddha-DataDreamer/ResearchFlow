'use client';

import { supabase } from '@/lib/supabase/client';
import type { Paper } from '@/types';

export interface ConceptFrequency {
  concept: string;
  count: number;
  papers: string[];
}

export interface GapInsight {
  type: 'coverage' | 'temporal' | 'methodology' | 'dataset' | 'limitation' | 'concept_gap';
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
}

export interface ResearchGapReport {
  totalPapers: number;
  concepts: ConceptFrequency[];
  yearRange: { min: number | null; max: number | null };
  topVenues: { venue: string; count: number }[];
  insights: GapInsight[];
  underrepresentedConcepts: string[];
  commonLimitations: string[];
  datasetDiversity: { dataset: string; count: number }[];
}

export async function getSavedPapersForGapAnalysis(): Promise<Paper[]> {
  const { data } = await supabase
    .from('saved_papers')
    .select('paper:papers(*, paper_authors(*))')
    .order('created_at', { ascending: false });
  return (data || []).map((s: any) => s.paper as Paper);
}

export function analyzeResearchGaps(papers: Paper[]): ResearchGapReport {
  if (papers.length === 0) {
    return {
      totalPapers: 0,
      concepts: [],
      yearRange: { min: null, max: null },
      topVenues: [],
      insights: [],
      underrepresentedConcepts: [],
      commonLimitations: [],
      datasetDiversity: [],
    };
  }

  // Concept frequency analysis
  const conceptMap = new Map<string, { count: number; papers: string[] }>();
  for (const paper of papers) {
    if (!paper.concepts) continue;
    for (const concept of paper.concepts) {
      const existing = conceptMap.get(concept);
      if (existing) {
        existing.count++;
        existing.papers.push(paper.id);
      } else {
        conceptMap.set(concept, { count: 1, papers: [paper.id] });
      }
    }
  }

  const concepts: ConceptFrequency[] = Array.from(conceptMap.entries())
    .map(([concept, data]) => ({ concept, count: data.count, papers: data.papers }))
    .sort((a, b) => b.count - a.count);

  // Year range
  const years = papers.map((p) => p.publication_year).filter((y): y is number => y !== null);
  const yearRange = {
    min: years.length > 0 ? Math.min(...years) : null,
    max: years.length > 0 ? Math.max(...years) : null,
  };

  // Venue distribution
  const venueMap = new Map<string, number>();
  for (const paper of papers) {
    if (paper.venue) {
      venueMap.set(paper.venue, (venueMap.get(paper.venue) || 0) + 1);
    }
  }
  const topVenues = Array.from(venueMap.entries())
    .map(([venue, count]) => ({ venue, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Generate insights
  const insights: GapInsight[] = [];

  // 1. Temporal gap — old papers with no recent follow-up
  if (yearRange.min && yearRange.max) {
    const minYear = yearRange.min;
    const maxYear = yearRange.max;
    const span = maxYear - minYear;
    if (span > 8) {
      insights.push({
        type: 'temporal',
        title: 'Long publication time span detected',
        description: `Your saved papers span ${span} years (${minYear}–${maxYear}). Recent years may have newer approaches that haven't been explored in your collection. Consider searching for papers from ${maxYear - 2} onward to check for recent advances.`,
        severity: 'medium',
      });
    }
    const recentCount = years.filter((y) => y >= maxYear - 2).length;
    if (recentCount < papers.length * 0.2 && papers.length > 5) {
      insights.push({
        type: 'temporal',
        title: 'Few recent papers in your collection',
        description: `Only ${recentCount} of ${papers.length} papers were published in the last 2 years. Your research area may be evolving — search for recent publications to stay current.`,
        severity: 'high',
      });
    }
  }

  // 2. Concept coverage gaps — concepts that appear in few papers
  const totalConcepts = concepts.length;
  if (totalConcepts > 3) {
    const underrepresented = concepts.filter((c) => c.count === 1).map((c) => c.concept);
    if (underrepresented.length > totalConcepts * 0.5) {
      insights.push({
        type: 'concept_gap',
        title: 'Many concepts appear in only one paper',
        description: `${underrepresented.length} of ${totalConcepts} unique concepts are covered by a single paper. These areas may be underexplored in your collection: ${underrepresented.slice(0, 5).join(', ')}${underrepresented.length > 5 ? '...' : ''}. Searching for more papers on these topics could reveal whether they're truly niche or just missing from your library.`,
        severity: 'medium',
      });
    }
  }

  // 3. Concept intersection — papers that share few concepts may indicate silos
  if (papers.length >= 4) {
    const topConceptSet = new Set(concepts.slice(0, 5).map((c) => c.concept));
    const papersWithTopConcepts = papers.filter((p) =>
      p.concepts?.some((c) => topConceptSet.has(c))
    );
    if (papersWithTopConcepts.length < papers.length * 0.5) {
      insights.push({
        type: 'coverage',
        title: 'Fragmented concept coverage',
        description: 'Less than half of your papers share the top 5 concepts. Your reading may be spread across distinct sub-fields. Consider focusing on a narrower set of topics or explicitly bridging these areas as a research gap.',
        severity: 'low',
      });
    }
  }

  // 4. Dataset diversity — if most papers use the same venue type, benchmarks may be limited
  const sourceProviders = new Set(papers.map((p) => p.source_provider));
  if (sourceProviders.size === 1 && papers.length > 5) {
    insights.push({
      type: 'dataset',
      title: 'Single source dependency',
      description: `All papers are from ${Array.from(sourceProviders)[0]}. Expanding your search to other databases (Crossref, arXiv) may reveal papers using different datasets and evaluation methods, highlighting transferability gaps.`,
      severity: 'low',
    });
  }

  // 5. Open access gap
  const closedCount = papers.filter((p) => p.is_open_access === false).length;
  if (closedCount > papers.length * 0.6 && papers.length > 3) {
    insights.push({
      type: 'coverage',
      title: 'Most papers are not open access',
      description: `${closedCount} of ${papers.length} papers are behind paywalls. This may limit your ability to do deep analysis. Consider filtering for open access papers or uploading PDFs you have access to for AI analysis.`,
      severity: 'low',
    });
  }

  // 6. Citation imbalance — if a few papers dominate citations
  const citedPapers = papers.filter((p) => p.citation_count !== null && p.citation_count > 0);
  if (citedPapers.length >= 4) {
    const avgCitations = citedPapers.reduce((sum, p) => sum + (p.citation_count || 0), 0) / citedPapers.length;
    const lowCitation = citedPapers.filter((p) => (p.citation_count || 0) < avgCitations * 0.2);
    if (lowCitation.length >= 2) {
      insights.push({
        type: 'coverage',
        title: 'Emerging or undercited papers detected',
        description: `${lowCitation.length} papers have significantly fewer citations than the average (${Math.round(avgCitations)}). These may be emerging work with novel angles — reviewing their contributions could reveal research gaps that haven't been widely noticed yet.`,
        severity: 'medium',
      });
    }
  }

  // 7. Publication type diversity
  const types = new Map<string, number>();
  for (const paper of papers) {
    if (paper.publication_type) {
      types.set(paper.publication_type, (types.get(paper.publication_type) || 0) + 1);
    }
  }
  if (types.size === 1 && papers.length > 5) {
    insights.push({
      type: 'methodology',
      title: 'Single publication type',
      description: `All papers are of type "${Array.from(types.keys())[0]}". Including reviews, conference papers, or other types may reveal different methodological approaches and gaps.`,
      severity: 'low',
    });
  }

  const underrepresentedConcepts = concepts.filter((c) => c.count === 1).map((c) => c.concept).slice(0, 10);

  return {
    totalPapers: papers.length,
    concepts: concepts.slice(0, 20),
    yearRange,
    topVenues,
    insights,
    underrepresentedConcepts,
    commonLimitations: [],
    datasetDiversity: [],
  };
}

export async function saveGapReport(report: ResearchGapReport): Promise<{ error: string | null }> {
  const { error } = await supabase.from('search_history').insert({
    query: 'Research Gap Analysis',
    filters: {
      type: 'gap_analysis',
      totalPapers: report.totalPapers,
      insightCount: report.insights.length,
      underrepresentedConcepts: report.underrepresentedConcepts,
    },
    result_count: report.insights.length,
  });
  return { error: error?.message || null };
}
