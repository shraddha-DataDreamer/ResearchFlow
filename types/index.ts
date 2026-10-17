export type Department =
  | 'Computer Science'
  | 'Information Technology'
  | 'Electronics and Communication'
  | 'Mechanical Engineering'
  | 'Civil Engineering'
  | 'Electrical Engineering'
  | 'Other';

export const DEPARTMENTS: Department[] = [
  'Computer Science',
  'Information Technology',
  'Electronics and Communication',
  'Mechanical Engineering',
  'Civil Engineering',
  'Electrical Engineering',
  'Other',
];

export type ReadingStatus = 'to_read' | 'reading' | 'completed';

export interface Paper {
  id: string;
  title: string;
  abstract: string | null;
  doi: string | null;
  source_id: string | null;
  source_provider: string;
  publication_year: number | null;
  publication_type: string | null;
  is_open_access: boolean | null;
  open_access_url: string | null;
  venue: string | null;
  citation_count: number | null;
  authors: PaperAuthor[];
  concepts: string[];
  created_at: string;
  updated_at: string;
}

export interface PaperAuthor {
  id: string;
  name: string;
  orcid: string | null;
  affiliation: string | null;
  position: number;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  department: Department | null;
  research_interests: string[];
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedPaper {
  id: string;
  user_id: string;
  paper_id: string;
  reading_status: ReadingStatus;
  created_at: string;
  paper: Paper;
}

export interface Note {
  id: string;
  user_id: string;
  paper_id: string | null;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface ReadingList {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  item_count?: number;
}

export interface SearchHistoryEntry {
  id: string;
  user_id: string;
  query: string;
  filters: Record<string, unknown>;
  result_count: number | null;
  created_at: string;
}

export interface ResearchTopic {
  id: string;
  user_id: string;
  topic: string;
  keywords: string[];
  department: Department | null;
  created_at: string;
  updated_at: string;
}

export interface SearchFilters {
  query: string;
  yearFrom?: number;
  yearTo?: number;
  publicationType?: string;
  openAccessOnly?: boolean;
  department?: Department;
}

export interface SearchResult {
  paper: Paper;
  relevanceScore: number;
  relevanceExplanation: string;
  source: 'local' | 'openalex' | 'crossref' | 'arxiv';
  isDuplicate?: boolean;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  perPage: number;
  sources: { name: string; success: boolean; count: number; error?: string }[];
  fallbackMode: boolean;
}

// ===== Stage 2 Types =====

export type ExtractionStatus = 'pending' | 'extracted' | 'failed' | 'scanned';

export interface UploadedDocument {
  id: string;
  user_id: string;
  filename: string;
  storage_path: string;
  file_size: number;
  page_count: number | null;
  extraction_status: ExtractionStatus;
  extracted_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaperPassage {
  id: string;
  document_id: string;
  passage_index: number;
  page_number: number | null;
  text: string;
  created_at: string;
}

export type AnalysisType = 'structured' | 'qa';
export type AnalysisStatus = 'pending' | 'complete' | 'failed';

export interface StructuredAnalysis {
  research_problem: string;
  objectives: string;
  proposed_approach: string;
  methodology: string;
  dataset: string;
  algorithms_technologies: string;
  main_findings: string;
  limitations: string;
  future_work: string;
}

export interface AnalysisRun {
  id: string;
  user_id: string;
  document_id: string;
  analysis_type: AnalysisType;
  status: AnalysisStatus;
  result: StructuredAnalysis | { answer: string; evidence: AnalysisEvidence[] } | null;
  question: string | null;
  created_at: string;
}

export interface AnalysisEvidence {
  id: string;
  analysis_run_id: string;
  passage_id: string | null;
  page_number: number | null;
  excerpt: string;
  relevance_score: number;
  created_at: string;
}

export interface PaperReference {
  id: string;
  source_paper_id: string;
  target_paper_id: string;
  reference_type: 'cites' | 'cited_by' | 'related';
  created_at: string;
}

export interface AlertSetting {
  id: string;
  user_id: string;
  topic: string;
  keywords: string[];
  filters: Record<string, unknown>;
  source: string;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlertCheck {
  id: string;
  alert_id: string;
  checked_at: string;
  new_paper_count: number;
  results: SearchResult[];
  created_at: string;
}

export interface ComparisonField {
  key: string;
  label: string;
}
