'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  GitCompare,
  Search,
  X,
  Download,
  Printer,
  Plus,
  Trash2,
  Lightbulb,
  Loader2,
  FileText,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Paper } from '@/types';

interface ComparisonPaper extends Paper {
  uploaded_analysis?: Record<string, string> | null;
  abstractText?: string | null;
}

const COMPARISON_FIELDS: { key: string; label: string; fromAnalysis?: boolean; analysisKey?: string }[] = [
  { key: 'title', label: 'Title' },
  { key: 'authors', label: 'Authors' },
  { key: 'publication_year', label: 'Year' },
  { key: 'venue', label: 'Venue' },
  { key: 'abstract', label: 'Abstract' },
  { key: 'research_problem', label: 'Research Problem', fromAnalysis: true, analysisKey: 'research_problem' },
  { key: 'objectives', label: 'Objectives', fromAnalysis: true, analysisKey: 'objectives' },
  { key: 'methodology', label: 'Methodology', fromAnalysis: true, analysisKey: 'methodology' },
  { key: 'dataset', label: 'Dataset', fromAnalysis: true, analysisKey: 'dataset' },
  { key: 'algorithms_technologies', label: 'Algorithms / Technologies', fromAnalysis: true, analysisKey: 'algorithms_technologies' },
  { key: 'main_findings', label: 'Main Findings', fromAnalysis: true, analysisKey: 'main_findings' },
  { key: 'limitations', label: 'Limitations', fromAnalysis: true, analysisKey: 'limitations' },
  { key: 'future_work', label: 'Future Work', fromAnalysis: true, analysisKey: 'future_work' },
  { key: 'concepts', label: 'Research Concepts' },
  { key: 'citation_count', label: 'Citation Count' },
  { key: 'is_open_access', label: 'Open Access' },
];

export default function ComparePage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [savedPapers, setSavedPapers] = useState<ComparisonPaper[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const fetchSavedPapers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('saved_papers')
      .select('paper:papers(*, paper_authors(*))')
      .order('created_at', { ascending: false });
    const papers = (data || []).map((s: any) => s.paper as ComparisonPaper);

    // Load uploaded document analysis for each paper title match
    const { data: docs } = await supabase
      .from('uploaded_documents')
      .select('id, filename, extracted_text')
      .eq('extraction_status', 'extracted');

    const { data: analyses } = await supabase
      .from('analysis_runs')
      .select('document_id, result')
      .eq('analysis_type', 'structured')
      .eq('status', 'complete')
      .order('created_at', { ascending: false });

    if (docs && analyses) {
      const analysisByDocId = new Map<string, Record<string, string>>();
      for (const a of analyses) {
        if (!analysisByDocId.has(a.document_id)) {
          analysisByDocId.set(a.document_id, a.result as Record<string, string>);
        }
      }
      for (const paper of papers) {
        const matchingDoc = docs.find((d: any) =>
          d.filename.toLowerCase().includes(paper.title.toLowerCase().slice(0, 30)) ||
          paper.title.toLowerCase().slice(0, 30).includes(d.filename.toLowerCase().slice(0, -4))
        );
        if (matchingDoc) {
          paper.uploaded_analysis = analysisByDocId.get(matchingDoc.id) || null;
          paper.abstractText = matchingDoc.extracted_text?.slice(0, 500) || null;
        }
      }
    }

    setSavedPapers(papers);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSavedPapers();
  }, [fetchSavedPapers]);

  const togglePaper = (paperId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(paperId)) {
        return prev.filter((id) => id !== paperId);
      }
      if (prev.length >= 4) {
        toast({ title: 'Maximum reached', description: 'You can compare up to 4 papers.', variant: 'destructive' });
        return prev;
      }
      return [...prev, paperId];
    });
  };

  const clearComparison = () => setSelectedIds([]);

  const selectedPapers = savedPapers.filter((p) => selectedIds.includes(p.id));

  const filteredPapers = savedPapers.filter((p) => {
    if (!search) return true;
    return p.title.toLowerCase().includes(search.toLowerCase());
  });

  const getFieldValue = (paper: ComparisonPaper, field: typeof COMPARISON_FIELDS[number]): string => {
    if (field.key === 'authors') {
      return (paper as any).paper_authors?.map((a: any) => a.name).join(', ') || 'Unavailable';
    }
    if (field.key === 'abstract') {
      const val = paper.abstract || paper.abstractText;
      return val ? val.slice(0, 300) + (val.length > 300 ? '...' : '') : 'Unavailable';
    }
    if (field.key === 'concepts') {
      return paper.concepts?.length > 0 ? paper.concepts.join(', ') : 'Unavailable';
    }
    if (field.key === 'citation_count') {
      return paper.citation_count !== null ? String(paper.citation_count) : 'Unavailable';
    }
    if (field.key === 'is_open_access') {
      if (paper.is_open_access === null) return 'Unknown';
      return paper.is_open_access ? 'Yes' : 'No';
    }
    if (field.fromAnalysis && field.analysisKey) {
      const val = paper.uploaded_analysis?.[field.analysisKey];
      return val && val !== 'Not stated or not found in the extracted text.' ? val : 'Not analyzed (upload PDF to extract)';
    }
    const val = (paper as any)[field.key];
    return val !== null && val !== undefined && val !== '' ? String(val) : 'Unavailable';
  };

  const generateGapSuggestions = (): string[] => {
    if (selectedPapers.length < 2) return [];
    const gaps: string[] = [];

    // 1. Limitation analysis
    const limitations = selectedPapers.map((p) => {
      const val = p.uploaded_analysis?.limitations;
      return val && val !== 'Not stated or not found in the extracted text.' ? val.toLowerCase() : '';
    });
    const hasLimitation = limitations.some((l) => l.length > 10);
    if (hasLimitation) {
      const limitationCount = limitations.filter((l) => l.length > 10).length;
      gaps.push(`${limitationCount} of ${selectedPapers.length} papers report explicit limitations. Reviewing these limitations collectively may reveal a recurring unaddressed challenge worth investigating as a research gap.`);
    }

    // 2. Dataset diversity
    const datasets = selectedPapers.map((p) => {
      const val = p.uploaded_analysis?.dataset;
      return val && val !== 'Not stated or not found in the extracted text.' ? val.toLowerCase() : '';
    });
    const validDatasets = datasets.filter((d) => d.length > 5);
    if (validDatasets.length >= 2) {
      const uniqueDatasets = new Set(validDatasets.map((d) => d.slice(0, 50)));
      if (uniqueDatasets.size > 1) {
        gaps.push('These papers use different datasets — running a comparative evaluation on a common benchmark could reveal performance gaps and generalizability issues that individual studies miss.');
      }
    }

    // 3. Temporal span
    const years = selectedPapers.map((p) => p.publication_year).filter((y): y is number => y !== null);
    if (years.length > 1) {
      const yearSpan = Math.max(...years) - Math.min(...years);
      if (yearSpan > 5) {
        gaps.push(`These papers span ${yearSpan} years (${Math.min(...years)}–${Math.max(...years)}). Newer methods may not have been applied to older problem formulations — consider whether recent techniques could address previously open challenges.`);
      }
    }

    // 4. Concept overlap analysis
    const allConcepts = selectedPapers.map((p) => new Set(p.concepts || []));
    if (allConcepts.every((s) => s.size > 0)) {
      const intersection = allConcepts.reduce((acc, set) => new Set(Array.from(acc).filter((c) => set.has(c))));
      const union = allConcepts.reduce((acc, set) => new Set(Array.from(acc).concat(Array.from(set))));
      const overlapRatio = intersection.size / union.size;
      if (overlapRatio < 0.2 && selectedPapers.length >= 3) {
        gaps.push(`Low concept overlap (${Math.round(overlapRatio * 100)}%) across these papers. They may address related problems from very different angles — bridging these approaches could be a novel research direction.`);
      } else if (overlapRatio > 0.7) {
        gaps.push(`High concept overlap (${Math.round(overlapRatio * 100)}%) — these papers cover similar topics. Look for concepts that appear in only one paper to find underexplored sub-areas within this shared domain.`);
      }
    }

    // 5. Methodology comparison
    const methodologies = selectedPapers.map((p) => {
      const val = p.uploaded_analysis?.methodology;
      return val && val !== 'Not stated or not found in the extracted text.' ? val.toLowerCase() : '';
    });
    const validMethods = methodologies.filter((m) => m.length > 5);
    if (validMethods.length >= 2) {
      const uniqueMethods = new Set(validMethods.map((m) => m.slice(0, 80)));
      if (uniqueMethods.size === validMethods.length) {
        gaps.push('Each paper uses a distinct methodology. A hybrid approach combining elements from these methods may yield improvements that none achieves alone.');
      }
    }

    // 6. Open access gap
    const closedCount = selectedPapers.filter((p) => p.is_open_access === false).length;
    if (closedCount === selectedPapers.length && selectedPapers.length >= 2) {
      gaps.push('None of these papers are open access. Reproducing or extending their results may be difficult without access to the full text — an open-access replication study could be valuable.');
    }

    // 7. Citation disparity
    const citedPapers = selectedPapers.filter((p) => p.citation_count !== null && p.citation_count > 0);
    if (citedPapers.length >= 2) {
      const max = Math.max(...citedPapers.map((p) => p.citation_count!));
      const min = Math.min(...citedPapers.map((p) => p.citation_count!));
      if (max > min * 5) {
        gaps.push(`Large citation disparity detected (${min} vs ${max} citations). The less-cited paper may contain emerging ideas that haven't gained attention yet — exploring its approach could reveal an early-mover advantage.`);
      }
    }

    return gaps;
  };

  const exportCSV = () => {
    if (selectedPapers.length === 0) return;
    const headers = ['Field', ...selectedPapers.map((p) => p.title.slice(0, 80))];
    const rows = COMPARISON_FIELDS.map((field) => [
      field.label,
      ...selectedPapers.map((p) => getFieldValue(p, field)),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'researchflow-comparison.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: 'Comparison exported to CSV.' });
  };

  const gaps = generateGapSuggestions();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Compare Papers</h1>
        <p className="text-muted-foreground">Select 2-4 papers for side-by-side comparison.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Paper picker */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Select Papers ({selectedIds.length}/4)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search saved papers..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 text-sm" />
            </div>
            {loading ? (
              <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
            ) : filteredPapers.length > 0 ? (
              <ScrollArea className="max-h-[400px] pr-3">
                <div className="space-y-2">
                  {filteredPapers.map((paper) => {
                    const isSelected = selectedIds.includes(paper.id);
                    return (
                      <div
                        key={paper.id}
                        className={`rounded-lg border p-2.5 cursor-pointer transition-colors ${
                          isSelected ? 'border-accent bg-accent/5' : 'border-border/60 hover:bg-muted/50'
                        }`}
                        onClick={() => togglePaper(paper.id)}
                      >
                        <div className="flex items-start gap-2">
                          <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            isSelected ? 'border-accent bg-accent text-accent-foreground' : 'border-input'
                          }`}>
                            {isSelected && <Plus className="h-3 w-3 rotate-45" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium line-clamp-2">{paper.title}</p>
                            {paper.publication_year && <span className="text-xs text-muted-foreground">{paper.publication_year}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No saved papers. <Link href="/discover" className="text-accent hover:underline">Discover papers</Link> to save them first.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Comparison table */}
        <div className="space-y-4">
          {selectedPapers.length < 2 ? (
            <Card className="border-border/60">
              <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                <GitCompare className="h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">Select at least 2 papers</h3>
                <p className="mt-2 text-sm text-muted-foreground">Choose papers from your saved list to compare them side-by-side.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={exportCSV}>
                  <Download className="mr-2 h-4 w-4" /> Export CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  <Printer className="mr-2 h-4 w-4" /> Print
                </Button>
                <Button variant="ghost" size="sm" onClick={clearComparison}>
                  <X className="mr-2 h-4 w-4" /> Clear
                </Button>
              </div>

              {/* Table */}
              <Card className="border-border/60 overflow-hidden">
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-3 text-left font-semibold w-40">Field</th>
                        {selectedPapers.map((paper) => (
                          <th key={paper.id} className="p-3 text-left font-semibold min-w-[200px]">
                            <div className="flex items-start justify-between gap-2">
                              <span className="line-clamp-2">{paper.title}</span>
                              <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={() => togglePaper(paper.id)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {COMPARISON_FIELDS.map((field, i) => (
                        <tr key={field.key} className={i % 2 === 0 ? 'bg-muted/20' : ''}>
                          <td className="p-3 font-medium align-top">{field.label}</td>
                          {selectedPapers.map((paper) => {
                            const val = getFieldValue(paper, field);
                            return (
                              <td key={paper.id} className="p-3 align-top">
                                {val === 'Unavailable' ? (
                                  <span className="italic text-muted-foreground/60">Unavailable</span>
                                ) : (
                                  <span>{val}</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Research gap suggestions */}
              {gaps.length > 0 && (
                <Card className="border-accent/30 bg-accent/5">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-accent" /> Potential Research Gaps
                    </CardTitle>
                    <CardDescription>
                      These suggestions are derived from the differences and limitations above. They require further verification and do not guarantee novelty.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {gaps.map((gap, i) => (
                        <div key={i} className="flex items-start gap-2 rounded-lg border border-border/60 bg-card p-3">
                          <Lightbulb className="h-4 w-4 shrink-0 text-accent mt-0.5" />
                          <p className="text-sm">{gap}</p>
                        </div>
                      ))}
                    </div>
                    <Link href="/research-gap" className="mt-4 inline-flex items-center gap-1 text-sm text-accent hover:underline">
                      Run full gap analysis on all saved papers <ArrowRight className="h-3 w-3" />
                    </Link>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
