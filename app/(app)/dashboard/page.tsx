'use client';

import { useState } from 'react';
import { useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  BookMarked,
  FileText,
  Clock,
  TrendingUp,
  ArrowRight,
  Microscope,
  FolderOpen,
  Bell,
  Lightbulb,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { Paper, SearchHistoryEntry, ResearchTopic } from '@/types';

export default function DashboardPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [savedCount, setSavedCount] = useState(0);
  const [recentSearches, setRecentSearches] = useState<SearchHistoryEntry[]>([]);
  const [recentPapers, setRecentPapers] = useState<Paper[]>([]);
  const [topics, setTopics] = useState<ResearchTopic[]>([]);
  const [readingStats, setReadingStats] = useState({ to_read: 0, reading: 0, completed: 0 });

  const fetchDashboardData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);

    const [savedRes, searchesRes, topicsRes] = await Promise.all([
      supabase.from('saved_papers').select('reading_status, paper_id'),
      supabase.from('search_history').select('*').order('created_at', { ascending: false }).limit(5),
      supabase.from('research_topics').select('*').order('created_at', { ascending: false }).limit(5),
    ]);

    setSavedCount(savedRes.data?.length || 0);
    setRecentSearches((searchesRes.data || []) as SearchHistoryEntry[]);
    setTopics((topicsRes.data || []) as ResearchTopic[]);

    const stats = { to_read: 0, reading: 0, completed: 0 };
    savedRes.data?.forEach((s) => {
      if (s.reading_status in stats) stats[s.reading_status as keyof typeof stats]++;
    });
    setReadingStats(stats);

    // Fetch recently saved papers with paper details
    if (savedRes.data && savedRes.data.length > 0) {
      const paperIds = savedRes.data.slice(0, 5).map((s) => s.paper_id);
      const { data: papers } = await supabase
        .from('papers')
        .select('*, paper_authors(*)')
        .in('id', paperIds)
        .order('created_at', { ascending: false })
        .limit(5);
      setRecentPapers((papers || []) as Paper[]);
    }

    setLoading(false);
  }, [profile]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/discover?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const isEmpty = !loading && savedCount === 0 && recentSearches.length === 0 && topics.length === 0;

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {profile?.full_name?.split(' ')[0] || 'Researcher'}
        </h1>
        <p className="text-muted-foreground">
          {profile?.department
            ? `${profile.department} — Discover, analyze, and organize your research.`
            : 'Set up your department in Settings to get personalized recommendations.'}
        </p>
      </div>

      {/* Global search */}
      <Card className="border-border/60">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search for a research topic, paper title, or question..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-12 text-base"
              />
            </div>
            <Button type="submit" size="lg" className="h-12">
              Search <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Empty state */}
      {isEmpty && (
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Search className="h-8 w-8" />
            </div>
            <h3 className="mt-6 text-lg font-semibold">Start your research journey</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Search for a research topic above to discover papers from OpenAlex, Crossref, and arXiv.
              Save papers, take notes, and build your literature review.
            </p>
            <Link href="/discover">
              <Button className="mt-6">
                Discover papers <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      {!isEmpty && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            <>
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
            </>
          ) : (
            <>
              <StatCard icon={BookMarked} label="Saved Papers" value={savedCount} color="accent" />
              <StatCard icon={FileText} label="To Read" value={readingStats.to_read} color="warning" />
              <StatCard icon={Clock} label="Currently Reading" value={readingStats.reading} color="info" />
              <StatCard icon={TrendingUp} label="Completed" value={readingStats.completed} color="success" />
            </>
          )}
        </div>
      )}

      {/* Recent searches + Quick actions */}
      {!isEmpty && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2 border-border/60">
            <CardHeader>
              <CardTitle className="text-lg">Recent Searches</CardTitle>
              <CardDescription>Your last 5 search queries</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
              ) : recentSearches.length > 0 ? (
                <div className="space-y-2">
                  {recentSearches.map((search) => (
                    <Link
                      key={search.id}
                      href={`/discover?q=${encodeURIComponent(search.query)}`}
                      className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{search.query}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {search.result_count !== null && (
                          <Badge variant="secondary" className="text-xs">{search.result_count} results</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(search.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">No searches yet.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <QuickAction icon={Search} label="Discover Papers" href="/discover" />
              <QuickAction icon={Lightbulb} label="Research Gap Analysis" href="/research-gap" />
              <QuickAction icon={Microscope} label="PDF Analysis" href="/analysis" />
              <QuickAction icon={FolderOpen} label="My Workspace" href="/workspace" />
              <QuickAction icon={Bell} label="Topic Alerts" href="/alerts" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent papers + Topics */}
      {!isEmpty && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-lg">Recently Saved Papers</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
              ) : recentPapers.length > 0 ? (
                <div className="space-y-2">
                  {recentPapers.map((paper) => (
                    <Link
                      key={paper.id}
                      href={`/papers/${paper.id}`}
                      className="block rounded-lg border border-border/60 px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <p className="line-clamp-2 text-sm font-medium">{paper.title}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{paper.publication_year || 'N/A'}</span>
                        <span>·</span>
                        <Badge variant="outline" className="text-xs">{paper.source_provider}</Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">No saved papers yet.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-lg">Research Topics</CardTitle>
              <CardDescription>Your saved areas of interest</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
              ) : topics.length > 0 ? (
                <div className="space-y-2">
                  {topics.map((topic) => (
                    <div key={topic.id} className="rounded-lg border border-border/60 px-4 py-3">
                      <p className="text-sm font-medium">{topic.topic}</p>
                      {topic.keywords.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {topic.keywords.slice(0, 3).map((kw) => (
                            <Badge key={kw} variant="secondary" className="text-xs">{kw}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No research topics saved.{' '}
                  <Link href="/alerts" className="text-accent hover:underline">Create one</Link>
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: 'accent' | 'warning' | 'info' | 'success';
}) {
  const colorMap = {
    accent: 'bg-accent/10 text-accent',
    warning: 'bg-warning/10 text-warning',
    info: 'bg-info/10 text-info',
    success: 'bg-success/10 text-success',
  };
  return (
    <Card className="border-border/60">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${colorMap[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickAction({
  icon: Icon,
  label,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3 transition-colors hover:bg-muted/50"
    >
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
