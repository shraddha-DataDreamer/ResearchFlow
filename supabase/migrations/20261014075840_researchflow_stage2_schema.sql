/*
# ResearchFlow Stage 2-5 Schema Extension

## Overview
Extends the core schema with tables for PDF analysis, citations, alerts,
recently viewed papers, and comparison/matrix support. All user-owned tables
have RLS with auth.uid() ownership checks.

## New Tables

1. **uploaded_documents** — User's uploaded PDF files
   - id, user_id (DEFAULT auth.uid()), filename, storage_path, file_size,
     page_count, extraction_status ('pending'|'extracted'|'failed'|'scanned'),
   - extracted_text (full text for basic analysis), created_at, updated_at

2. **paper_passages** — Chunked passages from uploaded documents for RAG
   - id, document_id (FK uploaded_documents CASCADE), passage_index,
     page_number, text, embedding (vector(1536) if pgvector available),
   - created_at

3. **analysis_runs** — Structured AI analysis results for a document
   - id, user_id (DEFAULT auth.uid()), document_id (FK CASCADE),
   - analysis_type ('structured'|'qa'), status ('pending'|'complete'|'failed'),
   - result (jsonb — structured analysis sections or Q&A response),
   - question (text, for Q&A runs), created_at

4. **analysis_evidence** — Supporting evidence for analysis answers
   - id, analysis_run_id (FK analysis_runs CASCADE), passage_id (FK paper_passages CASCADE),
   - page_number, excerpt, relevance_score, created_at

5. **paper_references** — Citation relationships between papers
   - id, source_paper_id (FK papers CASCADE), target_paper_id (FK papers CASCADE),
   - reference_type ('cites'|'cited_by'|'related'), created_at
   - Unique on (source_paper_id, target_paper_id, reference_type)

6. **recently_viewed** — Track recently viewed papers per user
   - id, user_id (DEFAULT auth.uid()), paper_id (FK papers CASCADE),
   - viewed_at, UNIQUE (user_id, paper_id)

7. **alert_settings** — User's saved topic alert configurations
   - id, user_id (DEFAULT auth.uid()), topic, keywords (text[]),
   - filters (jsonb), source (text), last_checked_at, created_at, updated_at

8. **alert_checks** — Results from alert checks
   - id, alert_id (FK alert_settings CASCADE), checked_at,
   - new_paper_count, results (jsonb — array of paper summaries), created_at

9. **comparison_selections** — User's saved comparison selections (optional persistent)
   - id, user_id (DEFAULT auth.uid()), paper_ids (uuid[]), created_at

## Security
- All user-owned tables: owner-scoped CRUD with auth.uid() = user_id
- paper_references: read-only for authenticated (shared citation metadata)
- paper_passages: read-only for authenticated, scoped through document ownership
- analysis_runs + analysis_evidence: owner-scoped through user_id or document ownership

## Notes
- pgvector extension is enabled if available; embedding column uses vector(1536)
- If pgvector is not available, the embedding column is omitted and semantic
  search falls back to keyword-based retrieval
*/

-- Enable pgvector if available
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- UPLOADED DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS uploaded_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  filename text NOT NULL,
  storage_path text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  page_count int,
  extraction_status text NOT NULL DEFAULT 'pending',
  extracted_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE uploaded_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_documents" ON uploaded_documents;
CREATE POLICY "select_own_documents" ON uploaded_documents
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_documents" ON uploaded_documents;
CREATE POLICY "insert_own_documents" ON uploaded_documents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_documents" ON uploaded_documents;
CREATE POLICY "update_own_documents" ON uploaded_documents
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_documents" ON uploaded_documents;
CREATE POLICY "delete_own_documents" ON uploaded_documents
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_uploaded_documents_user_id ON uploaded_documents(user_id);

-- ============================================================
-- PAPER PASSAGES (chunks for RAG)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    CREATE TABLE IF NOT EXISTS paper_passages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id uuid NOT NULL REFERENCES uploaded_documents(id) ON DELETE CASCADE,
      passage_index int NOT NULL DEFAULT 0,
      page_number int,
      text text NOT NULL,
      embedding vector(1536),
      created_at timestamptz NOT NULL DEFAULT now()
    );
  ELSE
    CREATE TABLE IF NOT EXISTS paper_passages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id uuid NOT NULL REFERENCES uploaded_documents(id) ON DELETE CASCADE,
      passage_index int NOT NULL DEFAULT 0,
      page_number int,
      text text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;

ALTER TABLE paper_passages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_passages" ON paper_passages;
CREATE POLICY "select_own_passages" ON paper_passages
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM uploaded_documents WHERE uploaded_documents.id = paper_passages.document_id AND uploaded_documents.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_passages" ON paper_passages;
CREATE POLICY "insert_own_passages" ON paper_passages
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM uploaded_documents WHERE uploaded_documents.id = paper_passages.document_id AND uploaded_documents.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_passages" ON paper_passages;
CREATE POLICY "delete_own_passages" ON paper_passages
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM uploaded_documents WHERE uploaded_documents.id = paper_passages.document_id AND uploaded_documents.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_paper_passages_document_id ON paper_passages(document_id);

-- ============================================================
-- ANALYSIS RUNS
-- ============================================================
CREATE TABLE IF NOT EXISTS analysis_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id uuid REFERENCES uploaded_documents(id) ON DELETE CASCADE,
  analysis_type text NOT NULL DEFAULT 'structured',
  status text NOT NULL DEFAULT 'pending',
  result jsonb,
  question text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE analysis_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_analysis" ON analysis_runs;
CREATE POLICY "select_own_analysis" ON analysis_runs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_analysis" ON analysis_runs;
CREATE POLICY "insert_own_analysis" ON analysis_runs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_analysis" ON analysis_runs;
CREATE POLICY "update_own_analysis" ON analysis_runs
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_analysis" ON analysis_runs;
CREATE POLICY "delete_own_analysis" ON analysis_runs
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_analysis_runs_user_id ON analysis_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_document_id ON analysis_runs(document_id);

-- ============================================================
-- ANALYSIS EVIDENCE
-- ============================================================
CREATE TABLE IF NOT EXISTS analysis_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_run_id uuid NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  passage_id uuid REFERENCES paper_passages(id) ON DELETE SET NULL,
  page_number int,
  excerpt text NOT NULL,
  relevance_score float DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE analysis_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_evidence" ON analysis_evidence;
CREATE POLICY "select_own_evidence" ON analysis_evidence
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM analysis_runs WHERE analysis_runs.id = analysis_evidence.analysis_run_id AND analysis_runs.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_evidence" ON analysis_evidence;
CREATE POLICY "insert_own_evidence" ON analysis_evidence
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM analysis_runs WHERE analysis_runs.id = analysis_evidence.analysis_run_id AND analysis_runs.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_evidence" ON analysis_evidence;
CREATE POLICY "delete_own_evidence" ON analysis_evidence
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM analysis_runs WHERE analysis_runs.id = analysis_evidence.analysis_run_id AND analysis_runs.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_analysis_evidence_run_id ON analysis_evidence(analysis_run_id);

-- ============================================================
-- PAPER REFERENCES (shared citation metadata)
-- ============================================================
CREATE TABLE IF NOT EXISTS paper_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_paper_id uuid NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  target_paper_id uuid NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  reference_type text NOT NULL DEFAULT 'cites',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_paper_ref UNIQUE (source_paper_id, target_paper_id, reference_type)
);

ALTER TABLE paper_references ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_paper_references" ON paper_references;
CREATE POLICY "read_paper_references" ON paper_references
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_paper_references_source ON paper_references(source_paper_id);
CREATE INDEX IF NOT EXISTS idx_paper_references_target ON paper_references(target_paper_id);

-- ============================================================
-- RECENTLY VIEWED
-- ============================================================
CREATE TABLE IF NOT EXISTS recently_viewed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  paper_id uuid NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_recently_viewed UNIQUE (user_id, paper_id)
);

ALTER TABLE recently_viewed ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_recently_viewed" ON recently_viewed;
CREATE POLICY "select_own_recently_viewed" ON recently_viewed
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_recently_viewed" ON recently_viewed;
CREATE POLICY "insert_own_recently_viewed" ON recently_viewed
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_recently_viewed" ON recently_viewed;
CREATE POLICY "delete_own_recently_viewed" ON recently_viewed
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_recently_viewed_user_id ON recently_viewed(user_id);

-- ============================================================
-- ALERT SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS alert_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  topic text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  filters jsonb NOT NULL DEFAULT '{}',
  source text NOT NULL DEFAULT 'openalex',
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE alert_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_alerts" ON alert_settings;
CREATE POLICY "select_own_alerts" ON alert_settings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_alerts" ON alert_settings;
CREATE POLICY "insert_own_alerts" ON alert_settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_alerts" ON alert_settings;
CREATE POLICY "update_own_alerts" ON alert_settings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_alerts" ON alert_settings;
CREATE POLICY "delete_own_alerts" ON alert_settings
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_alert_settings_user_id ON alert_settings(user_id);

-- ============================================================
-- ALERT CHECKS
-- ============================================================
CREATE TABLE IF NOT EXISTS alert_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES alert_settings(id) ON DELETE CASCADE,
  checked_at timestamptz NOT NULL DEFAULT now(),
  new_paper_count int NOT NULL DEFAULT 0,
  results jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE alert_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_alert_checks" ON alert_checks;
CREATE POLICY "select_own_alert_checks" ON alert_checks
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM alert_settings WHERE alert_settings.id = alert_checks.alert_id AND alert_settings.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_alert_checks" ON alert_checks;
CREATE POLICY "insert_own_alert_checks" ON alert_checks
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM alert_settings WHERE alert_settings.id = alert_checks.alert_id AND alert_settings.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_alert_checks" ON alert_checks;
CREATE POLICY "delete_own_alert_checks" ON alert_checks
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM alert_settings WHERE alert_settings.id = alert_checks.alert_id AND alert_settings.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_alert_checks_alert_id ON alert_checks(alert_id);

-- ============================================================
-- COMPARISON SELECTIONS (persistent user comparison state)
-- ============================================================
CREATE TABLE IF NOT EXISTS comparison_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  paper_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE comparison_selections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_comparison" ON comparison_selections;
CREATE POLICY "select_own_comparison" ON comparison_selections
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_comparison" ON comparison_selections;
CREATE POLICY "insert_own_comparison" ON comparison_selections
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_comparison" ON comparison_selections;
CREATE POLICY "delete_own_comparison" ON comparison_selections
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
DROP TRIGGER IF EXISTS uploaded_documents_updated_at ON uploaded_documents;
CREATE TRIGGER uploaded_documents_updated_at BEFORE UPDATE ON uploaded_documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS alert_settings_updated_at ON alert_settings;
CREATE TRIGGER alert_settings_updated_at BEFORE UPDATE ON alert_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- STORAGE BUCKET FOR PDF UPLOADS
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: users can only access their own files
DROP POLICY IF EXISTS "select_own_documents_storage" ON storage.objects;
CREATE POLICY "select_own_documents_storage" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'documents' AND owner = auth.uid());

DROP POLICY IF EXISTS "insert_own_documents_storage" ON storage.objects;
CREATE POLICY "insert_own_documents_storage" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents' AND owner = auth.uid());

DROP POLICY IF EXISTS "update_own_documents_storage" ON storage.objects;
CREATE POLICY "update_own_documents_storage" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'documents' AND owner = auth.uid());

DROP POLICY IF EXISTS "delete_own_documents_storage" ON storage.objects;
CREATE POLICY "delete_own_documents_storage" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'documents' AND owner = auth.uid());
