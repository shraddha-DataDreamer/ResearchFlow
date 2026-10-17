'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Map,
  Search,
  Loader2,
  FileText,
  AlertCircle,
  Clock,
  GitBranch,
  Filter,
  ArrowRight,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase/client';
import type { Paper } from '@/types';

export default function JourneyPage() {
  const [loading, setLoading] = useState(true);
  const [savedPapers, setSavedPapers] = useState<Paper[]>([]);
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('all');

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

  const filtered = savedPapers.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.title.toLowerCase().includes(q) || (p.concepts || []).some((c) => c.toLowerCase().includes(q));
  });

  // Group by year for timeline
  const yearGroups: { year: number; papers: Paper[] }[] = [];
  const papersWithYears = filtered
    .filter((p) => p.publication_year !== null)
    .sort((a, b) => (b.publication_year || 0) - (a.publication_year || 0));

  for (const paper of papersWithYears) {
    const year = paper.publication_year!;
    let group = yearGroups.find((g) => g.year === year);
    if (!group) {
      group = { year, papers: [] };
      yearGroups.push(group);
    }
    group.papers.push(paper);
  }

  const allYears = savedPapers
    .map((p) => p.publication_year)
    .filter((y): y is number => y !== null);
  const minYear = allYears.length > 0 ? Math.min(...allYears) : 2000;
  const maxYear = allYears.length > 0 ? Math.max(...allYears) : new Date().getFullYear();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Research Journey</h1>
        <p className="text-muted-foreground">Visualize how research on your saved topics has developed over time.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by title or concept..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All years</SelectItem>
            <SelectItem value="recent">Last 3 years</SelectItem>
            <SelectItem value="older">Before 2020</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : yearGroups.length > 0 ? (
        <>
          {/* Timeline */}
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

            <div className="space-y-6">
              {yearGroups.map((group) => (
                <div key={group.year} className="relative pl-12">
                  {/* Year marker */}
                  <div className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    {String(group.year).slice(2)}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-semibold">{group.year}</h3>
                      <Badge variant="secondary" className="text-xs">{group.papers.length} paper{group.papers.length > 1 ? 's' : ''}</Badge>
                    </div>

                    {group.papers.map((paper) => (
                      <Link key={paper.id} href={`/papers/${paper.id}`}>
                        <Card className="border-border/60 transition-shadow hover:shadow-md">
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium line-clamp-2">{paper.title}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  {(paper as any).paper_authors?.slice(0, 2).map((a: any) => a.name).join(', ')}
                                  {paper.venue && <span>· {paper.venue}</span>}
                                  {paper.citation_count !== null && <span>· {paper.citation_count} citations</span>}
                                </div>
                                {paper.concepts.length > 0 && (
                                  <div className="mt-1.5 flex flex-wrap gap-1">
                                    {paper.concepts.slice(0, 3).map((c) => (
                                      <Badge key={c} variant="secondary" className="text-xs font-normal">{c}</Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Info */}
          <Card className="border-border/60 bg-muted/30">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">
                <Clock className="inline h-3 w-3 mr-1" />
                This timeline is built from your saved papers' publication years.
                <GitBranch className="inline h-3 w-3 mx-1" />
                Citation graph connections require citation data from the Citation Explorer.
                Historical trends are not fabricated — only papers you have saved are shown.
              </p>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Map className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No data for research journey yet</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Save papers with publication years to see them on a timeline. The journey map
              shows how research has developed over time based on your saved papers.
            </p>
            <Link href="/discover">
              <Button className="mt-4"><Search className="mr-2 h-4 w-4" /> Discover papers</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
