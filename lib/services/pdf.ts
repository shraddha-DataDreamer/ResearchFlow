'use client';

import { supabase } from '@/lib/supabase/client';
import type { UploadedDocument, PaperPassage, ExtractionStatus } from '@/types';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const PASSAGE_SIZE = 800; // characters per passage
const PASSAGE_OVERLAP = 150; // overlap characters

export interface ExtractionResult {
  success: boolean;
  text: string;
  pageCount: number;
  pages: { pageNumber: number; text: string }[];
  isScanned: boolean;
  error?: string;
}

export function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
    return { valid: false, error: 'Only PDF files are supported.' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File size must not exceed 25 MB.' };
  }
  if (file.size === 0) {
    return { valid: false, error: 'File appears to be empty.' };
  }
  return { valid: true };
}

export async function extractPdfText(file: File): Promise<ExtractionResult> {
  try {
    const pdfjsLib: any = await import('pdfjs-dist/build/pdf.mjs');

    // Run pdf.js on the main thread (no web worker) to avoid bundler/CDN issues.
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'data:application/javascript;base64,';
    pdfjsLib.GlobalWorkerOptions.workerPort = null;

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      disableFontFace: true,
    });
    const pdf = await loadingTask.promise;
    const pages: { pageNumber: number; text: string }[] = [];
    let fullText = '';
    let totalExtracted = 0;

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      pages.push({ pageNumber: i, text: pageText });
      fullText += `\n[Page ${i}]\n${pageText}\n`;
      totalExtracted += pageText.length;
    }

    const isScanned = totalExtracted < 50 && pdf.numPages > 0;

    return {
      success: true,
      text: fullText,
      pageCount: pdf.numPages,
      pages,
      isScanned,
    };
  } catch (err: any) {
    return {
      success: false,
      text: '',
      pageCount: 0,
      pages: [],
      isScanned: false,
      error: err?.message || 'Failed to extract text from PDF.',
    };
  }
}

export function createPassages(pages: { pageNumber: number; text: string }[]): Omit<PaperPassage, 'id' | 'document_id' | 'created_at'>[] {
  const passages: Omit<PaperPassage, 'id' | 'document_id' | 'created_at'>[] = [];
  let index = 0;

  for (const page of pages) {
    if (!page.text || page.text.length < 20) continue;
    let start = 0;
    while (start < page.text.length) {
      const end = Math.min(start + PASSAGE_SIZE, page.text.length);
      const chunk = page.text.slice(start, end);
      passages.push({
        passage_index: index++,
        page_number: page.pageNumber,
        text: chunk,
      });
      if (end >= page.text.length) break;
      start = end - PASSAGE_OVERLAP;
    }
  }
  return passages;
}

export async function uploadDocument(file: File): Promise<{ document: UploadedDocument | null; error: string | null }> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user?.id;
  if (!userId) return { document: null, error: 'Not authenticated.' };

  const validation = validateFile(file);
  if (!validation.valid) return { document: null, error: validation.error! };

  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;

  // Upload to private storage
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(fileName, file, { contentType: 'application/pdf' });

  if (uploadError) return { document: null, error: uploadError.message };

  // Create document record
  const { data, error: dbError } = await supabase
    .from('uploaded_documents')
    .insert({
      filename: file.name,
      storage_path: fileName,
      file_size: file.size,
      extraction_status: 'pending',
    })
    .select('*')
    .single();

  if (dbError) return { document: null, error: dbError.message };

  return { document: data as UploadedDocument, error: null };
}

export async function processDocument(documentId: string, file: File): Promise<{ error: string | null; isScanned: boolean }> {
  // Extract text
  const extraction = await extractPdfText(file);

  if (!extraction.success) {
    await supabase
      .from('uploaded_documents')
      .update({ extraction_status: 'failed' })
      .eq('id', documentId);
    return { error: extraction.error || 'Extraction failed.', isScanned: false };
  }

  if (extraction.isScanned) {
    await supabase
      .from('uploaded_documents')
      .update({
        extraction_status: 'scanned',
        page_count: extraction.pageCount,
      })
      .eq('id', documentId);
    return { error: null, isScanned: true };
  }

  // Update document with extracted text
  await supabase
    .from('uploaded_documents')
    .update({
      extraction_status: 'extracted',
      extracted_text: extraction.text,
      page_count: extraction.pageCount,
    })
    .eq('id', documentId);

  // Create and store passages
  const passages = createPassages(extraction.pages);
  if (passages.length > 0) {
    await supabase.from('paper_passages').insert(
      passages.map((p) => ({
        document_id: documentId,
        passage_index: p.passage_index,
        page_number: p.page_number,
        text: p.text,
      }))
    );
  }

  return { error: null, isScanned: false };
}

export async function getUserDocuments(): Promise<UploadedDocument[]> {
  const { data } = await supabase
    .from('uploaded_documents')
    .select('*')
    .order('created_at', { ascending: false });
  return (data || []) as UploadedDocument[];
}

export async function deleteDocument(documentId: string, storagePath: string): Promise<{ error: string | null }> {
  await supabase.storage.from('documents').remove([storagePath]);
  const { error } = await supabase.from('uploaded_documents').delete().eq('id', documentId);
  return { error: error?.message || null };
}

export async function getDocumentPassages(documentId: string): Promise<PaperPassage[]> {
  const { data } = await supabase
    .from('paper_passages')
    .select('*')
    .eq('document_id', documentId)
    .order('passage_index', { ascending: true });
  return (data || []) as PaperPassage[];
}

// Basic extractive analysis (no AI needed) — finds sentences matching structured fields
export function basicExtractiveAnalysis(text: string): Record<string, string> {
  const sections: Record<string, string> = {
    research_problem: '',
    objectives: '',
    proposed_approach: '',
    methodology: '',
    dataset: '',
    algorithms_technologies: '',
    main_findings: '',
    limitations: '',
    future_work: '',
  };

  const lowerText = text.toLowerCase();
  // Split into sentences, preserving longer ones that carry more information
  const sentences = text
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .filter((s) => s.trim().length > 25);

  const fieldKeywords: Record<string, string[]> = {
    research_problem: ['problem', 'challenge', 'issue', 'gap', 'aim of this', 'objective of this', 'we address', 'motivat', 'in this paper we', 'the main goal', 'increasingly important', 'remains an open'],
    objectives: ['objective', 'goal', 'aim', 'purpose', 'we propose', 'we aim', 'our goal', 'we seek to', 'the purpose of this', 'specifically we', 'contribute'],
    proposed_approach: ['approach', 'propose', 'method', 'solution', 'framework', 'system', 'model', 'architecture', 'we introduce', 'we present', 'we develop', 'novel', 'pipeline'],
    methodology: ['methodology', 'method', 'procedure', 'experiment', 'evaluation', 'pipeline', 'architecture', 'training', 'implementation', 'experimental setup', 'data collection', 'analysis', 'statistical'],
    dataset: ['dataset', 'data set', 'corpus', 'benchmark', 'training data', 'samples', 'collected', 'labeled', 'annotated', 'ground truth', 'test set', 'validation'],
    algorithms_technologies: ['algorithm', 'neural network', 'deep learning', 'transformer', 'cnn', 'rnn', 'lstm', 'bert', 'gpt', 'machine learning', 'classifier', 'embedding', 'attention', 'encoder', 'decoder', 'convolutional', 'recurrent'],
    main_findings: ['result', 'finding', 'show', 'demonstrate', 'achieve', 'outperform', 'accuracy', 'f1', 'precision', 'recall', 'significantly', 'improve', 'performance', 'experiment', 'evaluation result'],
    limitations: ['limitation', 'drawback', 'shortcoming', 'restrict', 'however', 'fail', 'cannot', 'unable', 'does not', 'do not', 'challenge', 'difficulty', 'constraint', 'bottleneck'],
    future_work: ['future work', 'future research', 'future direction', 'further', 'next step', 'plan to', 'will extend', 'future', 'ongoing', 'extend our', 'investigate further'],
  };

  for (const [field, keywords] of Object.entries(fieldKeywords)) {
    const matched: { sentence: string; score: number }[] = [];
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      const matchCount = keywords.filter((kw) => lowerSentence.includes(kw)).length;
      if (matchCount > 0) {
        matched.push({ sentence: sentence.trim(), score: matchCount });
      }
    }
    const top = matched
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((m) => m.sentence);
    sections[field] = top.join(' ') || 'Not stated or not found in the extracted text.';
  }

  return sections;
}

// Keyword-based passage retrieval for RAG fallback
export function retrieveRelevantPassages(
  question: string,
  passages: PaperPassage[],
  topK: number = 5
): { passage: PaperPassage; score: number }[] {
  const questionTokens = new Set(
    question.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2)
  );

  if (questionTokens.size === 0 || passages.length === 0) return [];

  const scored = passages.map((p) => {
    const passageTokens = new Set(
      p.text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2)
    );
    let matches = 0;
    questionTokens.forEach((token) => {
      if (passageTokens.has(token)) matches++;
    });
    return { passage: p, score: matches / questionTokens.size };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// Basic extractive Q&A — finds most relevant passages and constructs an answer
export function basicExtractiveQA(question: string, passages: PaperPassage[]): {
  answer: string;
  evidence: { excerpt: string; page_number: number | null; relevance_score: number }[];
} {
  const relevant = retrieveRelevantPassages(question, passages, 5);

  if (relevant.length === 0) {
    return {
      answer: 'Insufficient evidence found in the document to answer this question. The document may not contain information about this topic, or the text extraction may have been incomplete.',
      evidence: [],
    };
  }

  // Extract the most relevant sentences from top passages
  const answerParts: string[] = [];
  const evidence: { excerpt: string; page_number: number | null; relevance_score: number }[] = [];

  for (const { passage, score } of relevant.slice(0, 3)) {
    const sentences = passage.text.split(/[.!?]+/).filter((s) => s.trim().length > 15);
    const questionTokens = new Set(
      question.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2)
    );

    // Find best sentence in passage
    let bestSentence = '';
    let bestMatch = 0;
    for (const sentence of sentences) {
      const sentenceTokens = new Set(
        sentence.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2)
      );
      let matches = 0;
      questionTokens.forEach((token) => {
        if (sentenceTokens.has(token)) matches++;
      });
      if (matches > bestMatch) {
        bestMatch = matches;
        bestSentence = sentence.trim();
      }
    }

    if (bestSentence) {
      answerParts.push(bestSentence);
    }
    evidence.push({
      excerpt: passage.text.slice(0, 300) + (passage.text.length > 300 ? '...' : ''),
      page_number: passage.page_number,
      relevance_score: score,
    });
  }

  return {
    answer: answerParts.join('. ') || 'The document contains related content, but no specific answer was found for this question.',
    evidence,
  };
}
