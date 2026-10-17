'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Loader2,
  FileText,
  Users,
  Calendar,
  Building2,
  Quote,
  Tag,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase/client';
import { savePaper, unsavePaper, updateReadingStatus } from '@/lib/services/search';
import { recordView } from '@/lib/services/citations';
import { useToast } from '@/hooks/use-toast';
import { PaperChatbot } from '@/components/paper-chatbot';
import type { Paper } from '@/types';

export default function PaperDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [paper, setPaper] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [readingStatus, setReadingStatus] = useState<string>('to_read');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const paperId = params.id as string;
    if (!paperId) return;

    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('papers')
        .select('*, paper_authors(*)')
        .eq('id', paperId)
        .maybeSingle();

      if (data) {
        setPaper(data as Paper);
        recordView(paperId);
        const { data: saved } = await supabase
          .from('saved_papers')
          .select('reading_status')
          .eq('paper_id', paperId)
          .maybeSingle();
        if (saved) {
          setIsSaved(true);
          setReadingStatus(saved.reading_status);
        }
      }
      setLoading(false);
    })();
  }, [params.id]);

  const handleSave = async () => {
    if (!paper) return;
    setSaving(true);
    if (isSaved) {
      await unsavePaper(paper.id);
      setIsSaved(false);
      toast({ title: 'Removed', description: 'Paper removed from your saved list.' });
    } else {
      await savePaper(paper.id);
      setIsSaved(true);
      toast({ title: 'Saved', description: 'Paper saved to your workspace.' });
    }
    setSaving(false);
  };

  const handleStatusChange = async (status: string) => {
    if (!paper) return;
    setReadingStatus(status);
    await updateReadingStatus(paper.id, status as 'to_read' | 'reading' | 'completed');
    toast({ title: 'Updated', description: `Reading status changed to ${status.replace('_', ' ')}.` });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!paper) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">Paper not found</h3>
          <p className="mt-2 text-sm text-muted-foreground">This paper may have been removed or is not in the database.</p>
          <Link href="/discover">
            <Button className="mt-4" variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to discover
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const authorList = paper.authors || [];
  const doiUrl = paper.doi ? `https://doi.org/${paper.doi}` : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/discover" className="hover:text-foreground">Discover</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Paper details</span>
      </div>

      {/* Title + Actions */}
      <Card className="border-border/60">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{paper.source_provider}</Badge>
                {paper.is_open_access && <Badge className="bg-success/10 text-success border-success/20">Open Access</Badge>}
                {paper.publication_type && <Badge variant="secondary">{paper.publication_type.replace(/-/g, ' ')}</Badge>}
              </div>
              <h1 className="text-2xl font-bold tracking-tight">{paper.title}</h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                {authorList.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    {authorList.map((a) => a.name).join(', ')}
                  </span>
                )}
                {paper.publication_year && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" /> {paper.publication_year}
                  </span>
                )}
                {paper.venue && (
                  <span className="flex items-center gap-1.5">
                    <Building2 className="h-4 w-4" /> {paper.venue}
                  </span>
                )}
                {paper.citation_count !== null && (
                  <span className="flex items-center gap-1.5">
                    <Quote className="h-4 w-4" /> {paper.citation_count} citations
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <Button onClick={handleSave} disabled={saving} variant={isSaved ? 'secondary' : 'default'}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> :
                  isSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                <span className="ml-1.5">{isSaved ? 'Saved' : 'Save'}</span>
              </Button>
              {isSaved && (
                <Select value={readingStatus} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="to_read">To Read</SelectItem>
                    <SelectItem value="reading">Reading</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {doiUrl && (
                <a href={doiUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="w-full">
                    <ExternalLink className="h-4 w-4" /> DOI
                  </Button>
                </a>
              )}
              {paper.open_access_url && (
                <a href={paper.open_access_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="w-full">
                    <ExternalLink className="h-4 w-4" /> Open PDF
                  </Button>
                </a>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Abstract */}
      {paper.abstract && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Abstract</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">{paper.abstract}</p>
          </CardContent>
        </Card>
      )}

      {/* Authors */}
      {authorList.length > 0 && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Authors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {authorList.map((author, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {author.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </span>
                    <span className="text-sm font-medium">{author.name}</span>
                    {author.orcid && (
                      <Badge variant="outline" className="text-xs">ORCID</Badge>
                    )}
                  </div>
                  {author.affiliation && (
                    <span className="text-xs text-muted-foreground">{author.affiliation}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Concepts */}
      {paper.concepts && paper.concepts.length > 0 && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Research Concepts</CardTitle>
            <CardDescription>Topics and concepts associated with this paper</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {paper.concepts.map((concept) => (
                <Badge key={concept} variant="secondary" className="text-sm">
                  <Tag className="mr-1 h-3 w-3" /> {concept}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Chatbot */}
      <PaperChatbot paperId={paper.id} />

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Link href="/compare">
          <Button variant="outline">
            <FileText className="mr-2 h-4 w-4" /> Add to comparison
          </Button>
        </Link>
        <Link href="/workspace">
          <Button variant="outline">View in workspace</Button>
        </Link>
      </div>
    </div>
  );
}
