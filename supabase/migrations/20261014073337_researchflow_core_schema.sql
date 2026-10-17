/*
# ResearchFlow Core Schema

## Overview
Creates the foundational database schema for ResearchFlow, an intelligent research paper
navigation and discovery system. This migration sets up all core tables needed for
Stage 1 functionality: user profiles, paper metadata, saved papers, notes, reading lists,
search history, and research topics.

## New Tables

1. **profiles** — User profile data linked to Supabase auth.users
   - id (uuid, PK, references auth.users)
   - email (text, unique, not null)
   - full_name (text, nullable)
   - department (text, nullable — stores one of the supported departments)
   - research_interests (text[], default empty array)
   - avatar_url (text, nullable)
   - created_at, updated_at (timestamptz)

2. **papers** — Shared bibliographic metadata for research papers (not user-owned)
   - id (uuid, PK)
   - title (text, not null)
   - abstract (text, nullable)
   - doi (text, unique, nullable — for deduplication)
   - source_id (text, nullable — provider-specific ID like OpenAlex work ID)
   - source_provider (text, not null — 'openalex', 'crossref', 'arxiv', 'manual')
   - publication_year (int, nullable)
   - publication_type (text, nullable)
   - is_open_access (boolean, nullable)
   - open_access_url (text, nullable)
   - venue (text, nullable — journal/conference name)
   - citation_count (int, nullable)
   - concepts (text[], default empty array — research concepts/topics)
   - created_at, updated_at (timestamptz)
   - Unique constraint on (source_provider, source_id) for deduplication

3. **paper_authors** — Authors associated with papers
   - id (uuid, PK)
   - paper_id (uuid, FK to papers, CASCADE on delete)
   - name (text, not null)
   - orcid (text, nullable)
   - affiliation (text, nullable)
   - position (int, not null — author order)
   - created_at (timestamptz)

4. **saved_papers** — User's saved/bookmarked papers (user-owned)
   - id (uuid, PK)
   - user_id (uuid, NOT NULL DEFAULT auth.uid(), FK to auth.users CASCADE)
   - paper_id (uuid, FK to papers CASCADE)
   - reading_status (text, NOT NULL DEFAULT 'to_read' — 'to_read', 'reading', 'completed')
   - created_at (timestamptz)
   - Unique constraint on (user_id, paper_id) to prevent duplicate saves

5. **notes** — User's personal notes, optionally linked to a paper (user-owned)
   - id (uuid, PK)
   - user_id (uuid, NOT NULL DEFAULT auth.uid(), FK to auth.users CASCADE)
   - paper_id (uuid, nullable, FK to papers SET NULL)
   - title (text, not null)
   - content (text, not null default '')
   - created_at, updated_at (timestamptz)

6. **reading_lists** — User's named reading lists (user-owned)
   - id (uuid, PK)
   - user_id (uuid, NOT NULL DEFAULT auth.uid(), FK to auth.users CASCADE)
   - name (text, not null)
   - description (text, nullable)
   - created_at, updated_at (timestamptz)

7. **reading_list_items** — Papers within a reading list
   - id (uuid, PK)
   - reading_list_id (uuid, FK to reading_lists CASCADE)
   - paper_id (uuid, FK to papers CASCADE)
   - added_at (timestamptz)
   - Unique constraint on (reading_list_id, paper_id)

8. **search_history** — User's search queries (user-owned)
   - id (uuid, PK)
   - user_id (uuid, NOT NULL DEFAULT auth.uid(), FK to auth.users CASCADE)
   - query (text, not null)
   - filters (jsonb, default '{}')
   - result_count (int, nullable)
   - created_at (timestamptz)

9. **research_topics** — User's saved research topics of interest (user-owned)
   - id (uuid, PK)
   - user_id (uuid, NOT NULL DEFAULT auth.uid(), FK to auth.users CASCADE)
   - topic (text, not null)
   - keywords (text[], default empty array)
   - department (text, nullable)
   - created_at, updated_at (timestamptz)

## Security (RLS)

- **profiles**: Users can read/update only their own profile. On signup, a trigger
  creates the profile automatically from auth metadata.
- **papers** + **paper_authors**: Public read (all authenticated users can see shared
  bibliographic data). No user can insert/update/delete papers directly — only the
  service role (edge functions) manages paper metadata.
- **saved_papers, notes, reading_lists, reading_list_items, search_history, research_topics**:
  Owner-scoped CRUD — each authenticated user can only access their own rows.
  reading_list_items uses a subquery check through reading_lists ownership.
- All user-owned tables have user_id columns defaulting to auth.uid() so inserts
  that omit user_id succeed.

## Indexes
- papers.doi (unique, for dedup lookups)
- papers.source_provider + source_id (unique, for dedup)
- saved_papers.user_id
- notes.user_id
- notes.paper_id
- reading_lists.user_id
- search_history.user_id
- research_topics.user_id
- paper_authors.paper_id

## Trigger
- handle_new_user(): AFTER INSERT on auth.users → inserts a row into profiles.
  This ensures a profile exists for every new auth user automatically.
*/

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  department text,
  research_interests text[] NOT NULL DEFAULT '{}',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================
-- PAPERS (shared bibliographic metadata)
-- ============================================================
CREATE TABLE IF NOT EXISTS papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  abstract text,
  doi text UNIQUE,
  source_id text,
  source_provider text NOT NULL DEFAULT 'manual',
  publication_year int,
  publication_type text,
  is_open_access boolean,
  open_access_url text,
  venue text,
  citation_count int,
  concepts text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_papers_source UNIQUE (source_provider, source_id)
);

ALTER TABLE papers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_papers_authenticated" ON papers;
CREATE POLICY "read_papers_authenticated" ON papers
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- PAPER AUTHORS
-- ============================================================
CREATE TABLE IF NOT EXISTS paper_authors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id uuid NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  name text NOT NULL,
  orcid text,
  affiliation text,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE paper_authors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_paper_authors_authenticated" ON paper_authors;
CREATE POLICY "read_paper_authors_authenticated" ON paper_authors
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_paper_authors_paper_id ON paper_authors(paper_id);

-- ============================================================
-- SAVED PAPERS (user-owned)
-- ============================================================
CREATE TABLE IF NOT EXISTS saved_papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  paper_id uuid NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  reading_status text NOT NULL DEFAULT 'to_read',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_saved_papers_user_paper UNIQUE (user_id, paper_id)
);

ALTER TABLE saved_papers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_saved_papers" ON saved_papers;
CREATE POLICY "select_own_saved_papers" ON saved_papers
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_saved_papers" ON saved_papers;
CREATE POLICY "insert_own_saved_papers" ON saved_papers
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_saved_papers" ON saved_papers;
CREATE POLICY "update_own_saved_papers" ON saved_papers
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_saved_papers" ON saved_papers;
CREATE POLICY "delete_own_saved_papers" ON saved_papers
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_saved_papers_user_id ON saved_papers(user_id);

-- ============================================================
-- NOTES (user-owned)
-- ============================================================
CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  paper_id uuid REFERENCES papers(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notes" ON notes;
CREATE POLICY "select_own_notes" ON notes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_notes" ON notes;
CREATE POLICY "insert_own_notes" ON notes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notes" ON notes;
CREATE POLICY "update_own_notes" ON notes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_notes" ON notes;
CREATE POLICY "delete_own_notes" ON notes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_paper_id ON notes(paper_id);

-- ============================================================
-- READING LISTS (user-owned)
-- ============================================================
CREATE TABLE IF NOT EXISTS reading_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reading_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_reading_lists" ON reading_lists;
CREATE POLICY "select_own_reading_lists" ON reading_lists
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_reading_lists" ON reading_lists;
CREATE POLICY "insert_own_reading_lists" ON reading_lists
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_reading_lists" ON reading_lists;
CREATE POLICY "update_own_reading_lists" ON reading_lists
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_reading_lists" ON reading_lists;
CREATE POLICY "delete_own_reading_lists" ON reading_lists
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_reading_lists_user_id ON reading_lists(user_id);

-- ============================================================
-- READING LIST ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS reading_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_list_id uuid NOT NULL REFERENCES reading_lists(id) ON DELETE CASCADE,
  paper_id uuid NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_reading_list_item UNIQUE (reading_list_id, paper_id)
);

ALTER TABLE reading_list_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_reading_list_items" ON reading_list_items;
CREATE POLICY "select_own_reading_list_items" ON reading_list_items
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM reading_lists WHERE reading_lists.id = reading_list_items.reading_list_id AND reading_lists.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_reading_list_items" ON reading_list_items;
CREATE POLICY "insert_own_reading_list_items" ON reading_list_items
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM reading_lists WHERE reading_lists.id = reading_list_items.reading_list_id AND reading_lists.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_reading_list_items" ON reading_list_items;
CREATE POLICY "delete_own_reading_list_items" ON reading_list_items
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM reading_lists WHERE reading_lists.id = reading_list_items.reading_list_id AND reading_lists.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_reading_list_items_list_id ON reading_list_items(reading_list_id);

-- ============================================================
-- SEARCH HISTORY (user-owned)
-- ============================================================
CREATE TABLE IF NOT EXISTS search_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  query text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}',
  result_count int,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_search_history" ON search_history;
CREATE POLICY "select_own_search_history" ON search_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_search_history" ON search_history;
CREATE POLICY "insert_own_search_history" ON search_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_search_history" ON search_history;
CREATE POLICY "delete_own_search_history" ON search_history
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_history(user_id);

-- ============================================================
-- RESEARCH TOPICS (user-owned)
-- ============================================================
CREATE TABLE IF NOT EXISTS research_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  topic text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  department text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE research_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_research_topics" ON research_topics;
CREATE POLICY "select_own_research_topics" ON research_topics
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_research_topics" ON research_topics;
CREATE POLICY "insert_own_research_topics" ON research_topics
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_research_topics" ON research_topics;
CREATE POLICY "update_own_research_topics" ON research_topics
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_research_topics" ON research_topics;
CREATE POLICY "delete_own_research_topics" ON research_topics
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_research_topics_user_id ON research_topics(user_id);

-- ============================================================
-- AUTO-CREATE PROFILE TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, research_interests)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    '{}'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS notes_updated_at ON notes;
CREATE TRIGGER notes_updated_at BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS reading_lists_updated_at ON reading_lists;
CREATE TRIGGER reading_lists_updated_at BEFORE UPDATE ON reading_lists
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS research_topics_updated_at ON research_topics;
CREATE TRIGGER research_topics_updated_at BEFORE UPDATE ON research_topics
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS papers_updated_at ON papers;
CREATE TRIGGER papers_updated_at BEFORE UPDATE ON papers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
