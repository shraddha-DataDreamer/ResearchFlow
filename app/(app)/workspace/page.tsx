'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Bookmark,
  Search,
  FileText,
  StickyNote,
  ListChecks,
  Plus,
  Trash2,
  ExternalLink,
  Loader2,
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { unsavePaper, updateReadingStatus } from '@/lib/services/search';
import type { Paper, Note, ReadingList } from '@/types';

export default function WorkspacePage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [savedPapers, setSavedPapers] = useState<{ id: string; reading_status: string; paper: Paper }[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [readingLists, setReadingLists] = useState<ReadingList[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Note dialog
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Reading list dialog
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [listName, setListName] = useState('');
  const [listDesc, setListDesc] = useState('');
  const [savingList, setSavingList] = useState(false);

  const fetchWorkspace = useCallback(async () => {
    setLoading(true);
    const [savedRes, notesRes, listsRes] = await Promise.all([
      supabase.from('saved_papers').select('*, paper:papers(*, paper_authors(*))').order('created_at', { ascending: false }),
      supabase.from('notes').select('*').order('updated_at', { ascending: false }),
      supabase.from('reading_lists').select('*').order('created_at', { ascending: false }),
    ]);

    setSavedPapers((savedRes.data || []) as any);
    setNotes((notesRes.data || []) as Note[]);
    setReadingLists((listsRes.data || []) as ReadingList[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  const handleUnsave = async (paperId: string) => {
    const { error } = await unsavePaper(paperId);
    if (error) {
      toast({ title: 'Error', description: error, variant: 'destructive' });
      return;
    }
    setSavedPapers((prev) => prev.filter((s) => s.paper.id !== paperId));
    toast({ title: 'Removed', description: 'Paper removed from saved.' });
  };

  const handleStatusChange = async (paperId: string, status: string) => {
    await updateReadingStatus(paperId, status as 'to_read' | 'reading' | 'completed');
    setSavedPapers((prev) =>
      prev.map((s) => (s.paper.id === paperId ? { ...s, reading_status: status } : s))
    );
  };

  const handleSaveNote = async () => {
    if (!noteTitle.trim()) {
      toast({ title: 'Error', description: 'Note title is required.', variant: 'destructive' });
      return;
    }
    setSavingNote(true);
    const { data, error } = await supabase
      .from('notes')
      .insert({ title: noteTitle, content: noteContent })
      .select('*')
      .single();
    setSavingNote(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setNotes((prev) => [data as Note, ...prev]);
    setNoteTitle('');
    setNoteContent('');
    setNoteDialogOpen(false);
    toast({ title: 'Created', description: 'Note created successfully.' });
  };

  const handleDeleteNote = async (noteId: string) => {
    const { error } = await supabase.from('notes').delete().eq('id', noteId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    toast({ title: 'Deleted', description: 'Note deleted.' });
  };

  const handleSaveList = async () => {
    if (!listName.trim()) {
      toast({ title: 'Error', description: 'List name is required.', variant: 'destructive' });
      return;
    }
    setSavingList(true);
    const { data, error } = await supabase
      .from('reading_lists')
      .insert({ name: listName, description: listDesc || null })
      .select('*')
      .single();
    setSavingList(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setReadingLists((prev) => [data as ReadingList, ...prev]);
    setListName('');
    setListDesc('');
    setListDialogOpen(false);
    toast({ title: 'Created', description: 'Reading list created.' });
  };

  const handleDeleteList = async (listId: string) => {
    const { error } = await supabase.from('reading_lists').delete().eq('id', listId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setReadingLists((prev) => prev.filter((l) => l.id !== listId));
    toast({ title: 'Deleted', description: 'Reading list deleted.' });
  };

  const filteredPapers = savedPapers.filter((s) => {
    const matchesSearch = !search ||
      s.paper.title.toLowerCase().includes(search.toLowerCase()) ||
      (s.paper.abstract || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.reading_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusIcon = (status: string) => {
    if (status === 'completed') return <CheckCircle2 className="h-4 w-4 text-success" />;
    if (status === 'reading') return <Clock className="h-4 w-4 text-info" />;
    return <Circle className="h-4 w-4 text-muted-foreground" />;
  };

  const statusLabel = (status: string) => {
    if (status === 'to_read') return 'To Read';
    if (status === 'reading') return 'Reading';
    return 'Completed';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Workspace</h1>
        <p className="text-muted-foreground">Manage your saved papers, notes, and reading lists.</p>
      </div>

      <Tabs defaultValue="papers">
        <TabsList>
          <TabsTrigger value="papers">
            <Bookmark className="mr-2 h-4 w-4" /> Saved Papers ({savedPapers.length})
          </TabsTrigger>
          <TabsTrigger value="notes">
            <StickyNote className="mr-2 h-4 w-4" /> Notes ({notes.length})
          </TabsTrigger>
          <TabsTrigger value="lists">
            <ListChecks className="mr-2 h-4 w-4" /> Reading Lists ({readingLists.length})
          </TabsTrigger>
        </TabsList>

        {/* Saved Papers Tab */}
        <TabsContent value="papers" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search saved papers..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="to_read">To Read</SelectItem>
                <SelectItem value="reading">Reading</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}</div>
          ) : filteredPapers.length > 0 ? (
            <div className="space-y-3">
              {filteredPapers.map((s) => (
                <Card key={s.id} className="border-border/60 transition-shadow hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1.5">
                        <Link href={`/papers/${s.paper.id}`}>
                          <h3 className="font-medium leading-snug hover:text-accent transition-colors">{s.paper.title}</h3>
                        </Link>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {(s.paper as any).paper_authors?.slice(0, 3).map((a: any) => a.name).join(', ')}
                          {s.paper.publication_year && <span>· {s.paper.publication_year}</span>}
                          <Badge variant="outline" className="text-xs">{s.paper.source_provider}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {statusIcon(s.reading_status)}
                        <Select value={s.reading_status} onValueChange={(v) => handleStatusChange(s.paper.id, v)}>
                          <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="to_read">To Read</SelectItem>
                            <SelectItem value="reading">Reading</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="icon" variant="ghost" onClick={() => handleUnsave(s.paper.id)} title="Remove">
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-border/60">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Bookmark className="h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No saved papers yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">Search for papers and save them to your workspace.</p>
                <Link href="/discover">
                  <Button className="mt-4"><Search className="mr-2 h-4 w-4" /> Discover papers</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> New note</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create a note</DialogTitle>
                  <DialogDescription>Write down your thoughts, ideas, or observations.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="note-title">Title</Label>
                    <Input id="note-title" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="Note title" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="note-content">Content</Label>
                    <Textarea id="note-content" value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="Write your note here..." rows={6} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleSaveNote} disabled={savingNote}>
                    {savingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save note'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}</div>
          ) : notes.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {notes.map((note) => (
                <Card key={note.id} className="border-border/60">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{note.title}</CardTitle>
                      <Button size="icon" variant="ghost" onClick={() => handleDeleteNote(note.id)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                    <CardDescription>{new Date(note.updated_at).toLocaleDateString()}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground line-clamp-6">{note.content}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-border/60">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <StickyNote className="h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No notes yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">Create notes to organize your research observations.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Reading Lists Tab */}
        <TabsContent value="lists" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={listDialogOpen} onOpenChange={setListDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> New list</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create a reading list</DialogTitle>
                  <DialogDescription>Organize papers into themed reading lists.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="list-name">Name</Label>
                    <Input id="list-name" value={listName} onChange={(e) => setListName(e.target.value)} placeholder="e.g., Deep Learning Fundamentals" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="list-desc">Description (optional)</Label>
                    <Input id="list-desc" value={listDesc} onChange={(e) => setListDesc(e.target.value)} placeholder="What is this list about?" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setListDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleSaveList} disabled={savingList}>
                    {savingList ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create list'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}</div>
          ) : readingLists.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {readingLists.map((list) => (
                <Card key={list.id} className="border-border/60">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-accent" /> {list.name}
                        </CardTitle>
                        <CardDescription className="mt-1">{list.description || 'No description'}</CardDescription>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => handleDeleteList(list.id)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">Created {new Date(list.created_at).toLocaleDateString()}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-border/60">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <ListChecks className="h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No reading lists yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">Create reading lists to organize papers by theme or course.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
