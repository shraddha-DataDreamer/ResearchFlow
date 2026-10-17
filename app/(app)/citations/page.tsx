'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Network,
  Search,
  Loader2,
  AlertCircle,
  FileText,
  ArrowLeft,
  ChevronRight,
  Quote,
  GitBranch,
  Sparkles,
  Users,
  Calendar,
  ExternalLink,
  Filter,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase/client';
import { fetchCitationsFromOpenAlex } from '@/lib/services/citations';
import type { Paper } from '@/types';

export default function CitationsPage() {
  const [loading, setLoading] = useState(true);
  const [savedPapers, setSavedPapers] = useState<Paper[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [search, setSearch] = useState('');
  const [citations, setCitations] = useState<{ references: Paper[]; citedBy: Paper[]; related: Paper[] }>({ references: [], citedBy: [], related: [] });
  const [fetchingCitations, setFetchingCitations] = useState(false);
  const [citationError, setCitationError] = useState<string | null>(null);
  const [view, setView] = useState<'graph' | 'list'>('list');
  const [filterType, setFilterType] = useState<'all' | 'references' | 'citedBy'>('all');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('saved_papers')
        .select('paper:papers(*, paper_authors(*))')
        .order('created_at', { ascending: false });
      setSavedPapers((data || []).map((s: any) => s.paper as Paper));
      setLoading(false);
    })();
  }, []);

  const handleSelectPaper = async (paper: Paper) => {
    setSelectedPaper(paper);
    setFetchingCitations(true);
    setCitationError(null);
    setCitations({ references: [], citedBy: [], related: [] });

    const result = await fetchCitationsFromOpenAlex(paper);
    setCitations({ references: result.references, citedBy: result.citedBy, related: result.related });
    setCitationError(result.error);
    setFetchingCitations(false);
  };

  const filteredPapers = savedPapers.filter((p) => {
    if (!search) return true;
    return p.title.toLowerCase().includes(search.toLowerCase());
  });

  const getFilteredCitations = () => {
    if (filterType === 'references') return citations.references;
    if (filterType === 'citedBy') return citations.citedBy;
    return [...citations.references, ...citations.citedBy];
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Citation Explorer</h1>
        <p className="text-muted-foreground">Explore citation relationships from verified OpenAlex metadata.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Paper picker */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Select a paper</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search saved papers..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 text-sm" />
            </div>
            {loading ? (
              <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
            ) : filteredPapers.length > 0 ? (
              <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin pr-2">
                {filteredPapers.map((paper) => (
                  <div
                    key={paper.id}
                    className={`rounded-lg border p-2.5 cursor-pointer transition-colors ${
                      selectedPaper?.id === paper.id ? 'border-accent bg-accent/5' : 'border-border/60 hover:bg-muted/50'
                    }`}
                    onClick={() => handleSelectPaper(paper)}
                  >
                    <p className="text-xs font-medium line-clamp-2">{paper.title}</p>
                    {paper.publication_year && <span className="text-xs text-muted-foreground">{paper.publication_year}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No saved papers. <Link href="/discover" className="text-accent hover:underline">Discover</Link> first.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Citation view */}
        <div className="space-y-4">
          {!selectedPaper ? (
            <Card className="border-border/60">
              <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                <Network className="h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">Select a paper to explore citations</h3>
                <p className="mt-2 text-sm text-muted-foreground">Citation data comes from OpenAlex. Papers without OpenAlex IDs will show limited data.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Selected paper header */}
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <FileText className="h-6 w-6 text-accent shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold">{selectedPaper.title}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {(selectedPaper as any).paper_authors?.slice(0, 3).map((a: any) => a.name).join(', ')}
                        {selectedPaper.publication_year && <span>· {selectedPaper.publication_year}</span>}
                        {selectedPaper.citation_count !== null && <span>· {selectedPaper.citation_count} citations</span>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {citationError && (
                <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-4 py-2 text-sm text-warning">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{citationError}</span>
                </div>
              )}

              {fetchingCitations ? (
                <div className="space-y-3">
                  <Skeleton className="h-8 w-full" />
                  {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
                </div>
              ) : (
                <>
                  {/* Filter tabs */}
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant={filterType === 'all' ? 'default' : 'outline'} onClick={() => setFilterType('all')}>
                      All ({citations.references.length + citations.citedBy.length})
                    </Button>
                    <Button size="sm" variant={filterType === 'references' ? 'default' : 'outline'} onClick={() => setFilterType('references')}>
                      <GitBranch className="mr-1.5 h-3.5 w-3.5" /> References ({citations.references.length})
                    </Button>
                    <Button size="sm" variant={filterType === 'citedBy' ? 'default' : 'outline'} onClick={() => setFilterType('citedBy')}>
                      <Quote className="mr-1.5 h-3.5 w-3.5" /> Cited by ({citations.citedBy.length})
                    </Button>
                  </div>

                  {/* Citation list */}
                  {getFilteredCitations().length > 0 ? (
                    <div className="space-y-2">
                      {getFilteredCitations().map((paper, i) => {
                        const isReference = citations.references.includes(paper);
                        return (
                          <Card key={`${paper.source_id}-${i}`} className="border-border/60 transition-shadow hover:shadow-sm">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 space-y-1.5">
                                  <p className="text-sm font-medium line-clamp-2">{paper.title}</p>
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    {paper.authors.slice(0, 3).map((a) => a.name).join(', ')}
                                    {paper.publication_year && <span>· {paper.publication_year}</span>}
                                    {paper.citation_count !== null && <span>· {paper.citation_count} citations</span>}
                                  </div>
                                  {paper.concepts.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {paper.concepts.slice(0, 3).map((c) => <Badge key={c} variant="secondary" className="text-xs font-normal">{c}</Badge>)}
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-col items-end gap-2 shrink-0">
                                  <Badge variant={isReference ? 'secondary' : 'outline'} className="text-xs">
                                    {isReference ? <><GitBranch className="mr-1 h-3 w-3" /> References</> : <><Quote className="mr-1 h-3 w-3" /> Cited by</>}
                                  </Badge>
                                  {paper.doi && (
                                    <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer">
                                      <Button size="icon" variant="ghost" className="h-7 w-7">
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </Button>
                                    </a>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  ) : !citationError ? (
                    <Card className="border-border/60">
                      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                        <p className="mt-3 text-sm text-muted-foreground">No citation data available for this paper.</p>
                      </CardContent>
                    </Card>
                  ) : null}

                  {/* Note about data source */}
                  <Card className="border-border/60 bg-muted/30">
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">
                        <GitBranch className="inline h-3 w-3 mr-1" />
                        Citation relationships are from verified OpenAlex metadata. No relationships are fabricated.
                        Semantically similar papers require embedding configuration and are not shown here.
                      </p>
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
