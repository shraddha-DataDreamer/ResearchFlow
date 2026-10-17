'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Table,
  Search,
  Download,
  Printer,
  Trash2,
  Plus,
  FileText,
  StickyNote,
  Save,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Paper } from '@/types';

interface MatrixPaper extends Paper {
  matrix_note?: string;
}

const MATRIX_COLUMNS = [
  { key: 'title', label: 'Title' },
  { key: 'authors', label: 'Authors' },
  { key: 'publication_year', label: 'Year' },
  { key: 'research_problem', label: 'Research Problem' },
  { key: 'objectives', label: 'Objectives' },
  { key: 'methodology', label: 'Methodology' },
  { key: 'dataset', label: 'Dataset' },
  { key: 'main_findings', label: 'Results' },
  { key: 'limitations', label: 'Limitations' },
  { key: 'future_work', label: 'Future Work' },
  { key: 'source_url', label: 'Source URL' },
];

export default function MatrixPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [savedPapers, setSavedPapers] = useState<MatrixPaper[]>([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('created_desc');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const fetchPapers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('saved_papers')
      .select('reading_status, paper:papers(*, paper_authors(*))')
      .order('created_at', { ascending: false });
    setSavedPapers((data || []).map((s: any) => s.paper as MatrixPaper));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPapers();
  }, [fetchPapers]);

  const handleSaveNote = async (paperId: string) => {
    setSavingNote(true);
    const { error } = await supabase
      .from('saved_papers')
      .update({ matrix_note: noteText })
      .eq('paper_id', paperId);
    setSavingNote(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setSavedPapers((prev) =>
      prev.map((p) => (p.id === paperId ? { ...p, matrix_note: noteText } : p))
    );
    setEditingNoteId(null);
    toast({ title: 'Note saved' });
  };

  const handleRemovePaper = async (paperId: string) => {
    const { error } = await supabase.from('saved_papers').delete().eq('paper_id', paperId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setSavedPapers((prev) => prev.filter((p) => p.id !== paperId));
    toast({ title: 'Removed', description: 'Paper removed from matrix.' });
  };

  const getCellValue = (paper: MatrixPaper, key: string): string => {
    if (key === 'authors') {
      return (paper as any).paper_authors?.map((a: any) => a.name).join(', ') || '';
    }
    if (key === 'source_url') {
      return paper.doi ? `https://doi.org/${paper.doi}` : paper.open_access_url || '';
    }
    if (key === 'title') return paper.title;
    if (key === 'publication_year') return paper.publication_year?.toString() || '';
    // Analysis fields not available from metadata alone
    return '';
  };

  const filtered = savedPapers.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.title.toLowerCase().includes(q) ||
      (p.abstract || '').toLowerCase().includes(q) ||
      (p.concepts || []).some((c) => c.toLowerCase().includes(q));
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'year_asc') return (a.publication_year || 0) - (b.publication_year || 0);
    if (sortBy === 'year_desc') return (b.publication_year || 0) - (a.publication_year || 0);
    if (sortBy === 'title_asc') return a.title.localeCompare(b.title);
    return 0;
  });

  const exportCSV = () => {
    if (sorted.length === 0) return;
    const headers = ['Title', 'Authors', 'Year', 'Research Problem', 'Objectives', 'Methodology', 'Dataset', 'Results', 'Limitations', 'Future Work', 'Source URL', 'Notes'];
    const rows = sorted.map((p) => [
      p.title,
      (p as any).paper_authors?.map((a: any) => a.name).join('; ') || '',
      p.publication_year || '',
      'Unavailable',
      'Unavailable',
      'Unavailable',
      'Unavailable',
      'Unavailable',
      'Unavailable',
      'Unavailable',
      p.doi ? `https://doi.org/${p.doi}` : p.open_access_url || '',
      p.matrix_note || '',
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'researchflow-literature-matrix.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: 'Matrix exported to CSV.' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Literature Matrix</h1>
        <p className="text-muted-foreground">Interactive research matrix with papers as rows and research fields as columns.</p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search matrix..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="created_desc">Most recent</SelectItem>
            <SelectItem value="year_asc">Year (oldest)</SelectItem>
            <SelectItem value="year_desc">Year (newest)</SelectItem>
            <SelectItem value="title_asc">Title (A-Z)</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={sorted.length === 0}>
          <Download className="mr-2 h-4 w-4" /> CSV
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()} disabled={sorted.length === 0}>
          <Printer className="mr-2 h-4 w-4" /> Print
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : sorted.length > 0 ? (
        <Card className="border-border/60 overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left font-semibold sticky left-0 bg-muted/50 z-10 min-w-[200px]">Title</th>
                  {MATRIX_COLUMNS.slice(1).map((col) => (
                    <th key={col.key} className="p-3 text-left font-semibold min-w-[150px] whitespace-nowrap">{col.label}</th>
                  ))}
                  <th className="p-3 text-left font-semibold min-w-[200px]">Notes</th>
                  <th className="p-3 text-center font-semibold w-16"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((paper, i) => (
                  <tr key={paper.id} className={i % 2 === 0 ? 'bg-muted/20' : ''}>
                    <td className="p-3 font-medium sticky left-0 z-10 bg-inherit">
                      <Link href={`/papers/${paper.id}`} className="hover:text-accent line-clamp-3">
                        {paper.title}
                      </Link>
                    </td>
                    {MATRIX_COLUMNS.slice(1).map((col) => {
                      const val = getCellValue(paper, col.key);
                      return (
                        <td key={col.key} className="p-3 align-top max-w-[250px]">
                          {col.key === 'source_url' && val ? (
                            <a href={val} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline inline-flex items-center gap-1">
                              <ExternalLink className="h-3 w-3" /> Link
                            </a>
                          ) : val ? (
                            <span className="line-clamp-3">{val}</span>
                          ) : (
                            <span className="italic text-muted-foreground/50">Unavailable</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-3 align-top">
                      {editingNoteId === paper.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            rows={3}
                            placeholder="Add your notes..."
                            className="text-xs"
                          />
                          <div className="flex gap-1">
                            <Button size="sm" className="h-7 text-xs" onClick={() => handleSaveNote(paper.id)} disabled={savingNote}>
                              {savingNote ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingNoteId(null)}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="cursor-pointer min-h-[40px] rounded hover:bg-muted/50 p-1"
                          onClick={() => { setEditingNoteId(paper.id); setNoteText(paper.matrix_note || ''); }}
                        >
                          {paper.matrix_note ? (
                            <p className="text-xs line-clamp-3">{paper.matrix_note}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground/50 flex items-center gap-1">
                              <StickyNote className="h-3 w-3" /> Click to add
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRemovePaper(paper.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Table className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No papers in matrix</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Save papers from Discover to add them to the literature matrix.
            </p>
            <Link href="/discover">
              <Button className="mt-4"><Plus className="mr-2 h-4 w-4" /> Discover papers</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/60 bg-muted/30">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <FileText className="inline h-3 w-3 mr-1" />
            Research fields (problem, objectives, methodology, etc.) show "Unavailable" for papers from OpenAlex metadata alone.
            Upload PDFs in AI Paper Analysis to extract structured content, which will populate these fields in future versions.
            Your personal notes are always editable and persisted.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
