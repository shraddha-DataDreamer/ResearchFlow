'use client';

import { supabase } from '@/lib/supabase/client';
import { basicExtractiveAnalysis, basicExtractiveQA, retrieveRelevantPassages, getDocumentPassages } from '@/lib/services/pdf';
import type { UploadedDocument, AnalysisRun, StructuredAnalysis, PaperPassage } from '@/types';

export async function getAnalysisRuns(documentId: string): Promise<AnalysisRun[]> {
  const { data } = await supabase
    .from('analysis_runs')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false });
  return (data || []) as AnalysisRun[];
}

export async function runStructuredAnalysis(document: UploadedDocument): Promise<{ run: AnalysisRun | null; error: string | null }> {
  if (!document.extracted_text) {
    return { run: null, error: 'Document text has not been extracted yet.' };
  }

  // Use basic extractive analysis (no AI key configured)
  const result = basicExtractiveAnalysis(document.extracted_text);

  const { data, error } = await supabase
    .from('analysis_runs')
    .insert({
      document_id: document.id,
      analysis_type: 'structured',
      status: 'complete',
      result: result as any,
    })
    .select('*')
    .single();

  if (error) return { run: null, error: error.message };
  return { run: data as AnalysisRun, error: null };
}

export async function runQA(
  document: UploadedDocument,
  question: string
): Promise<{ run: AnalysisRun | null; error: string | null }> {
  if (!document.extracted_text) {
    return { run: null, error: 'Document text has not been extracted yet.' };
  }
  if (question.trim().length < 3) {
    return { run: null, error: 'Question must be at least 3 characters.' };
  }

  // Get passages for retrieval
  const passages = await getDocumentPassages(document.id);
  let qaResult: { answer: string; evidence: { excerpt: string; page_number: number | null; relevance_score: number }[] };

  if (passages.length > 0) {
    qaResult = basicExtractiveQA(question, passages);
  } else {
    // Fallback: search directly in extracted text
    const fakePassages: PaperPassage[] = [{
      id: '0',
      document_id: document.id,
      passage_index: 0,
      page_number: 1,
      text: document.extracted_text.slice(0, 2000),
      created_at: '',
    }];
    qaResult = basicExtractiveQA(question, fakePassages);
  }

  const { data, error } = await supabase
    .from('analysis_runs')
    .insert({
      document_id: document.id,
      analysis_type: 'qa',
      status: 'complete',
      question,
      result: qaResult as any,
    })
    .select('*')
    .single();

  if (error) return { run: null, error: error.message };

  // Store evidence
  if (qaResult.evidence.length > 0) {
    await supabase.from('analysis_evidence').insert(
      qaResult.evidence.map((e) => ({
        analysis_run_id: (data as AnalysisRun).id,
        page_number: e.page_number,
        excerpt: e.excerpt,
        relevance_score: e.relevance_score,
      }))
    );
  }

  return { run: data as AnalysisRun, error: null };
}

export const ANALYSIS_SECTIONS: { key: keyof StructuredAnalysis; label: string }[] = [
  { key: 'research_problem', label: 'Research Problem' },
  { key: 'objectives', label: 'Objectives' },
  { key: 'proposed_approach', label: 'Proposed Approach' },
  { key: 'methodology', label: 'Methodology' },
  { key: 'dataset', label: 'Dataset' },
  { key: 'algorithms_technologies', label: 'Algorithms / Technologies' },
  { key: 'main_findings', label: 'Main Findings' },
  { key: 'limitations', label: 'Limitations' },
  { key: 'future_work', label: 'Future Work' },
];
