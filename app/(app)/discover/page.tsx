'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search as SearchIcon,
  Loader2,
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  FileText,
  Filter,
  X,
  Info,
  Download,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { searchPapers, savePaperToDatabase, savePaper, unsavePaper, recordSearch, getSavedPaperIds } from '@/lib/services/search';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth-context';
import type { SearchResponse, SearchResult } from '@/types';

function DiscoverContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [sources, setSources] = useState<SearchResponse['sources']>([]);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [searched, setSearched] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchSavedCount, setBatchSavedCount] = useState(0);

  // Filters
  const [yearFrom, setYearFrom] = useState<string>('');
  const [yearTo, setYearTo] = useState<string>('');
  const [publicationType, setPublicationType] = useState<string>('all');
  const [openAccessOnly, setOpenAccessOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const loadSavedIds = useCallback(async () => {
    const ids = await getSavedPaperIds();
    setSavedIds(ids);
  }, []);

  useEffect(() => {
    loadSavedIds();
  }, [loadSavedIds]);

  const doSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setError('Search query must be at least 2 characters.');
      return;
    }
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const response = await searchPapers({
        query: searchQuery,
        yearFrom: yearFrom ? parseInt(yearFrom) : undefined,
        yearTo: yearTo ? parseInt(yearTo) : undefined,
        publicationType: publicationType === 'all' ? undefined : publicationType,
        openAccessOnly,
      });
      setResults(response.results);
      setTotal(response.total);
      setSources(response.sources);
      setFallbackMode(response.fallbackMode);
      await recordSearch(searchQuery, {
        query: searchQuery,
        yearFrom: yearFrom ? parseInt(yearFrom) : undefined,
        yearTo: yearTo ? parseInt(yearTo) : undefined,
        publicationType: publicationType === 'all' ? undefined : publicationType,
        openAccessOnly,
      }, response.total);
      await loadSavedIds();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed. Please try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [yearFrom, yearTo, publicationType, openAccessOnly, loadSavedIds]);

  useEffect(() => {
    if (initialQuery) {
      doSearch(initialQuery);
    }
  }, [initialQuery, doSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/discover?q=${encodeURIComponent(query.trim())}`);
    doSearch(query.trim());
  };

  const handleSave = async (result: SearchResult) => {
    setSavingId(result.paper.source_id);
    try {
      const savedPaper = await savePaperToDatabase({
        title: result.paper.title,
        abstract: result.paper.abstract,
        doi: result.paper.doi,
        source_id: result.paper.source_id,
        source_provider: result.paper.source_provider,
        publication_year: result.paper.publication_year,
        publication_type: result.paper.publication_type,
        is_open_access: result.paper.is_open_access,
        open_access_url: result.paper.open_access_url,
        venue: result.paper.venue,
        citation_count: result.paper.citation_count,
        concepts: result.paper.concepts,
        authors: result.paper.authors,
      });

      const isSaved = savedIds.has(savedPaper.id);
      if (isSaved) {
        await unsavePaper(savedPaper.id);
        setSavedIds((prev) => {
          const next = new Set(prev);
          next.delete(savedPaper.id);
          return next;
        });
        toast({ title: 'Removed', description: 'Paper removed from your saved list.' });
      } else {
        await savePaper(savedPaper.id);
        setSavedIds((prev) => {
          const next = new Set(prev);
          next.add(savedPaper.id);
          if (result.paper.doi) next.add(result.paper.doi);
          next.add(`${result.paper.source_provider}:${result.paper.source_id}`);
          return next;
        });
        toast({ title: 'Saved', description: 'Paper saved to your workspace.' });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save paper.',
        variant: 'destructive',
      });
    } finally {
      setSavingId(null);
    }
  };

  const clearFilters = () => {
    setYearFrom('');
    setYearTo('');
    setPublicationType('all');
    setOpenAccessOnly(false);
  };

  const handleBatchSave = async () => {
    setBatchSaving(true);
    setBatchSavedCount(0);
    let saved = 0;
    for (const result of results) {
      const paper = result.paper;
      const paperKey = paper.doi || `${paper.source_provider}:${paper.source_id}`;
      if (savedIds.has(paperKey) || savedIds.has(paper.id)) continue;
      try {
        const savedPaper = await savePaperToDatabase({
          title: paper.title,
          abstract: paper.abstract,
          doi: paper.doi,
          source_id: paper.source_id,
          source_provider: paper.source_provider,
          publication_year: paper.publication_year,
          publication_type: paper.publication_type,
          is_open_access: paper.is_open_access,
          open_access_url: paper.open_access_url,
          venue: paper.venue,
          citation_count: paper.citation_count,
          concepts: paper.concepts,
          authors: paper.authors,
        });
        await savePaper(savedPaper.id);
        const newKey = paper.doi || `${paper.source_provider}:${paper.source_id}`;
        savedIds.add(savedPaper.id);
        savedIds.add(newKey);
        saved++;
      } catch {
        // skip errors on individual papers
      }
    }
    setSavedIds(new Set(savedIds));
    setBatchSavedCount(saved);
    setBatchSaving(false);
    if (saved > 0) {
      toast({ title: 'Saved to dashboard', description: `${saved} paper${saved !== 1 ? 's' : ''} saved to your workspace.` });
    } else {
      toast({ title: 'Nothing to save', description: 'All results are already in your workspace.' });
    }
  };

  const hasActiveFilters = yearFrom || yearTo || publicationType !== 'all' || openAccessOnly;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Discover Papers</h1>
        <p className="text-muted-foreground">Search across OpenAlex, arXiv, Crossref, and the local database for relevant research.</p>
      </div>

      {/* Search bar */}
      <Card className="border-border/60">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Enter a research topic or question..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 h-12 text-base"
              />
            </div>
            <Button type="submit" size="lg" className="h-12" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
            </Button>
            <Button type="button" variant="outline" size="lg" className="h-12" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-4 w-4" />
              <span className="ml-2 hidden sm:inline">Filters</span>
              {hasActiveFilters && <span className="ml-1 flex h-2 w-2 rounded-full bg-accent" />}
            </Button>
          </form>

          {showFilters && (
            <div className="mt-4 grid gap-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-xs">From year</Label>
                <Input type="number" placeholder="2010" value={yearFrom} onChange={(e) => setYearFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">To year</Label>
                <Input type="number" placeholder="2025" value={yearTo} onChange={(e) => setYearTo(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Publication type</Label>
                <Select value={publicationType} onValueChange={setPublicationType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="article">Journal article</SelectItem>
                    <SelectItem value="proceedings-article">Conference paper</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="book-chapter">Book chapter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setOpenAccessOnly(!openAccessOnly)} className={openAccessOnly ? 'border-accent text-accent' : ''}>
                  {openAccessOnly ? 'Open access only' : 'All access'}
                </Button>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-3 w-3" /> Clear
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Source status */}
      {searched && !loading && !error && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">Sources:</span>
          {sources.map((src) => (
            <Badge key={src.name} variant={src.success ? 'secondary' : 'outline'} className="text-xs">
              {src.name}: {src.success ? `${src.count} results` : 'failed'}
            </Badge>
          ))}
          {fallbackMode && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="border-warning/40 text-warning">
                  <Info className="mr-1 h-3 w-3" /> Keyword mode
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Semantic embeddings not configured. Using keyword-based ranking.</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      )}

      {/* Results */}
      {!loading && !error && results.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{total} papers found</p>
            <Button variant="outline" size="sm" onClick={handleBatchSave} disabled={batchSaving || results.length === 0}>
              {batchSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {batchSaving ? `Saving... (${batchSavedCount})` : 'Save all to dashboard'}
            </Button>
          </div>
          <div className="space-y-3">
            {results.map((result, idx) => {
              const paper = result.paper;
              const paperKey = paper.doi || `${paper.source_provider}:${paper.source_id}`;
              const isSaved = savedIds.has(paperKey) || savedIds.has(paper.id);
              const authorNames = paper.authors.slice(0, 3).map((a) => a.name).join(', ');
              const moreAuthors = paper.authors.length > 3 ? ` +${paper.authors.length - 3} more` : '';

              return (
                <Card key={`${paper.source_provider}-${paper.source_id}-${idx}`} className="border-border/60 transition-shadow hover:shadow-md">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <h3 className="font-semibold leading-snug">{paper.title}</h3>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{authorNames}{moreAuthors}</span>
                          {paper.publication_year && <span>· {paper.publication_year}</span>}
                          {paper.venue && <span>· {paper.venue}</span>}
                        </div>
                        {paper.abstract && (
                          <p className="line-clamp-3 text-sm text-muted-foreground">{paper.abstract}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <Badge variant="outline" className="text-xs">{paper.source_provider}</Badge>
                          {paper.is_open_access && <Badge className="bg-success/10 text-success border-success/20 text-xs">Open Access</Badge>}
                          {paper.citation_count !== null && paper.citation_count > 0 && (
                            <Badge variant="secondary" className="text-xs">{paper.citation_count} citations</Badge>
                          )}
                          {paper.concepts.slice(0, 3).map((c) => (
                            <Badge key={c} variant="secondary" className="text-xs font-normal">{c}</Badge>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                          <Info className="h-3 w-3" />
                          <span>{result.relevanceExplanation}</span>
                        </div>
                        <div className="flex items-center gap-3 pt-2 border-t border-border/40">
                          {isSaved && (
                            <Link href={`/papers/${paper.id || ''}`} className="text-xs text-accent hover:underline flex items-center gap-1">
                              <FileText className="h-3 w-3" /> View details
                            </Link>
                          )}
                          <span className="text-xs text-muted-foreground">Click Save to add to dashboard and enable detailed view, comparison, and analysis.</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          variant={isSaved ? 'secondary' : 'outline'}
                          onClick={() => handleSave(result)}
                          disabled={savingId === paper.source_id}
                        >
                          {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                          <span className="ml-1.5 hidden sm:inline">{isSaved ? 'Saved' : 'Save'}</span>
                        </Button>
                        {paper.open_access_url ? (
                          <a href={paper.open_access_url} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="ghost" className="w-full">
                              <ExternalLink className="mr-1 h-4 w-4" /> Open PDF
                            </Button>
                          </a>
                        ) : paper.doi ? (
                          <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="ghost" className="w-full">
                              <ExternalLink className="mr-1 h-4 w-4" /> DOI Link
                            </Button>
                          </a>
                        ) : (
                          <a href={`https://scholar.google.com/scholar?q=${encodeURIComponent(paper.title)}`} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="ghost" className="w-full">
                              <ExternalLink className="mr-1 h-4 w-4" /> Find PDF
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
        </>
      )}

      {/* Empty state */}
      {searched && !loading && !error && results.length === 0 && (
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No papers found</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Try a different search query or adjust your filters. ResearchFlow searches OpenAlex, arXiv, Crossref, and a local database of scholarly works.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Initial state */}
      {!searched && !loading && !error && (
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <SearchIcon className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Start searching</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Enter a research topic, question, or keywords above to discover relevant papers.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function DiscoverPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <DiscoverContent />
    </Suspense>
  );
}
