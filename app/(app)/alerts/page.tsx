'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Bell,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  AlertCircle,
  Bookmark,
  ExternalLink,
  Clock,
  FileText,
  X,
  Tag,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { savePaperToDatabase, savePaper } from '@/lib/services/search';
import type { AlertSetting, AlertCheck, SearchResult } from '@/types';

export default function AlertsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<AlertSetting[]>([]);
  const [checks, setChecks] = useState<Record<string, AlertCheck[]>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [topic, setTopic] = useState('');
  const [keywords, setKeywords] = useState('');
  const [source, setSource] = useState('openalex');
  const [creating, setCreating] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    const { data: alertData } = await supabase.from('alert_settings').select('*').order('created_at', { ascending: false });
    setAlerts((alertData || []) as AlertSetting[]);

    // Fetch checks for each alert
    const checksMap: Record<string, AlertCheck[]> = {};
    for (const alert of (alertData || [])) {
      const { data: checkData } = await supabase
        .from('alert_checks')
        .select('*')
        .eq('alert_id', alert.id)
        .order('checked_at', { ascending: false })
        .limit(3);
      checksMap[alert.id] = (checkData || []) as AlertCheck[];
    }
    setChecks(checksMap);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleCreate = async () => {
    if (!topic.trim()) {
      toast({ title: 'Error', description: 'Topic is required.', variant: 'destructive' });
      return;
    }
    setCreating(true);
    const kwArr = keywords.split(',').map((k) => k.trim()).filter(Boolean);
    const { error } = await supabase.from('alert_settings').insert({
      topic: topic.trim(),
      keywords: kwArr,
      source,
    });
    setCreating(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setTopic('');
    setKeywords('');
    setDialogOpen(false);
    toast({ title: 'Alert created', description: 'Your topic alert has been saved.' });
    fetchAlerts();
  };

  const handleDelete = async (alertId: string) => {
    const { error } = await supabase.from('alert_settings').delete().eq('id', alertId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    toast({ title: 'Deleted', description: 'Alert removed.' });
  };

  const handleCheck = async (alert: AlertSetting) => {
    setCheckingId(alert.id);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const session = await supabase.auth.getSession();
      const response = await fetch(`${supabaseUrl}/functions/v1/scholarly-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.data.session?.access_token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
        body: JSON.stringify({
          query: alert.topic + ' ' + alert.keywords.join(' '),
          perPage: 10,
        }),
      });

      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      const results: SearchResult[] = data.results || [];

      // Store check
      await supabase.from('alert_checks').insert({
        alert_id: alert.id,
        new_paper_count: results.length,
        results: results.map((r) => ({
          title: r.paper.title,
          doi: r.paper.doi,
          source_id: r.paper.source_id,
          source_provider: r.paper.source_provider,
          publication_year: r.paper.publication_year,
          authors: r.paper.authors.slice(0, 3).map((a) => a.name),
          relevanceScore: r.relevanceScore,
        })),
      });

      // Update last_checked_at
      await supabase.from('alert_settings')
        .update({ last_checked_at: new Date().toISOString() })
        .eq('id', alert.id);

      toast({ title: 'Check complete', description: `Found ${results.length} papers matching "${alert.topic}".` });
      fetchAlerts();
      setExpandedAlert(alert.id);
    } catch (err: any) {
      toast({ title: 'Check failed', description: err?.message || 'Failed to check for new papers.', variant: 'destructive' });
    } finally {
      setCheckingId(null);
    }
  };

  const handleSaveResult = async (result: any) => {
    try {
      const paper = await savePaperToDatabase({
        title: result.title,
        abstract: null,
        doi: result.doi,
        source_id: result.source_id,
        source_provider: result.source_provider,
        publication_year: result.publication_year,
        publication_type: null,
        is_open_access: null,
        open_access_url: null,
        venue: null,
        citation_count: null,
        concepts: [],
        authors: result.authors.map((a: string, i: number) => ({ name: a, orcid: null, affiliation: null, position: i })),
      });
      await savePaper(paper.id);
      toast({ title: 'Saved', description: 'Paper saved to your workspace.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to save paper.', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Topic Alerts</h1>
          <p className="text-muted-foreground">Save research topics and manually check for newly published papers.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> New alert</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a topic alert</DialogTitle>
              <DialogDescription>Save a research topic to check for new papers periodically.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="alert-topic">Research topic</Label>
                <Input id="alert-topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g., transformer architectures" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="alert-keywords">Keywords (comma-separated, optional)</Label>
                <Input id="alert-keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="e.g., attention, nlp, language models" />
              </div>
              <div className="space-y-2">
                <Label>Source</Label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openalex">OpenAlex</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create alert'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : alerts.length > 0 ? (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const alertChecks = checks[alert.id] || [];
            const isExpanded = expandedAlert === alert.id;
            const latestCheck = alertChecks[0];

            return (
              <Card key={alert.id} className="border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4 text-accent" />
                        <h3 className="font-semibold">{alert.topic}</h3>
                      </div>
                      {alert.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {alert.keywords.map((kw) => (
                            <Badge key={kw} variant="secondary" className="text-xs">
                              <Tag className="mr-1 h-2.5 w-2.5" /> {kw}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {alert.last_checked_at
                            ? `Last checked: ${new Date(alert.last_checked_at).toLocaleString()}`
                            : 'Never checked'}
                        </span>
                        <Badge variant="outline" className="text-xs">{alert.source}</Badge>
                        {latestCheck && (
                          <Badge className="text-xs bg-accent/10 text-accent">{latestCheck.new_paper_count} papers found</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => handleCheck(alert)}
                        disabled={checkingId === alert.id}
                      >
                        {checkingId === alert.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        <span className="ml-1.5 hidden sm:inline">Check</span>
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(alert.id)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>

                  {/* Latest check results */}
                  {isExpanded && latestCheck && (
                    <div className="mt-4 space-y-2 border-t pt-4">
                      <p className="text-xs font-medium text-muted-foreground">
                        Results from {new Date(latestCheck.checked_at).toLocaleString()}:
                      </p>
                      {(latestCheck.results as any[]).map((result, i) => (
                        <div key={i} className="rounded-lg border border-border/60 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <p className="text-sm font-medium line-clamp-2">{result.title}</p>
                              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                {result.authors.join(', ')}
                                {result.publication_year && <span>· {result.publication_year}</span>}
                                <Badge variant="outline" className="text-xs">{result.source_provider}</Badge>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" onClick={() => handleSaveResult(result)}>
                                <Bookmark className="h-3.5 w-3.5" />
                              </Button>
                              {result.doi && (
                                <a href={`https://doi.org/${result.doi}`} target="_blank" rel="noopener noreferrer">
                                  <Button size="sm" variant="ghost">
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </Button>
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {latestCheck && (
                    <button
                      className="mt-2 text-xs text-accent hover:underline"
                      onClick={() => setExpandedAlert(isExpanded ? null : alert.id)}
                    >
                      {isExpanded ? 'Hide results' : `Show ${latestCheck.new_paper_count} results from last check`}
                    </button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Bell className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No topic alerts yet</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Create a topic alert to check for newly published papers matching your research interests.
              Checks are run manually — scheduled notifications and email alerts are not yet available.
            </p>
            <Button className="mt-4" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Create your first alert
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/60 bg-muted/30">
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <AlertCircle className="inline h-3 w-3 mr-1" />
            Manual checks only. Scheduled background checks and email notifications are not implemented.
            Previous check results are stored to track what has already been discovered.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
