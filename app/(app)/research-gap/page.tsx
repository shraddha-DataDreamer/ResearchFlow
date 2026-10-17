'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Lightbulb,
  TrendingUp,
  Calendar,
  Tag,
  Building2,
  AlertTriangle,
  Loader2,
  FileText,
  ArrowRight,
  RefreshCw,
  Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

import { getSavedPapersForGapAnalysis, analyzeResearchGaps, saveGapReport, type ResearchGapReport, type GapInsight } from '@/lib/services/research-gap';
import { useToast } from '@/hooks/use-toast';

const severityStyles: Record<string, { border: string; bg: string; icon: string; label: string }> = {
  high: { border: 'border-destructive/30', bg: 'bg-destructive/5', icon: 'text-destructive', label: 'High priority' },
  medium: { border: 'border-warning/30', bg: 'bg-warning/5', icon: 'text-warning', label: 'Medium priority' },
  low: { border: 'border-info/30', bg: 'bg-info/5', icon: 'text-info', label: 'Low priority' },
};

const typeIcons: Record<string, typeof Lightbulb> = {
  coverage: TrendingUp,
  temporal: Calendar,
  methodology: FileText,
  dataset: Building2,
  limitation: AlertTriangle,
  concept_gap: Tag,
};

export default function ResearchGapPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<ResearchGapReport | null>(null);
  const [saved, setSaved] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    const papers = await getSavedPapersForGapAnalysis();
    const gapReport = analyzeResearchGaps(papers);
    setReport(gapReport);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleSaveReport = async () => {
    if (!report) return;
    const { error } = await saveGapReport(report);
    if (error) {
      toast({ title: 'Error', description: error, variant: 'destructive' });
    } else {
      setSaved(true);
      toast({ title: 'Saved', description: 'Gap analysis report saved to your history.' });
    }
  };

  const handleRefresh = () => {
    setSaved(false);
    fetchReport();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Research Gap Analysis</h1>
          <p className="text-muted-foreground">Identify underexplored areas in your saved papers.</p>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </div>
    );
  }

  if (!report || report.totalPapers === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Research Gap Analysis</h1>
          <p className="text-muted-foreground">Identify underexplored areas in your saved papers.</p>
        </div>
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Lightbulb className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No papers to analyze yet</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Save some papers from your searches first, then return here to identify research gaps
              and underexplored areas in your collection.
            </p>
            <Link href="/discover">
              <Button className="mt-6">
                Discover papers <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const highPriority = report.insights.filter((i) => i.severity === 'high');
  const mediumPriority = report.insights.filter((i) => i.severity === 'medium');
  const lowPriority = report.insights.filter((i) => i.severity === 'low');

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Research Gap Analysis</h1>
          <p className="text-muted-foreground">
            Analyzing {report.totalPapers} saved paper{report.totalPapers !== 1 ? 's' : ''} for underexplored areas.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button size="sm" onClick={handleSaveReport} disabled={saved}>
            {saved ? 'Saved' : 'Save report'}
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/60">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">{report.totalPapers}</p>
              <p className="text-sm text-muted-foreground">Papers Analyzed</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-info/10 text-info">
              <Tag className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">{report.concepts.length}</p>
              <p className="text-sm text-muted-foreground">Unique Concepts</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-warning/10 text-warning">
              <Lightbulb className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">{report.insights.length}</p>
              <p className="text-sm text-muted-foreground">Gap Insights</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10 text-success">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {report.yearRange.min && report.yearRange.max
                  ? `${report.yearRange.max - report.yearRange.min + 1}y`
                  : 'N/A'}
              </p>
              <p className="text-sm text-muted-foreground">
                {report.yearRange.min ? `${report.yearRange.min}–${report.yearRange.max}` : 'No dates'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      {report.insights.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold">Identified Research Gaps</h2>
          </div>

          {highPriority.length > 0 && (
            <div className="space-y-3">
              {highPriority.map((insight, i) => (
                <GapInsightCard key={`high-${i}`} insight={insight} />
              ))}
            </div>
          )}

          {mediumPriority.length > 0 && (
            <div className="space-y-3">
              {mediumPriority.map((insight, i) => (
                <GapInsightCard key={`med-${i}`} insight={insight} />
              ))}
            </div>
          )}

          {lowPriority.length > 0 && (
            <div className="space-y-3">
              {lowPriority.map((insight, i) => (
                <GapInsightCard key={`low-${i}`} insight={insight} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="flex items-start gap-3 p-4">
            <Info className="h-5 w-5 shrink-0 text-success mt-0.5" />
            <div>
              <p className="text-sm font-medium">No significant gaps detected</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your saved papers show good coverage across concepts, time periods, and publication types.
                Keep saving papers as you discover them to get richer gap analysis.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Concept coverage chart */}
      {report.concepts.length > 0 && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Concept Coverage</CardTitle>
            <CardDescription>How frequently each concept appears in your saved papers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {report.concepts.slice(0, 10).map((concept) => {
                const pct = (concept.count / report.totalPapers) * 100;
                return (
                  <div key={concept.concept} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{concept.concept}</span>
                      <span className="text-muted-foreground">{concept.count}/{report.totalPapers}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Underrepresented concepts */}
      {report.underrepresentedConcepts.length > 0 && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Underrepresented Concepts</CardTitle>
            <CardDescription>Concepts that appear in only one paper — potential research gaps</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {report.underrepresentedConcepts.map((concept) => (
                <Link key={concept} href={`/discover?q=${encodeURIComponent(concept)}`}>
                  <Badge variant="secondary" className="cursor-pointer hover:bg-accent/20 transition-colors">
                    {concept}
                  </Badge>
                </Link>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Click any concept to search for more papers on that topic.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Top venues */}
      {report.topVenues.length > 0 && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Publication Venues</CardTitle>
            <CardDescription>Where your saved papers are published</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {report.topVenues.map((venue) => (
                <div key={venue.venue} className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{venue.venue}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">{venue.count} paper{venue.count !== 1 ? 's' : ''}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Next steps */}
      <Card className="border-accent/30 bg-accent/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-accent" /> Recommended Next Steps
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Link href="/discover" className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3 transition-colors hover:bg-muted/50">
            <span className="text-sm font-medium">Search for papers on underrepresented concepts</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link href="/compare" className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3 transition-colors hover:bg-muted/50">
            <span className="text-sm font-medium">Compare papers side-by-side for deeper analysis</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link href="/analysis" className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3 transition-colors hover:bg-muted/50">
            <span className="text-sm font-medium">Upload and analyze PDFs for structured extraction</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function GapInsightCard({ insight }: { insight: GapInsight }) {
  const style = severityStyles[insight.severity];
  const Icon = typeIcons[insight.type] || Lightbulb;

  return (
    <Card className={`${style.border} ${style.bg} border`}>
      <CardContent className="flex items-start gap-3 p-4">
        <Icon className={`h-5 w-5 shrink-0 ${style.icon} mt-0.5`} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">{insight.title}</p>
            <Badge variant="outline" className={`text-xs ${style.border} ${style.icon}`}>{style.label}</Badge>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{insight.description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
