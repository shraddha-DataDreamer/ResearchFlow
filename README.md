# ResearchFlow — Intelligent Research Paper Navigation & Discovery System

A final-year BE Information Technology project: a complete research workflow platform
that helps students and researchers discover, analyze, compare, and organize academic papers.

## Features

### Stage 1 — Working Foundation (Complete)
- **Landing page** with hero, features, how-it-works, privacy section, and footer
- **Authentication** — signup, login, logout, forgot password, session persistence, protected routes
- **User profiles** with department and research interests
- **Dashboard** with saved paper counts, reading progress, recent searches, quick actions, empty states
- **Paper Discovery** — live search across OpenAlex with keyword-based relevance ranking
- **Paper Details** — full metadata, authors, abstract, concepts, save/unsave, reading status
- **My Workspace** — saved papers (with search/filter), notes (CRUD), reading lists (CRUD)
- **Settings** — edit profile, department, research interests
- **Responsive sidebar navigation** with collapse, mobile drawer, top search bar, profile menu

### Stage 2 — PDF Analysis & AI (Complete — Extractive Mode)
- **PDF upload** to private Supabase Storage with file validation (type, size)
- **Browser-side text extraction** using PDF.js with page number preservation
- **Scanned PDF detection** — explains when OCR is required
- **Passage chunking** with overlapping segments for retrieval
- **Structured analysis** — extracts research problem, objectives, methodology, dataset, findings, limitations, future work
- **Q&A chat** with keyword-based passage retrieval and evidence display (page references)
- **Privacy consent** — clearly discloses no external AI processing; all extraction runs in-browser
- Missing information is labelled "Not stated or not found in the extracted text"

### Stage 3 — Research Tools (Complete)
- **Paper Comparison** — select 2-4 saved papers, side-by-side table, CSV export, print, research gap suggestions
- **Citation Explorer** — fetches real references and cited-by data from OpenAlex, filter tabs, source links
- **Literature Review Matrix** — editable table with papers as rows, research fields as columns, personal notes, CSV export, print
- **Research Journey Map** — timeline of saved papers by publication year with filters

### Stage 4 — Workspace & Alerts (Complete)
- **Topic Alerts** — save research topics with keywords, manually check for new papers via OpenAlex, store check results
- **Search history** persisted in database
- **Recently viewed papers** tracking
- **Department-aware discovery** — department and interests stored in profile, used for personalized recommendations

### Planned / Not Yet Implemented
- Semantic embedding-based ranking (requires AI provider key)
- Crossref and arXiv API integration
- Interactive citation graph (React Flow)
- Scheduled background alert checks and email notifications
- OCR for scanned PDFs

## Technology Stack

- **Frontend:** Next.js 13, React, TypeScript, Tailwind CSS, shadcn/ui, Lucide React
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Research Data:** OpenAlex API (primary)
- **PDF Processing:** pdfjs-dist (browser-side text extraction)
- **AI:** Extractive analysis (keyword-based) — no external AI service required

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL` — Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Your Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — Your Supabase service role key (server only)

### Running the Project

```bash
npm run dev        # Development server
npm run build      # Production build
npm run typecheck  # TypeScript type checking
npm run lint       # ESLint
```

## Database Setup

The database schema is managed through Supabase migrations:

**Core tables:** profiles, papers, paper_authors, saved_papers, notes, reading_lists,
reading_list_items, search_history, research_topics

**Stage 2 tables:** uploaded_documents, paper_passages, analysis_runs, analysis_evidence,
paper_references, recently_viewed, alert_settings, alert_checks, comparison_selections

All user-owned tables have RLS policies enforcing `auth.uid() = user_id` ownership checks.
A private Supabase Storage bucket (`documents`) stores uploaded PDFs with per-user access policies.

## Feature Status

| Feature | Status |
|---------|--------|
| Landing page | Complete |
| Authentication | Complete |
| Dashboard | Complete |
| Paper Discovery (OpenAlex) | Complete |
| Paper Details | Complete |
| Saved Papers | Complete |
| Notes | Complete |
| Reading Lists | Complete |
| Settings/Profile | Complete |
| AI Paper Analysis (Extractive) | Complete |
| PDF Upload & Text Extraction | Complete |
| PDF Q&A (Keyword RAG) | Complete |
| Paper Comparison + CSV | Complete |
| Citation Explorer | Complete |
| Literature Matrix + CSV | Complete |
| Research Journey Map | Complete |
| Topic Alerts (Manual) | Complete |
| Semantic Embeddings | Planned |
| AI Provider Integration | Planned |
| Interactive Citation Graph | Planned |
| Scheduled Alerts | Planned |

## Project Structure

```
app/
  (app)/           — Authenticated app routes (dashboard, discover, workspace, etc.)
  login/           — Login page
  signup/          — Signup page
  forgot-password/ — Password reset request
  layout.tsx       — Root layout with AuthProvider
  page.tsx         — Landing page
components/
  ui/              — shadcn/ui components
  app-sidebar.tsx  — Collapsible sidebar navigation
  app-topnav.tsx   — Top navigation with search and profile menu
lib/
  auth-context.tsx — Auth provider and useAuth hook
  services/        — API service functions (search, pdf, analysis, citations)
  supabase/        — Supabase client instances
types/
  index.ts         — Shared TypeScript types
supabase/
  migrations/      — Database migrations (3 migrations)
  functions/       — Edge functions (scholarly-search)
  config.toml      — Supabase configuration
```

## Team

Final-year BE Information Technology project (3 members).
