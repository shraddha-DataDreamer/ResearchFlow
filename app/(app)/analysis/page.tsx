'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Upload,
  FileText,
  Loader2,
  Trash2,
  Microscope,
  MessageSquare,
  Send,
  AlertCircle,
  FileSearch,
  CheckCircle2,
  XCircle,
  Eye,
  ChevronDown,
  ChevronRight,
  Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { validateFile, uploadDocument, processDocument, getUserDocuments, deleteDocument } from '@/lib/services/pdf';
import { runStructuredAnalysis, runQA, getAnalysisRuns, ANALYSIS_SECTIONS } from '@/lib/services/analysis';
import type { UploadedDocument, AnalysisRun } from '@/types';

export default function AnalysisPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<UploadedDocument | null>(null);
  const [analysisRuns, setAnalysisRuns] = useState<AnalysisRun[]>([]);
  const [structuredResult, setStructuredResult] = useState<Record<string, string> | null>(null);
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [question, setQuestion] = useState('');
  const [qaHistory, setQaHistory] = useState<{ question: string; answer: string; evidence: { excerpt: string; page_number: number | null }[] }[]>([]);
  const [asking, setAsking] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    const docs = await getUserDocuments();
    setDocuments(docs);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const validation = validateFile(file);
    if (!validation.valid) {
      toast({ title: 'Invalid file', description: validation.error, variant: 'destructive' });
      return;
    }

    setUploading(true);
    const { document, error } = await uploadDocument(file);
    setUploading(false);

    if (error || !document) {
      toast({ title: 'Upload failed', description: error || 'Unknown error', variant: 'destructive' });
      return;
    }

    // Process: extract text
    setProcessing(true);
    const { error: procError, isScanned } = await processDocument(document.id, file);
    setProcessing(false);

    if (procError) {
      toast({ title: 'Processing failed', description: procError, variant: 'destructive' });
    } else if (isScanned) {
      toast({
        title: 'Scanned PDF detected',
        description: 'This PDF appears to be scanned images. OCR is required for text extraction, which is not yet available.',
      });
    } else {
      toast({ title: 'Document ready', description: 'Text extracted successfully. You can now analyze it.' });
    }

    await fetchDocuments();
  };

  const handleDeleteDoc = async (doc: UploadedDocument) => {
    const { error } = await deleteDocument(doc.id, doc.storage_path);
    if (error) {
      toast({ title: 'Error', description: error, variant: 'destructive' });
      return;
    }
    if (selectedDoc?.id === doc.id) {
      setSelectedDoc(null);
      setStructuredResult(null);
      setQaHistory([]);
    }
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    toast({ title: 'Deleted', description: 'Document removed.' });
  };

  const handleSelectDoc = async (doc: UploadedDocument) => {
    setSelectedDoc(doc);
    setStructuredResult(null);
    setQaHistory([]);
    const runs = await getAnalysisRuns(doc.id);
    setAnalysisRuns(runs);

    // Load latest structured analysis
    const structured = runs.find((r) => r.analysis_type === 'structured' && r.status === 'complete');
    if (structured) {
      setStructuredResult(structured.result as unknown as Record<string, string>);
    }

    // Load Q&A history
    const qaRuns = runs.filter((r) => r.analysis_type === 'qa' && r.status === 'complete');
    setQaHistory(
      qaRuns.map((r) => {
        const result = r.result as { answer: string; evidence: { excerpt: string; page_number: number | null }[] };
        return { question: r.question || '', answer: result.answer, evidence: result.evidence };
      })
    );
  };

  const handleRunAnalysis = async () => {
    if (!selectedDoc) return;
    setRunningAnalysis(true);
    const { run, error } = await runStructuredAnalysis(selectedDoc);
    setRunningAnalysis(false);
    if (error) {
      toast({ title: 'Analysis failed', description: error, variant: 'destructive' });
      return;
    }
    if (run) {
      setStructuredResult(run.result as unknown as Record<string, string>);
      toast({ title: 'Analysis complete', description: 'Structured analysis generated using extractive methods.' });
    }
  };

  const handleAskQuestion = async () => {
    if (!selectedDoc || !question.trim()) return;
    const q = question.trim();
    setQuestion('');
    setAsking(true);
    const { run, error } = await runQA(selectedDoc, q);
    setAsking(false);
    if (error) {
      toast({ title: 'Error', description: error, variant: 'destructive' });
      return;
    }
    if (run) {
      const result = run.result as { answer: string; evidence: { excerpt: string; page_number: number | null }[] };
      setQaHistory((prev) => [...prev, { question: q, answer: result.answer, evidence: result.evidence }]);
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'extracted') return <Badge className="bg-success/10 text-success border-success/20"><CheckCircle2 className="mr-1 h-3 w-3" /> Extracted</Badge>;
    if (status === 'pending') return <Badge variant="secondary"><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Pending</Badge>;
    if (status === 'failed') return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" /> Failed</Badge>;
    if (status === 'scanned') return <Badge className="bg-warning/10 text-warning border-warning/20"><AlertCircle className="mr-1 h-3 w-3" /> Scanned</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Paper Analysis</h1>
        <p className="text-muted-foreground">Upload PDFs, extract text, get structured summaries, and ask questions.</p>
      </div>

      {/* Consent notice */}
      {!consentGiven && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="flex items-start gap-3 p-4">
            <Info className="h-5 w-5 shrink-0 text-warning mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">Privacy notice</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Uploaded PDFs are stored privately in your account and cannot be accessed by other users.
                Text extraction runs in your browser. Analysis uses keyword-based methods and
                does not send your document content to external services.
              </p>
              <Button size="sm" className="mt-3" onClick={() => setConsentGiven(true)}>
                I understand
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Left: Upload + Document list */}
        <div className="space-y-4">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Upload PDF</CardTitle>
              <CardDescription>Max 25 MB. Text-based PDFs only.</CardDescription>
            </CardHeader>
            <CardContent>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                className="w-full"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || processing || !consentGiven}
              >
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {uploading ? 'Uploading...' : processing ? 'Processing...' : 'Choose PDF file'}
              </Button>
              {processing && (
                <p className="mt-2 text-xs text-muted-foreground">Extracting text from PDF...</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">My Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-16" />)}</div>
              ) : documents.length > 0 ? (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className={`group rounded-lg border p-3 transition-colors cursor-pointer ${
                        selectedDoc?.id === doc.id ? 'border-accent bg-accent/5' : 'border-border/60 hover:bg-muted/50'
                      }`}
                      onClick={() => handleSelectDoc(doc)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{doc.filename}</p>
                            <div className="mt-1 flex items-center gap-2">
                              {statusBadge(doc.extraction_status)}
                              {doc.page_count && <span className="text-xs text-muted-foreground">{doc.page_count}p</span>}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="opacity-0 group-hover:opacity-100 shrink-0 h-7 w-7"
                          onClick={(e) => { e.stopPropagation(); handleDeleteDoc(doc); }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">No documents uploaded yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Analysis area */}
        <div className="space-y-4">
          {!selectedDoc ? (
            <Card className="border-border/60">
              <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                <FileSearch className="h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">Select a document to analyze</h3>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  Upload a PDF and select it from the list to view structured analysis and ask questions.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Document info */}
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-accent" />
                      <div>
                        <p className="font-medium">{selectedDoc.filename}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {statusBadge(selectedDoc.extraction_status)}
                          {selectedDoc.page_count && <span className="text-xs text-muted-foreground">{selectedDoc.page_count} pages</span>}
                          <span className="text-xs text-muted-foreground">{(selectedDoc.file_size / 1024 / 1024).toFixed(1)} MB</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {selectedDoc.extraction_status === 'scanned' && (
                <Card className="border-warning/30 bg-warning/5">
                  <CardContent className="flex items-start gap-3 p-4">
                    <AlertCircle className="h-5 w-5 shrink-0 text-warning mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Scanned PDF — OCR required</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        This PDF contains images rather than extractable text. Optical Character Recognition (OCR)
                        is required to extract text. OCR is not yet available in ResearchFlow.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {selectedDoc.extraction_status === 'failed' && (
                <Card className="border-destructive/30 bg-destructive/5">
                  <CardContent className="flex items-start gap-3 p-4">
                    <XCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Text extraction failed</p>
                      <p className="mt-1 text-sm text-muted-foreground">The PDF could not be processed. Try a different file.</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {selectedDoc.extraction_status === 'extracted' && (
                <>
                  {/* Structured Analysis */}
                  <Card className="border-border/60">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Microscope className="h-4 w-4 text-accent" /> Structured Analysis
                          </CardTitle>
                          <CardDescription className="mt-1">
                            Extractive analysis using keyword matching. No external service used.
                          </CardDescription>
                        </div>
                        <Button size="sm" onClick={handleRunAnalysis} disabled={runningAnalysis}>
                          {runningAnalysis ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Microscope className="mr-2 h-4 w-4" />}
                          {structuredResult ? 'Re-run' : 'Generate'}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {runningAnalysis ? (
                        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
                      ) : structuredResult ? (
                        <div className="space-y-4">
                          {ANALYSIS_SECTIONS.map((section) => (
                            <div key={section.key}>
                              <p className="text-sm font-semibold text-foreground">{section.label}</p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {structuredResult[section.key] === 'Not stated or not found in the extracted text.' ? (
                                  <span className="italic text-muted-foreground/70">Not stated or not found in the extracted text.</span>
                                ) : (
                                  structuredResult[section.key]
                                )}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="py-4 text-center text-sm text-muted-foreground">
                          Click "Generate" to extract structured information from this document.
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Q&A Chat */}
                  <Card className="border-border/60">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-accent" /> Ask Questions
                      </CardTitle>
                      <CardDescription>
                        Ask questions about the document. Answers are based on retrieved passages with evidence.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Q&A history */}
                        {qaHistory.length > 0 && (
                          <ScrollArea className="max-h-[400px] pr-4">
                            <div className="space-y-4">
                              {qaHistory.map((qa, i) => (
                                <div key={i} className="space-y-2">
                                  <div className="rounded-lg bg-accent/10 px-3 py-2">
                                    <p className="text-sm font-medium">{qa.question}</p>
                                  </div>
                                  <div className="rounded-lg border bg-card px-3 py-2">
                                    <p className="text-sm">{qa.answer}</p>
                                  </div>
                                  {qa.evidence.length > 0 && (
                                    <div className="ml-4 space-y-1.5">
                                      <p className="text-xs font-medium text-muted-foreground">Supporting evidence:</p>
                                      {qa.evidence.map((ev, j) => (
                                        <div key={j} className="rounded border border-border/60 bg-muted/30 p-2">
                                          <p className="text-xs italic text-muted-foreground">"{ev.excerpt}"</p>
                                          {ev.page_number && (
                                            <Badge variant="outline" className="mt-1 text-xs">Page {ev.page_number}</Badge>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        )}

                        {/* Input */}
                        <div className="flex gap-2">
                          <Input
                            placeholder="Ask a question about this document..."
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleAskQuestion(); }}
                            disabled={asking}
                          />
                          <Button onClick={handleAskQuestion} disabled={asking || !question.trim()}>
                            {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          </Button>
                        </div>
                        {qaHistory.length === 0 && (
                          <p className="text-xs text-muted-foreground">
                            Try: "What is the research problem?", "What methodology was used?", "What are the main findings?"
                          </p>
                        )}
                      </div>
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
